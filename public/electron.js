require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');

let mainWindow;
let scalePort = null;
let scaleParser = null;
let splashScreen;

// Add at the top of the file
if (app.isPackaged) {
  const serialportPath = path.join(process.resourcesPath, 'serialport');
  process.env.SERIALPORT_BINARY_PATH = serialportPath;
  
  // Add this to help debug the path in production
  // console.log('Serialport binary path:', serialportPath);
  // console.log('Resources path:', process.resourcesPath);
}

// Add this function at the top level
function forceReleasePort(portName) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    // Command to list processes using the port
    exec(`powershell -Command "Get-CimInstance -ClassName Win32_Process | Where-Object {$_.CommandLine -like '*${portName}*'} | Select-Object -ExpandProperty ProcessId"`, 
      (error, stdout) => {
        if (error) {
          console.error('Error finding processes:', error);
          reject(error);
          return;
        }

        const pids = stdout.trim().split('\n').filter(Boolean);
        if (pids.length === 0) {
          resolve();
          return;
        }

        // Kill the processes
        pids.forEach(pid => {
          try {
            process.kill(parseInt(pid), 'SIGTERM');
          } catch (e) {
            console.error(`Failed to kill process ${pid}:`, e);
          }
        });
        
        setTimeout(resolve, 1000); // Give some time for the port to be released
      });
  });
}

