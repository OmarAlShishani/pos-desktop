import { X, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import logo from '../assets/images/logo.png';
import db from '../pouchdb';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import { getPOSDateTime } from '../utils/dateUtils';

export const ExpenseVoucherPopup = ({ isOpen, onClose }) => {
  const [items, setItems] = useState([
    {
      statement: '',
      price: 0,
    },
  ]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recipient, setRecipient] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset isSaving when component opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
    }
  }, [isOpen]);

  // Create a wrapper for onClose to ensure isSaving is reset
  const handleClose = () => {
    setIsSaving(false);
    onClose();
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
  };

  const updateShiftAmount = async (user_id, amount) => {
    try {
      const result = await db.query('pos_index/shifts_by_all', {
        include_docs: true,
        descending: true,
        reduce: false,
      });

      const openShift = result.rows.map((row) => row.doc).find((doc) => doc.user_id === user_id && doc.is_closed === false);

      if (openShift) {
        const updatedShift = {
          ...openShift,
          amount: (openShift.amount || 0) - amount,
        };
        await db.put(updatedShift);
      }
    } catch (error) {
      console.error('Error updating shift amount:', error);
      toast.error('خطأ في تحديث رصيد الموظف');
    }
  };

  const saveVoucher = async (printAfterSave = false) => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser'));
      const user_id = currentUser?.id || 'Unknown User';
      const terminal_id = localStorage.getItem('posTerminal');
      const shift_id = localStorage.getItem('currentShift');

      const posDateTime = await getPOSDateTime();

      if (!recipient.trim() || items[0].price <= 0) {
        toast.error('الرجاء إكمال جميع الحقول المطلوبة');
        return;
      }

      const voucherDoc = {
        _id: uuidv4(),
        document_type: 'voucher',
        type: 'expense',
        date,
        recipient,
        items: items.map(({ statement, price }) => ({
          statement,
          price,
        })),
        total: items[0].price,
        created_at: posDateTime,
        realworld_date: new Date().toISOString(),
        user_id,
        terminal_id,
        shift_id,
        user_name: currentUser?.username || 'Unknown User',
      };

      const logEntry = {
        _id: uuidv4(),
        statement: `تم إنشاء سند صرف لصالح ${recipient} بقيمة ${items[0].price} د.أ`,
        user_id: user_id,
        terminal_id: terminal_id,
        created_at: posDateTime,
        realworld_date: new Date().toISOString(),
        document_type: 'log',
        shift_id,
      };

      // Perform all database operations concurrently
      await Promise.all([db.put(voucherDoc), updateShiftAmount(user_id, items[0].price), db.put(logEntry)]);

      toast.success('تم حفظ سند الصرف بنجاح');

      // Reset form and close immediately after save
      setItems([{ statement: '', price: 0 }]);
      setRecipient('');
      setDate(new Date().toISOString().split('T')[0]);
      onClose();

      // Handle printing after the form is closed
      if (printAfterSave && typeof window !== 'undefined' && window.electronAPI) {
        try {
          const printResult = await window.electronAPI.printOrder(`
            <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>سند صرف</title>
                <style>
                  @page { margin: 0; }
                  body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 10px;
                    width: 72mm;
                    box-sizing: border-box;
                  }
                  .voucher {
                    display: flex;
                    flex-direction: column;
                    direction: rtl;
                  }
                  .header {
                    text-align: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px dashed #000;
                  }
                  .header h1 {
                    font-size: 18px;
                    margin: 0 0 5px 0;
                  }
                  .header h2 {
                    font-size: 16px;
                    margin: 5px 0;
                    color: #444;
                  }
                  .info-section {
                    margin-bottom: 15px;
                    font-size: 12px;
                  }
                  .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                  }
                  .amount-section {
                    border-top: 1px dashed #000;
                    border-bottom: 1px dashed #000;
                    padding: 10px 0;
                    margin: 10px 0;
                    font-size: 14px;
                  }
                  .amount-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                  }
                  .total-amount {
                    font-weight: bold;
                    font-size: 16px;
                  }
                  .footer {
                    text-align: center;
                    margin-top: 15px;
                    font-size: 10px;
                  }
                </style>
              </head>
              <body>
                <div class="voucher">
                  <div class="header">
                    <h1>سوبرماركت مسافر</h1>
                    <h2>سند صرف</h2>
                  </div>

                  <div class="info-section">
                    <div class="info-row">
                      <span>رقم السند:</span>
                      <span>${voucherDoc._id.slice(-6)}</span>
                    </div>
                    <div class="info-row">
                      <span>التاريخ:</span>
                      <span>${new Date(date).toLocaleDateString('ar-JO')}</span>
                    </div>
                    <div class="info-row">
                      <span>صرف لصالح:</span>
                      <span>${recipient}</span>
                    </div>
                  </div>

                  <div class="amount-section">
                    <div class="amount-row">
                      <span>البيان:</span>
                      <span>${items[0].statement || 'دفعة نقدية'}</span>
                    </div>
                    <div class="amount-row total-amount">
                      <span>المبلغ:</span>
                      <span>${items[0].price.toFixed(3)} د.أ</span>
                    </div>
                  </div>

                  <div class="footer">
                    <p>توقيع المستلم: ________________</p>
                    <p>توقيع المحاسب: ________________</p>
                  </div>
                </div>
              </body>
            </html>
          `);

          if (!printResult.success) {
            console.error('Print failed:', printResult.error);
            toast.error('فشل الطباعة. يرجى المحاولة مرة أخرى.');
          }
        } catch (printError) {
          console.error('Print error:', printError);
          toast.error('حدث خطأ أثناء الطباعة.');
        }
      }
    } catch (error) {
      console.error('Error saving voucher:', error);
      toast.error('خطأ في حفظ سند الصرف');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col h-screen z-50">
      <div className="flex justify-between items-center p-4 border-b bg-white shadow-sm">
        <h1 className="text-xl font-semibold text-right text-blue-900">سند صرف</h1>
        <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>
      </div>

      <div className="p-6 flex-1 max-w-5xl mx-auto w-full overflow-y-auto">
        <div className="flex justify-between items-start mb-8 bg-white p-6 rounded-lg shadow-sm">
          <div className="text-right w-full">
            <h2 className="text-2xl font-bold text-blue-900">سوبرماركت مسافر</h2>
          </div>
          <img src={logo} alt="Logo" className="h-16 ml-4" />
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <label className="block text-sm font-medium mb-2 text-gray-600">التاريخ</label>
            <input type="date" className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" value={date} onChange={(e) => setDate(e.target.value)} onFocus={handleInputFocus} onBlur={handleInputBlur} />
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <label className="block text-sm font-medium mb-2 text-gray-600">صرف لصالح</label>
            <input
              type="text"
              className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="صرف لصالح (اسم المستلم)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
        </div>

        <div className="mb-8 relative">
          <div className="bg-white border rounded-lg overflow-visible shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-4 text-right text-gray-600 font-semibold">البيان</th>
                  <th className="p-4 text-center text-gray-600 font-semibold">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2">
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      value={items[0].statement}
                      onChange={(e) => setItems([{ ...items[0], statement: e.target.value }])}
                      placeholder="البيان"
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1 justify-center">
                      <input type="number" className="w-24 p-2 rounded-lg bg-gray-50 text-center" value={items[0].price || ''} onChange={(e) => setItems([{ ...items[0], price: parseFloat(e.target.value) || 0 }])} min="0" onFocus={handleInputFocus} onBlur={handleInputBlur} />
                      <span className="text-gray-600">د.أ</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-between items-start bg-white p-6 rounded-lg shadow-sm">
          <div className="space-y-3 text-right">
            <p className="text-xl font-bold text-blue-900">المجموع الكلي: {items[0].price} د.أ</p>
          </div>
          <div className="space-x-3 rtl:space-x-reverse">
            <button onClick={() => saveVoucher(false)} disabled={isSaving} className={`px-6 py-3 ml-2 border rounded-lg transition-colors ${isSaving ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
              {isSaving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => saveVoucher(true)} disabled={isSaving} className={`px-6 py-3 rounded-lg transition-colors shadow-sm ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
              {isSaving ? 'جاري الحفظ...' : 'حفظ وطباعة'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseVoucherPopup;
