import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import logo from '../assets/images/logo.png';
import db from '../pouchdb';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getPOSDateTime } from '../utils/dateUtils';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await db.query('pos_index/users_by_all', {
        include_docs: true,
        reduce: false,
      });

      const adminUsers = result.rows.map((row) => row.doc).filter((doc) => doc.roles && doc.roles.includes('admin'));

      if (adminUsers.length === 0) {
        toast.error('اسم المستخدم غير صحيح أو ليس لديه صلاحيات المشرف', {
          position: 'top-right',
          theme: 'colored',
        });
        return;
      }

      const user = adminUsers.find((u) => u.username === username);
      if (!user) {
        toast.error('اسم المستخدم غير صحيح أو ليس لديه صلاحيات المشرف', {
          position: 'top-right',
          theme: 'colored',
        });
        return;
      }

      const isPasswordValid = await bcryptjs.compare(password, user.password);

      if (!isPasswordValid) {
        toast.error('كلمة المرور غير صحيحة', {
          position: 'top-right',
          theme: 'colored',
        });
        return;
      }

      const terminal_id = localStorage.getItem('posTerminal');
      const posDateTime = await getPOSDateTime();

      const logEntry = {
        _id: uuidv4(),
        document_type: 'log',
        statement: `تم تسجيل الدخول كمشرف من قبل ${username}`,
        user_id: user._id,
        terminal_id: terminal_id,
        created_at: posDateTime,
        realworld_date: new Date().toISOString(),
      };

      await db.put(logEntry);

      // Store admin user data while preserving normal user data
      const adminUserData = {
        id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
      };

      localStorage.setItem('adminUser', JSON.stringify(adminUserData));

      toast.success('تم تسجيل الدخول كمشرف بنجاح', {
        position: 'top-right',
        theme: 'colored',
      });

      setTimeout(() => {
        navigate('/home');
      }, 500);
    } catch (err) {
      console.error('Admin login error:', err);
      toast.error('حدث خطأ أثناء تسجيل الدخول', {
        position: 'top-right',
        theme: 'colored',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <ToastContainer />

      <div className="w-full max-w-md mx-auto p-8 flex flex-col justify-center relative">
        <img src={logo} alt="Musafer Logo" className="mb-8 w-32 mx-auto" />

        <h1 className="text-4xl text-[#2B3674] font-bold mb-4 text-right">تسجيل الدخول كمشرف</h1>
        <p className="text-lg text-[#7C8DB5] mb-8 text-right">الرجاء إدخال بيانات اعتماد المشرف الخاصة بك</p>

        <form className="space-y-4" onSubmit={handleAdminLogin}>
          <div>
            <label className="block text-lg font-medium text-[#2B3674] text-right">اسم المستخدم (*)</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3" placeholder="أدخل اسم المستخدم" required />
          </div>
          <div>
            <label className="block text-lg font-medium text-[#2B3674] text-right">كلمة المرور (*)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3" placeholder="أدخل كلمة المرور" required />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-[#3B61FB] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول كمشرف'}
          </button>

          <Link to="/home" className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-lg font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
            رجوع
          </Link>
        </form>
      </div>
    </div>
  );
}
