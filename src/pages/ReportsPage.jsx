import React, { useState, useEffect } from 'react';
import { Search, Download, Menu, Eye, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import db from '../pouchdb';

const ReportsPage = () => {
  const navigate = useNavigate();
  const [showMainSidebar, setShowMainSidebar] = useState(false);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('sales');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);

  useEffect(() => {
    const initializeData = async () => {
      try {
        // Get terminal ID from localStorage
        const posTerminal = localStorage.getItem('posTerminal');

        // Fetch POS date from settings
        const settingsResult = await db.query('pos_index/pos_settings_by_all', {
          reduce: false,
          descending: true,
          limit: 1,
        });

        let posDateStart = new Date();
        if (settingsResult.rows.length > 0) {
          const settings = settingsResult.rows[0].value;
          posDateStart = new Date(settings.pos_date);
        }
        posDateStart.setHours(0, 0, 0, 0);

        await fetchData('sales', posTerminal, posDateStart);
      } catch (err) {
        console.error('Error initializing data:', err);
      }
    };
    initializeData();
  }, []);

  const fetchData = async (documentType, terminalId, posDateStart) => {
    setIsLoading(true);
    try {
      // Get current user from localStorage
      const currentUser = JSON.parse(localStorage.getItem('currentUser'));
      const userId = currentUser?.id;

      let selector = {};

      if (documentType === 'sales') {
        selector = {
          document_type: 'order',
          type: 'sale',
          terminal_id: terminalId,
          user_id: userId,
          created_at: {
            $gte: posDateStart.toISOString(),
          },
        };
      } else if (documentType === 'returns') {
        selector = {
          document_type: 'order',
          type: 'return',
          terminal_id: terminalId,
          user_id: userId,
          created_at: {
            $gte: posDateStart.toISOString(),
          },
        };
      } else if (documentType === 'receipts' || documentType === 'expenses') {
        selector = {
          document_type: 'voucher',
          type: documentType === 'receipts' ? 'receipt' : 'expense',
          user_id: userId,
          created_at: {
            $gte: posDateStart.toISOString(),
          },
        };
      }

      const result = await db.find({ selector });

      // Transform the data to match the table structure
      const transformedData = result.docs
        .map((doc) => {
          if (doc.document_type === 'order') {
            return doc.items.map((item) => ({
              ...item,
              name: item.name_ar,
              code: item.sku_code || item.barcode,
              quantity: item.quantity,
              price: Number(item.price || item.original_price).toFixed(4),
              discount: '0',
              total: (item.quantity * (item.price || item.original_price)).toFixed(4),
              originalDoc: doc,
            }));
          } else if (doc.document_type === 'voucher') {
            return doc.items.map((item) => ({
              ...item,
              name: item.statement,
              code: '-',
              quantity: 1,
              price: Number(item.price).toFixed(4),
              discount: '0',
              total: Number(item.price).toFixed(4),
              originalDoc: doc,
            }));
          }
        })
        .flat();

      setData(transformedData);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setIsLoading(false);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleTabChange = async (tabId) => {
    setActiveTab(tabId);

    try {
      // Get terminal ID from localStorage
      const posTerminal = localStorage.getItem('posTerminal');

      // Fetch POS date from settings
      const settingsResult = await db.query('pos_index/pos_settings_by_all', {
        reduce: false,
        descending: true,
        limit: 1,
      });

      let posDateStart = new Date();
      if (settingsResult.rows.length > 0) {
        const settings = settingsResult.rows[0].value;
        posDateStart = new Date(settings.pos_date);
      }
      posDateStart.setHours(0, 0, 0, 0);

      await fetchData(tabId, posTerminal, posDateStart);
    } catch (err) {
      console.error('Error changing tab:', err);
    }
  };

  const filteredData = data.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.code.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleExport = () => {
    // Add UTF-8 BOM to properly handle Arabic characters
    const BOM = '\uFEFF';

    // Prepare headers based on active tab
    const headers = ['الاسم', 'الرمز', 'الكمية', 'السعر', 'الخصم', 'المجموع'].join(',');

    // Convert data to CSV format
    const csvContent =
      BOM +
      [
        headers,
        ...filteredData.map((item) =>
          [
            `"${item.name}"`, // Wrap text fields in quotes to handle commas
            `"${item.code}"`,
            item.quantity,
            item.price,
            item.discount,
            item.total,
          ].join(','),
        ),
      ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toLocaleDateString('en-US').replace(/\//g, '-');

    // Name the file based on the active tab
    const fileName = `${activeTab}-report-${date}.csv`;

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleMainSidebar = () => {
    setShowMainSidebar(!showMainSidebar);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentShift');
    navigate('/');
  };

  const tabs = [
    { id: 'sales', label: 'المبيعات' },
    { id: 'returns', label: 'المرتجعات' },
    { id: 'receipts', label: 'سندات القبض' },
    { id: 'expenses', label: 'سندات الصرف' },
  ];

  return (
    <div className="bg-gray-100 min-h-screen font-sans" dir="rtl">
      <Sidebar showMainSidebar={showMainSidebar} toggleMainSidebar={toggleMainSidebar} />
      <Header toggleMainSidebar={toggleMainSidebar} handleLogout={handleLogout} />
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">التقارير</h2>
            <span className="text-sm text-gray-500">جميع التقارير لهذا اليوم</span>
          </div>

          <div className="flex justify-end items-center mb-6">
            <div className="relative">
              <input type="text" value={searchTerm} onChange={handleSearch} placeholder="بحث" className="bg-gray-50 rounded-lg py-2.5 px-4 pl-10 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <div className="flex space-x-8 space-x-reverse mb-6 border-b mt-6">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`pb-3 px-2 -mb-px ${activeTab === tab.id ? 'text-blue-600 border-b-2 border-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-xs uppercase bg-[#F5F9FF] text-[#4F5E83]">
                <tr>
                  <th scope="col" className="px-6 py-4 text-base font-medium">
                    اسم المادة
                  </th>
                  <th scope="col" className="px-6 py-4 text-base font-medium">
                    رمز المادة
                  </th>
                  <th scope="col" className="px-6 py-4 text-base font-medium">
                    الكمية
                  </th>
                  <th scope="col" className="px-6 py-4 text-base font-medium">
                    السعر
                  </th>
                  <th scope="col" className="px-6 py-4 text-base font-medium">
                    الخصم
                  </th>
                  <th scope="col" className="px-6 py-4 text-base font-medium">
                    المجموع
                  </th>
                  <th scope="col" className="px-6 py-4 text-base font-medium">
                    التفاصيل
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      جاري التحميل...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr key={index} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4">{item.code}</td>
                      <td className="px-6 py-4">{item.quantity}</td>
                      <td className="px-6 py-4">{item.price} د.أ</td>
                      <td className="px-6 py-4">{item.discount}</td>
                      <td className="px-6 py-4">{item.total} د.أ</td>
                      <td className="px-6 py-4">
                        <button onClick={() => setSelectedDocument(item.originalDoc)} className="text-blue-500 hover:text-blue-700 transition-colors">
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button onClick={handleExport} className="mt-6 bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4 ml-2" />
            تصدير
          </button>
        </div>
      </div>

      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">تفاصيل المستند</h3>
              <button onClick={() => setSelectedDocument(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500">نوع المستند</p>
                  <p className="font-medium">{selectedDocument.document_type === 'order' ? (selectedDocument.type === 'sale' ? 'مبيعات' : 'مرتجعات') : selectedDocument.type === 'receipt' ? 'مقبوضات' : 'مصروفات'}</p>
                </div>
                <div>
                  <p className="text-gray-500">رقم المستند</p>
                  <p className="font-medium">{selectedDocument._id}</p>
                </div>
                <div>
                  <p className="text-gray-500">التاريخ</p>
                  <p className="font-medium">
                    {new Date(selectedDocument.created_at).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </p>
                </div>
                {selectedDocument.document_type === 'order' && (
                  <div>
                    <p className="text-gray-500">طريقة الدفع</p>
                    <p className="font-medium">{selectedDocument.paymentMethod}</p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h4 className="font-semibold mb-2">المواد</h4>
                <div className="border rounded-lg">
                  {selectedDocument.items.map((item, index) => (
                    <div key={index} className="p-4 border-b last:border-b-0">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{selectedDocument.document_type === 'order' ? item.name_ar : item.statement}</p>
                          {selectedDocument.document_type === 'order' && <p className="text-sm text-gray-500">الكمية: {item.quantity}</p>}
                        </div>
                        <p className="font-medium">{selectedDocument.document_type === 'order' ? (item.quantity * (item.price || item.original_price)).toFixed(4) : Number(item.price).toFixed(4)} د.أ</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-2">
                {selectedDocument.document_type === 'order' && (
                  <>
                    <div className="flex justify-between">
                      <p className="text-gray-500">المجموع الفرعي</p>
                      <p className="font-medium">{Number(selectedDocument.subtotal).toFixed(4)} د.أ</p>
                    </div>
                    {selectedDocument.tax && (
                      <div className="flex justify-between">
                        <p className="text-gray-500">الضريبة</p>
                        <p className="font-medium">{Number(selectedDocument.tax).toFixed(4)} د.أ</p>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-lg font-semibold">
                  <p>المجموع الإجمالي</p>
                  <p>{Number(selectedDocument.total).toFixed(4)} د.أ</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
