import React, { useState } from 'react';
import { Search, ChevronDown, Download, Trash, Edit, PlusSquare, Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const CustomersPage = () => {
  const [showMainSidebar, setShowMainSidebar] = useState(false);
  const customers = [
    {
      name: 'حسام برغوث',
      email: 'hossa,@gmail.com',
      phone: '+96279123456',
    },
    {
      name: 'أحمد',
      email: 'ahmed@gmail.com',
      phone: '+96279123456',
    },
    {
      name: 'خالد',
      email: 'khaled@gmail.com',
      phone: '+96279123456',
    },
  ];

  const toggleMainSidebar = () => {
    setShowMainSidebar(!showMainSidebar);
  };

  return (
    <div className="bg-gray-100 font-sans" dir="rtl">
      {/* Sidebar */}
      <Sidebar showMainSidebar={showMainSidebar} toggleMainSidebar={toggleMainSidebar} />
      <div className="bg-white flex justify-between items-center mb-2 p-2">
        <div>
          <button onClick={toggleMainSidebar} className="mr-4 p-2 rounded-full hover:bg-gray-200">
            <Menu size={24} />
          </button>
        </div>
        <div className="text-blue-600 font-bold text-xl">
          <div className="flex items-center">
            <div>سوبرماركت مسافر</div>
          </div>
        </div>
        <div className="text-gray-600 text-right">
          <div>أمين الصندوق: خالد هادية</div>
          <div>10:53:00 26/02/2023</div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">معلومات العملاء</h2>
          <span className="text-sm text-gray-500">جميع معلومات العملاء الخاصة بك</span>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-2 space-x-reverse">
            <button className="bg-blue-500 text-white px-3 py-2 rounded-md text-sm flex items-center">
              <PlusSquare className="w-4 h-4 ml-1" />
              إضافة عميل جديد
            </button>
            <button className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm flex items-center">
              <Download className="w-4 h-4 ml-1" />
              تصدير
            </button>
            <button className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm flex items-center">
              <ChevronDown className="w-4 h-4 ml-1" />
              ترتيب حسب: الأحدث
            </button>
          </div>
          <div className="relative">
            <input type="text" placeholder="بحث عن طريق الاسم أو رقم الهاتف" className="bg-gray-100 rounded-md py-2 px-3 pl-10 text-sm w-64" />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          </div>
        </div>

        <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
          <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-[#F5F9FF]">
              <tr>
                <th scope="col" className="px-6 py-3 text-[#4F5E83] text-base">
                  اسم العميل
                </th>
                <th scope="col" className="px-6 py-3 text-[#4F5E83] text-base">
                  ايميل العميل
                </th>
                <th scope="col" className="px-6 py-3 text-[#4F5E83] text-base">
                  رقم الهاتف
                </th>
                <th scope="col" className="px-6 py-3 text-[#4F5E83] text-base">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer, index) => (
                <tr key={index} className="bg-white border-b">
                  <td className="px-6 py-4">{customer.name}</td>
                  <td className="px-6 py-4">{customer.email}</td>
                  <td className="px-6 py-4">{customer.phone}</td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2 space-x-reverse">
                      <button className="text-red-500 hover:text-red-700">
                        <Trash className="w-5 h-5" />
                      </button>
                      <button className="text-blue-500 hover:text-blue-700">
                        <Edit className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomersPage;
