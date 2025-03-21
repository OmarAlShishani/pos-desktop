import { useState, useEffect } from 'react';

export function useScale() {
  const [weight, setWeight] = useState(0);
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isStable, setIsStable] = useState(false);
  const [lastStableWeight, setLastStableWeight] = useState(0);

  const SCALE_IDENTIFIERS = {
    manufacturers: ['wch', 'silicon labs', 'prolific', 'ftdi'],
    vidPid: ['067b:23a3', '0483:5740', '0403:6001', '1a86:7523'],
  };

  const isScalePort = (port) => {
    const isMatchingManufacturer = SCALE_IDENTIFIERS.manufacturers.some((mfr) => port.manufacturer?.toLowerCase().includes(mfr.toLowerCase()));

    const isMatchingVidPid = SCALE_IDENTIFIERS.vidPid.some((vidPid) => `${port.vendorId}:${port.productId}`.toLowerCase() === vidPid.toLowerCase());

    return isMatchingManufacturer || isMatchingVidPid;
  };

  const checkWeightStability = (newWeight) => {
    if (Math.abs(newWeight - lastStableWeight) < 0.002) {
      // Tolerance of 0.002 kg
      setIsStable(true);
      setLastStableWeight(newWeight);
    } else {
      setIsStable(false);
    }
  };

  useEffect(() => {
    const loadPorts = async () => {
      try {
        const availablePorts = await window.electronAPI.getPorts();
        // console.log('DEBUG - All Available Ports:', availablePorts.map(port => ({
        //   path: port.path,
        //   manufacturer: port.manufacturer,
        //   vendorId: port.vendorId,
        //   productId: port.productId,
        //   pnpId: port.pnpId
        // })));

        setPorts(availablePorts);

        const scalePort = availablePorts.find(isScalePort);
        if (scalePort && !isConnected) {
          // console.log('Found scale port:', {
          //   path: scalePort.path,
          //   manufacturer: scalePort.manufacturer,
          //   vidPid: `${scalePort.vendorId}:${scalePort.productId}`
          // });
          connectScale(scalePort.path);
        } else if (!scalePort) {
          // console.log('Available ports:', availablePorts.map(p => ({
          //   path: p.path,
          //   manufacturer: p.manufacturer,
          //   vidPid: `${p.vendorId}:${p.productId}`
          // })));
          setError('Scale not found. Please check connection.');
        }
      } catch (error) {
        console.error('Error loading ports:', error);
        setError(`Failed to load ports: ${error.message}`);
      }
    };

    // Load ports initially
    loadPorts();

    // Set up interval to refresh ports and auto-reconnect if needed
    const portRefreshInterval = setInterval(async () => {
      const currentPorts = await window.electronAPI.getPorts();
      setPorts(currentPorts);

      // If we're not connected, try to auto-connect
      if (!isConnected) {
        const scalePort = currentPorts.find(isScalePort);
        if (scalePort) {
          connectScale(scalePort.path);
        }
      }
    }, 5000); // Check every 5 seconds

    // Set up listeners
    const scaleDataHandler = (event, data) => {
      if (data !== 'ERROR') {
        const parsedWeight = parseWeight(data);
        checkWeightStability(parsedWeight);
        setWeight(parsedWeight);
        setError(null);
      }
    };

    const scaleErrorHandler = (event, errorMessage) => {
      console.error('Scale error:', errorMessage);
      setError(errorMessage);
      setIsConnected(false);
    };

    const scaleStatusHandler = (event, status) => {
      // console.log("Scale status:", status);
      setIsConnected(status === 'connected');
    };

    // Add listeners
    window.electronAPI.onScaleData(scaleDataHandler);
    window.electronAPI.onScaleError(scaleErrorHandler);
    window.electronAPI.onScaleStatus(scaleStatusHandler);

    // Modified cleanup function
    return () => {
      // Cleanup listeners
      window.electronAPI.removeScaleListener();
      window.electronAPI.removeScaleErrorListener();
      window.electronAPI.removeScaleStatusListener();

      // Clear the refresh interval
      clearInterval(portRefreshInterval);

      // Disconnect scale on cleanup
      if (isConnected) {
        connectScale(null);
      }
    };
  }, [isConnected]);

  const connectScale = async (portName, baudRate = 9600) => {
    try {
      if (!portName) {
        throw new Error('Port name is required');
      }
      // console.log('Attempting to connect to scale:', {
      //   port: portName,
      //   baudRate: baudRate
      // });

      setError(null);
      const result = await window.electronAPI.connectScale(portName, baudRate);
      // console.log('Scale connection result:', result);

      if (result.success) {
        setSelectedPort(portName);
        setIsConnected(true);
      } else {
        setError(result.error || 'Unknown connection error');
        setIsConnected(false);
      }
    } catch (err) {
      // console.error('Scale connection error:', err);
      setError(err.message);
      setIsConnected(false);
    }
  };

  const parseWeight = (data) => {
    // console.log('Parsing weight data:', data);

    if (data === 'ERROR' || !data) {
      return 0;
    }

    try {
      const numericMatch = data.match(/[-+]?\d*\.?\d+/);
      if (numericMatch) {
        const weight = parseFloat(numericMatch[0]);
        // console.log('Successfully parsed weight:', weight);
        return isNaN(weight) ? 0 : weight;
      }

      // console.log('No numeric value found in:', data);
      return 0;
    } catch (error) {
      // console.error('Error parsing weight:', error);
      return 0;
    }
  };

  const getItemWeight = (item) => {
    if (item.quantity && item.is_scalable_item) {
      return item.quantity;
    }
    return isStable ? weight : 0;
  };

  return {
    weight,
    ports,
    selectedPort,
    isConnected,
    error,
    isStable,
    connectScale,
    getItemWeight,
  };
}
