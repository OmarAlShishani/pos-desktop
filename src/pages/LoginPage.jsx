import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/images/logo.png';
import posLandingImg from '../assets/images/pos_landing.png';
import db from '../pouchdb';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getPOSDateTime } from '../utils/dateUtils';
import { checkShiftStatus } from '../utils/shiftUtils';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [terminals, setTerminals] = useState([]);
  const [selectedTerminal, setSelectedTerminal] = useState('');
  const [needsTerminal, setNeedsTerminal] = useState(false);
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0); // Add this line
  const [isSyncing, setIsSyncing] = useState(false); // Add this line

  useEffect(() => {
    const fetchTerminals = async (retryCount = 0, maxRetries = 3) => {
      setIsLoadingTerminals(true);
      try {
        const result = await db.find({
          selector: {
            document_type: 'terminal',
            is_locked: false,
          },
        });
        setTerminals(result.docs);
        setNeedsTerminal(true);
      } catch (err) {
        console.error(`Error fetching terminals (attempt ${retryCount + 1}):`, err);
        if (retryCount < maxRetries) {
          setTimeout(
            () => {
              fetchTerminals(retryCount + 1, maxRetries);
            },
            1000 * (retryCount + 1),
          );
        } else {
          toast.error('فشل في تحميل نقاط البيع. يرجى تحديث الصفحة.', {
            position: 'top-right',
            theme: 'colored',
          });
        }
      } finally {
        setIsLoadingTerminals(false);
      }
    };

    const savedTerminal = localStorage.getItem('posTerminal');
    if (!savedTerminal) {
      fetchTerminals();
    }

    // Add listener for terminal changes
    const changes = db.changes({
      since: 'now',
      live: true,
      filter: function(doc) {
        return doc.document_type === 'terminal';
      }
    }).on('change', () => {
      fetchTerminals();
    });

    return () => changes.cancel();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Add development mode bypass
    if (process.env.NODE_ENV === 'development') {
      const userData = {
        id: 'dev-user',
        username: 'developer',
        email: 'dev@example.com',
        roles: ['admin', 'cashier'],
      };

      localStorage.setItem('currentUser', JSON.stringify(userData));
      localStorage.setItem('adminUser', JSON.stringify(userData));

      // If terminal selection is needed, use the first available terminal
      if (needsTerminal) {
        if (terminals.length > 0) {
          localStorage.setItem('posTerminal', terminals[0]._id);
        } else {
          localStorage.setItem('posTerminal', 'dev-terminal');
        }
      }

      toast.success('Dev mode: Logged in automatically', {
        position: 'top-right',
        theme: 'colored',
      });

      setTimeout(() => {
        navigate('/home');
      }, 500);

      setIsLoading(false);
      return;
    }

    if (needsTerminal && !selectedTerminal) {
      toast.error('الرجاء اختيار نقطة البيع', {
        position: 'top-right',
        theme: 'colored',
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await db.find({
        selector: {
          document_type: 'user',
          username: username,
        },
        limit: 1,
      });

      if (result.docs.length === 0) {
        toast.error('اسم المستخدم أو كلمة المرور غير صحيحة', {
          position: 'top-right',
          autoClose: 2000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          rtl: true,
          theme: 'colored',
        });
        return;
      }

      const user = result.docs[0];

      const isPasswordValid = await bcryptjs.compare(password, user.password);

      if (!isPasswordValid) {
        toast.error('اسم المستخدم أو كلمة المرور غير صحيحة', {
          position: 'top-right',
          autoClose: 2000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          rtl: true,
          theme: 'colored',
        });
        return;
      }

      const posDateTime = await getPOSDateTime();
      const terminal_id = selectedTerminal || localStorage.getItem('posTerminal');

      // Check shift status before allowing login
      const shiftStatus = await checkShiftStatus(user._id, terminal_id);

      if (!shiftStatus.allowed) {
        toast.error(shiftStatus.message, {
          position: 'top-right',
          theme: 'colored',
        });
        setIsLoading(false);
        return;
      }

      // Store the shift ID in localStorage
      if (shiftStatus.shiftId) {
        localStorage.setItem('currentShift', shiftStatus.shiftId);
      }

      const logEntry = {
        _id: uuidv4(),
        document_type: 'log',
        statement: `تم تسجيل الدخول من قبل ${username}`,
        user_id: user._id,
        terminal_id: terminal_id,
        created_at: posDateTime,
        realworld_date: new Date().toISOString(),
      };

      await db.put(logEntry);

      const userData = {
        id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
      };

      localStorage.setItem('currentUser', JSON.stringify(userData));

      if (user.roles && user.roles.includes('admin')) {
        localStorage.setItem('adminUser', JSON.stringify(userData));
      }

      if (needsTerminal && selectedTerminal) {
        try {
          const terminal = await db.get(selectedTerminal);
          await db.put({
            ...terminal,
            is_locked: true,
            _rev: terminal._rev,
          });
          localStorage.setItem('posTerminal', selectedTerminal);
        } catch (err) {
          console.error('Error locking terminal:', err);
          toast.error('حدث خطأ أثناء تحديث نقطة البيع', {
            position: 'top-right',
            theme: 'colored',
          });
          setIsLoading(false);
          return;
        }
      }

      toast.success('تم تسجيل الدخول بنجاح', {
        position: 'top-right',
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        rtl: true,
        theme: 'colored',
      });

      setTimeout(() => {
        navigate('/home');
      }, 500);
    } catch (err) {
      console.error('Login error:', err);
      toast.error('حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.', {
        position: 'top-right',
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        rtl: true,
        theme: 'colored',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminalSelect = (terminalId) => {
    setSelectedTerminal(terminalId);
  };

  const handleExit = () => {
    if (window.electronAPI) {
      try {
        window.electronAPI.exitApplication();
      } catch (error) {
        console.error('Error exiting application:', error);
        // Fallback exit method
        window.close();
      }
    } else {
      console.warn('electronAPI not available');
      // Fallback for when electronAPI is not available
      window.close();
    }
  };

  useEffect(() => {
    const handleSyncProgress = (event) => {
      setSyncProgress(event.detail);
    };

    const handleSyncStatus = (event) => {
      setIsSyncing(event.detail);
    };

    window.addEventListener('syncProgress', handleSyncProgress);
    window.addEventListener('syncStatus', handleSyncStatus);

    return () => {
      window.removeEventListener('syncProgress', handleSyncProgress);
      window.removeEventListener('syncStatus', handleSyncStatus);
    };
  }, []);

  return (
    <div className="flex h-screen bg-white">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={true} pauseOnFocusLoss draggable pauseOnHover theme="colored" />

      <div className="w-1/2 p-8 flex flex-col justify-center items-center">
        <div className="w-full max-w-md">
          {isSyncing && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-[#1d4b38] h-2.5 rounded-full"
                  style={{ width: `${syncProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-1 text-right">
                جارٍ مزامنة البيانات... {syncProgress.toFixed(2)}%
              </p>
            </div>
          )}
          {needsTerminal && (
            <div className="mb-8">
              <label htmlFor="terminal" className="block text-lg font-medium text-[#2B3674] text-right">
                اختر نقطة البيع لأول مرة (*)
              </label>
              <div className="relative">
                <select 
                  id="terminal" 
                  value={selectedTerminal} 
                  onChange={(e) => handleTerminalSelect(e.target.value)} 
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 pr-10" 
                  required 
                  disabled={isLoadingTerminals}
                >
                  <option value="">{isLoadingTerminals ? 'جارٍ تحميل نقاط البيع...' : 'اختر نقطة البيع'}</option>
                  {terminals.map((terminal) => (
                    <option key={terminal._id} value={terminal._id} disabled={terminal.is_locked}>
                      {terminal.name}
                    </option>
                  ))}
                </select>
                {isLoadingTerminals && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="animate-spin h-5 w-5 text-[#1d4b38]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          )}

          <img src={logo} alt="Musafer Logo" className="mb-8 w-32 mx-auto" />

          <h1 className="text-4xl text-[#2B3674] font-bold mb-4 text-right">تسجيل الدخول إلى حسابك</h1>
          <p className="text-lg text-[#7C8DB5] mb-8 text-right">مرحبًا بعودتك! حان الوقت لتسجيل الدخول للمتابعة.</p>

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label htmlFor="username" className="block text-lg font-medium text-[#2B3674] text-right">
                اسم المستخدم (*)
              </label>
              <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3" placeholder="أدخل اسم المستخدم" required />
            </div>
            <div>
              <label htmlFor="password" className="block text-lg font-medium text-[#2B3674] text-right">
                كلمة المرور (*)
              </label>
              <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3" placeholder="أدخل كلمة المرور" required />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-[#1d4b38] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

          <button onClick={handleExit} className="mt-6 w-full flex justify-center py-3 px-4 border border-red-500 rounded-md shadow-sm text-lg font-medium text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200">
            خروج من البرنامج
          </button>
        </div>
      </div>
      <div className="w-1/2 bg-[#1d4b38] p-8">
        <div className="mt-auto flex justify-center">
          <img src={posLandingImg} alt="POS System" className="rounded-lg" />
        </div>
        <div className="text-white w-4/6 m-auto">
          <h2 className="text-4xl font-bold mb-4">مرحبًا بك...</h2>
          <p className="text-lg">سجل دخولك إلى نقطة البيع.</p>
        </div>
      </div>
    </div>
  );
}
