import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, History, FileText, PieChart, User2, UserCheck, Settings } from 'lucide-react';
import logo from '../assets/images/logo.png';

const Sidebar = ({ showMainSidebar, toggleMainSidebar }) => {
  const navigate = useNavigate();

  const handleButtonClick = () => {
    toggleMainSidebar();
  };

  // Get both normal and admin user data
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');

  // Check if user is currently in admin mode
  const isAdminMode = !!adminUser.id;
  const isNormalUser = !!currentUser.id;

  const handleAdminLogout = () => {
    localStorage.removeItem('adminUser');
    // Check if normal user is still logged in
    if (currentUser.id) {
      // If normal user is logged in, just refresh the current page
      navigate('/home');
    } else {
      // If no normal user, redirect to login
      navigate('/');
    }
  };

  const sidebarButtons = [
    // Show admin login button for normal users when not in admin mode
    ...(isNormalUser && !isAdminMode ? [{ icon: UserCheck, text: 'دخول كمشرف', path: '/admin-login' }] : []),

    // Show admin logout button when in admin mode
    ...(isAdminMode ? [{ icon: User2, text: 'خروج من وضع المشرف', onClick: handleAdminLogout }] : []),
  ];

  // Add additional buttons only for admin mode
  if (isAdminMode) {
    sidebarButtons.unshift({ icon: Home, text: 'الرئيسية', path: '/home' }, { icon: History, text: 'السجل', path: '/history' }, { icon: FileText, text: 'الفواتير', path: '/invoices' }, { icon: PieChart, text: 'التقارير', path: '/reports' });
  }

  return (
    showMainSidebar && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={toggleMainSidebar}>
        <div className="absolute inset-y-0 right-0 w-32 bg-white shadow-lg flex flex-col items-center py-4 space-y-8" onClick={(e) => e.stopPropagation()}>
          {/* Show logo for admin mode */}
          {isAdminMode && (
            <div className="">
              <img src={logo} alt="Logo" className="w-full h-full object-cover rounded-lg" />
            </div>
          )}
          <div className="flex flex-col items-center">
            {sidebarButtons.map((button, index) =>
              button.onClick ? (
                // Button with onClick handler (for admin logout)
                <button
                  key={index}
                  onClick={() => {
                    button.onClick();
                    handleButtonClick();
                  }}
                  className="flex flex-col items-center p-6 hover:bg-gray-100 w-full"
                >
                  <button.icon size={24} className="text-gray-400" />
                  <span className="text-sm text-gray-600">{button.text}</span>
                </button>
              ) : (
                // Regular link button
                <Link key={index} to={button.path} className="flex flex-col items-center p-6 hover:bg-gray-100 w-full" onClick={handleButtonClick}>
                  <button.icon size={24} className="text-gray-400" />
                  <span className="text-sm text-gray-600">{button.text}</span>
                </Link>
              ),
            )}
          </div>
        </div>
      </div>
    )
  );
};

export default Sidebar;