// Register all IPC handlers before anything else
const registerIPCHandlers = () => {
  // Handler for getting available ports
  ipcMain.handle('get-ports', async () => {
    try {
      // console.log('Attempting to list serial ports...');
      const ports = await SerialPort.list();
      // console.log('Available ports:', ports);
      
      const mappedPorts = ports.map(port => ({
        ...port,
        manufacturer: port.manufacturer || '',
        vendorId: port.vendorId || '',
        productId: port.productId || '',
      }));
      
      // console.log('Mapped ports:', mappedPorts);
      return mappedPorts;
    } catch (error) {
      console.error('Error listing ports:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      return [];
    }
  });

  // Handler for connecting to the scale
  ipcMain.handle('connect-scale', async (event, portName, baudRate = 9600) => {
    try {
      // console.log('Attempting to connect to scale:', { portName, baudRate });
      
      // Clean up existing connection
      cleanupSerialPort();
      
      // Try to force release the port if it might be in use
      await forceReleasePort(portName);

      if (!portName) {
        throw new Error('Port name is required');
      }

      // Initialize SerialPort with more options
      scalePort = new SerialPort({
        path: portName,
        baudRate: parseInt(baudRate, 10),
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false,
        lock: false, // Disable port locking
        rtscts: true, // Enable hardware flow control
        xon: true, // Enable software flow control
        xoff: true
      });

      // Initialize ReadlineParser
      if (!ReadlineParser) {
        throw new Error('ReadlineParser is undefined. Ensure @serialport/parser-readline is installed.');
      }

      scaleParser = scalePort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      if (!scaleParser) {
        throw new Error('Failed to pipe scalePort to ReadlineParser.');
      }

      // Set up event handlers
      scalePort.on('error', (err) => {
        console.error('Scale port error:', {
          message: err.message,
          stack: err.stack,
          port: portName
        });
        mainWindow?.webContents.send('scale-error', err.message);
      });

      scalePort.on('close', () => {
        // console.log('Port closed');
        mainWindow?.webContents.send('scale-status', 'disconnected');
      });

      scalePort.on('open', () => {
        // console.log('Port opened successfully');
        mainWindow?.webContents.send('scale-status', 'connected');
      });

      scaleParser.on('data', (data) => {
        // console.log('Received data:', data);
        try {
          const cleanData = data.toString().trim();
          const numericMatch = cleanData.match(/[-+]?\d*\.?\d+/);
          if (numericMatch) {
            const weight = parseFloat(numericMatch[0]);
            // console.log('Parsed weight:', weight);
            mainWindow?.webContents.send('scale-data', weight.toString());
          } else {
            // console.log('Raw data:', cleanData);
            mainWindow?.webContents.send('scale-data', cleanData);
          }
        } catch (error) {
          console.error('Error processing data:', error);
        }
      });

      // Add timeout to port opening
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Port opening timed out'));
        }, 5000);

        scalePort.open((err) => {
          clearTimeout(timeout);
          if (err) {
            // console.error('Error opening port:', {
            //   error: err.message,
            //   stack: err.stack,
            //   code: err.code
            // });
            reject(err);
          } else {
            resolve();
          }
        });
      });

      return { success: true };
    } catch (error) {
      // console.error('Connection error:', {
      //   message: error.message,
      //   stack: error.stack,
      //   port: portName,
      //   baudRate: baudRate
      // });
      
      // Enhanced error message
      let errorMessage = error.message;
      if (error.message.includes('Access denied')) {
        errorMessage = 'Access denied. Please ensure no other application is using the port and try running as administrator.';
      }
      
      return { success: false, error: errorMessage };
    }
  });

  // Handler for opening cash drawer
  ipcMain.handle('open-cash-drawer', async () => {
    try {
      const device = new escpos.USB();
      const printer = new escpos.Printer(device);
      
      await new Promise((resolve, reject) => {
        device.open((error) => {
          if (error) {
            reject(error);
          } else {
            printer
              .cashdraw(2)  // Pin 2
              .close();
            resolve();
          }
        });
      });

      return { success: true };
    } catch (error) {
      // console.error('Error opening cash drawer:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for printing orders
  ipcMain.on('print-order', (event, content) => {
    const win = new BrowserWindow({ show: false });
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
    win.webContents.on('did-finish-load', () => {
      win.webContents.print({ silent: true, printBackground: true }, (success, failureReason) => {
        if (!success) console.log(failureReason);
        win.close();
      });
    });
  });

  // Add this new handler
  ipcMain.on('exit-application', () => {
    // Clean up all resources
    cleanupSerialPort();
    
    // Close all windows
    BrowserWindow.getAllWindows().forEach(window => {
      window.close();
    });
    
    // Kill the npm process and its children
    const { exec } = require('child_process');
    exec('taskkill /F /IM node.exe', (error) => {
      if (error) {
        console.error('Error killing processes:', error);
      }
      // Force quit the application
      app.exit(0);
    });
  });
};

function cleanupSerialPort() {
  if (scalePort) {
    try {
      if (scalePort.isOpen) {
        scalePort.flush((err) => {
          if (err) console.error('Error flushing port:', err);
          scalePort.close((err) => {
            if (err) console.error('Error closing port:', err);
          });
        });
      }
      scalePort = null;
      scaleParser = null;
    } catch (err) {
      console.error('Error cleaning up serial port:', err);
    }
  }
}

// Create the main application window
function createWindow() {
  // Create splash screen
  splashScreen = new BrowserWindow({
    width: 400,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // Load splash screen
  splashScreen.loadFile('public/splash.html');
  splashScreen.center();

  // Create main window but don't show it yet
  mainWindow = new BrowserWindow({
    show: false,
    fullscreen: true,     // Make the window fullscreen
    frame: false,         // Remove window frame
    autoHideMenuBar: true, // Hide the menu bar
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Hide the menu bar completely
  mainWindow.setMenu(null);

  // Load your app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    // Allow DevTools in development mode
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Allow Ctrl+Shift+I for DevTools
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow.webContents.openDevTools();
        event.preventDefault();
      }
      // Still prevent refresh shortcuts
      if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
        event.preventDefault();
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
    // Modified to allow DevTools in production while still preventing refresh
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Allow Ctrl+Shift+I for DevTools in production
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow.webContents.openDevTools();
        event.preventDefault();
      }
      // Still prevent refresh shortcuts
      if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
        event.preventDefault();
      }
    });
  }

  // When main window is loaded, show it and close splash screen
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      mainWindow.show();
      mainWindow.setFullScreen(true); // Ensure fullscreen mode is set
      splashScreen.destroy();
    }, 2000);
  });

  // Add these lines to prevent refresh and handle close
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Prevent refresh shortcuts (Ctrl+R, F5)
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      event.preventDefault();
    }
  });

  // Prevent Alt+F4 from closing the app directly
  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.webContents.send('app-close-attempted');
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Initialize the app
app.whenReady().then(() => {
  // Register all IPC handlers first
  registerIPCHandlers();
  
  // Then create the window
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Cleanup handlers
app.on('before-quit', () => {
  cleanupSerialPort();
});

app.on('window-all-closed', function () {
  cleanupSerialPort();
  if (process.platform !== 'darwin') app.quit();
});