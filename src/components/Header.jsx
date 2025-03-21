import { LogOut, Menu, Barcode } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import db from '../pouchdb';
import BarcodeScannerAnimation from './BarcodeScannerAnimation';

const Header = ({ toggleMainSidebar, handleLogout, weight = 0, selectedTab, pendingScans = 0, scanningState = 'ready' }) => {
  const [terminalName, setTerminalName] = useState('');
  const [posDate, setPosDate] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const posTerminalId = localStorage.getItem('posTerminal');

  useEffect(() => {
    const fetchData = async () => {
      // Fetch terminal name
      if (posTerminalId) {
        try {
          const terminal = await db.get(posTerminalId);
          setTerminalName(terminal.name);
        } catch (error) {
          console.error('Error fetching terminal:', error);
        }
      }

      // Fetch POS date from settings
      try {
        const result = await db.query('pos_index/pos_settings_by_all', {
          reduce: false,
          descending: true,
          limit: 1,
        });

        if (result.rows.length > 0) {
          const settings = result.rows[0].value;
          setPosDate(settings.pos_date);
        }
      } catch (error) {
        console.error('Error fetching POS date:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <div className="bg-white flex justify-between items-center mb-2 p-2">
        <div className="flex items-center gap-4">
          <button onClick={toggleMainSidebar} className="mr-4 p-2 rounded-full hover:bg-gray-200">
            <Menu size={24} />
          </button>
          <div>
            <div className="text-blue-600 font-bold text-xl">سوبرماركت مسافر</div>
            {posDate && <div className="text-gray-600 text-base font-bold">تاريخ النظام: {posDate}</div>}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {selectedTab !== 'supermarket' && (
            <div className="text-gray-600 font-bold text-xl">
              <div className="flex items-center gap-2">
                الوزن: <span className="font-bold text-blue-600">{weight ? weight.toFixed(3) : '0.000'} كغم</span>
              </div>
            </div>
          )}

          {/* Barcode Scanner Animation */}
          <BarcodeScannerAnimation scanningState={scanningState} pendingScans={pendingScans} />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-left">
            <div className="text-gray-800 font-bold">
              {currentUser.username} ({currentUser.roles?.join(', ') || 'No role'})
            </div>
            <div className="text-gray-600 text-sm">{terminalName}</div>
          </div>
          <button onClick={() => setShowLogoutConfirm(true)} className="p-2 rounded-full hover:bg-gray-200" title="Logout">
            <LogOut size={24} />
          </button>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-right">هل أنت متأكد أنك تريد تسجيل الخروج؟</h3>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowLogoutConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                إلغاء
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
