import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, Download, Trash2, Eye, Menu, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useNavigate } from 'react-router-dom';
import db from '../pouchdb';

const InvoicesPage = () => {
  const navigate = useNavigate();
  const [showMainSidebar, setShowMainSidebar] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [posDate, setPosDate] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Fetch invoices from PouchDB
  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
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
        setPosDate(settings.pos_date);
      }
      posDateStart.setHours(0, 0, 0, 0);

      // Using find to filter by date and terminal
      const result = await db.find({
        selector: {
          document_type: 'order',
          type: 'sale',
          terminal_id: posTerminal,
          created_at: {
            $gte: posDateStart.toISOString(),
          },
        },
      });

      setInvoices(result.docs);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading invoices:', err);
      setIsLoading(false);
    }
  };

  const addInvoice = async (invoice) => {
    try {
      const response = await db.post({
        ...invoice,
        createdAt: new Date().toISOString(),
      });
      await loadInvoices();
      return response;
    } catch (err) {
      console.error('Error adding invoice:', err);
      throw err;
    }
  };

  const deleteInvoice = async (id) => {
    try {
      const doc = await db.get(id);
      await db.remove(doc);
      await loadInvoices();
    } catch (err) {
      console.error('Error deleting invoice:', err);
    }
  };

  const getFilteredInvoices = () => {
    let filtered = [...invoices];
    if (searchQuery) {
      filtered = filtered.filter((invoice) => invoice._id?.toLowerCase().includes(searchQuery.toLowerCase()) || '');
    }

    if (paymentFilter !== 'all') {
      filtered = filtered.filter((invoice) => invoice.status === paymentFilter);
    }

    filtered.sort((a, b) => {
      if (sortOrder === 'newest') {
        return new Date(b.created_at) - new Date(a.created_at);
      } else {
        return new Date(a.created_at) - new Date(b.created_at);
      }
    });

    return filtered;
  };

  const exportToCSV = () => {
    const filteredInvoices = getFilteredInvoices();
    // Add UTF-8 BOM to properly handle Arabic characters
    const BOM = '\uFEFF';
    const headers = ['معرف الفاتورة (UUID)', 'تاريخ الفاتورة', 'طريقة الدفع', 'المجموع الإجمالي'];
    const csvContent = BOM + [headers.join(','), ...filteredInvoices.map((invoice) => `${invoice._id},${formatDate(invoice.created_at)},${invoice.paymentMethod},${invoice.total}`)].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'invoices.csv';
    link.click();
  };

  const toggleMainSidebar = () => {
    setShowMainSidebar(!showMainSidebar);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="bg-[#F8F9FD] min-h-screen font-sans" dir="rtl">
      <Sidebar showMainSidebar={showMainSidebar} toggleMainSidebar={toggleMainSidebar} />
      <Header
        toggleMainSidebar={toggleMainSidebar}
        handleLogout={() => {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('currentShift');
          navigate('/');
        }}
      />

      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-[#2B3674]">الفواتير الحديثة</h2>
            <span className="text-sm text-[#707EAE]">جميع الفواتير لهذا اليوم</span>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-3">
              <div className="relative">
                <button onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')} className="bg-[#F4F7FE] text-[#4F5E83] px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[#EDF0F9] transition-colors">
                  <span>ترتيب حسب: {sortOrder === 'newest' ? 'الأحدث' : 'الأقدم'}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* <div className="relative">
                <button 
                  onClick={() => setPaymentFilter(paymentFilter === 'all' ? 'cash' : 'all')}
                  className="bg-[#F4F7FE] text-[#4F5E83] px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[#EDF0F9] transition-colors"
                >
                  <span>جميع طرق الدفع</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div> */}
            </div>

            <div className="relative">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث عن فاتورة" className="bg-[#F4F7FE] rounded-lg py-2 px-4 pl-10 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#4F5E83]" />
            </div>
          </div>

          <div className="relative overflow-x-auto rounded-lg border border-[#F4F7FE]">
            <table className="w-full text-sm text-right">
              <thead className="text-[#4F5E83] bg-[#F4F7FE]">
                <tr>
                  <th className="px-6 py-4 font-medium">رقم الفاتورة (UUID)</th>
                  <th className="px-6 py-4 font-medium">تاريخ الفاتورة</th>
                  <th className="px-6 py-4 font-medium">طريقة الدفع</th>
                  <th className="px-6 py-4 font-medium">المجموع الإجمالي</th>
                  <th className="px-6 py-4 font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredInvoices().map((invoice, index) => (
                  <tr key={index} className="bg-white border-b border-[#F4F7FE] hover:bg-[#F8F9FD] transition-colors">
                    <td className="px-6 py-4 text-[#2B3674]">{invoice._id}</td>
                    <td className="px-6 py-4 text-[#2B3674]">
                      {new Date(invoice.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${invoice.status === 'cash' ? 'bg-green-500' : invoice.status === 'card' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                        <span className="text-[#2B3674]">{invoice.paymentMethod}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#2B3674]">{invoice.total}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        {/* <button 
                          onClick={() => deleteInvoice(invoice._id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button> */}
                        <button onClick={() => setSelectedInvoice(invoice)} className="text-blue-500 hover:text-blue-700 transition-colors">
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={exportToCSV} className="mt-6 bg-[#F4F7FE] text-[#4F5E83] px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[#EDF0F9] transition-colors">
            <Download className="w-4 h-4" />
            <span>تصدير</span>
          </button>
        </div>
      </div>

      {/* Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-[#2B3674]">تفاصيل الفاتورة</h3>
              <button onClick={() => setSelectedInvoice(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500">رقم الفاتورة</p>
                  <p className="font-medium">{selectedInvoice._id}</p>
                </div>
                <div>
                  <p className="text-gray-500">التاريخ</p>
                  <p className="font-medium">{formatDate(selectedInvoice.created_at)}</p>
                </div>
                <div>
                  <p className="text-gray-500">طريقة الدفع</p>
                  <p className="font-medium">{selectedInvoice.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-gray-500">المبلغ المدفوع</p>
                  <p className="font-medium">{selectedInvoice.amountPaid}</p>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-semibold mb-2">المنتجات</h4>
                <div className="border rounded-lg">
                  {selectedInvoice.items.map((item, index) => (
                    <div key={index} className="p-4 border-b last:border-b-0">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{item.name_ar}</p>
                          <p className="text-sm text-gray-500">الكمية: {item.quantity}</p>
                        </div>
                        <p className="font-medium">{item.price} د.أ</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <div className="flex justify-between">
                  <p className="text-gray-500">المجموع الفرعي</p>
                  <p className="font-medium">{selectedInvoice.subtotal} د.أ</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-gray-500">الضريبة</p>
                  <p className="font-medium">{selectedInvoice.tax} د.أ</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-gray-500">الخصم</p>
                  <p className="font-medium">{selectedInvoice.discount} د.أ</p>
                </div>
                <div className="flex justify-between text-lg font-semibold">
                  <p>المجموع الإجمالي</p>
                  <p>{selectedInvoice.total} د.أ</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
