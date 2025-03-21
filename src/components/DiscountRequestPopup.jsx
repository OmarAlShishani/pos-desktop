import React, { useState } from 'react';
import { XCircle } from 'lucide-react';

const DiscountRequestPopup = ({ isOpen, onClose, onRequest, subtotal }) => {
  const [discountType, setDiscountType] = useState('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onRequest({
      type: discountType,
      value: parseFloat(discountValue),
      originalTotal: subtotal,
      reason: reason,
    });
    setDiscountType('fixed');
    setDiscountValue('');
    setReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">طلب خصم</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XCircle size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <button type="button" className={`flex-1 py-2 px-4 rounded-lg ${discountType === 'fixed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setDiscountType('fixed')}>
              مبلغ ثابت
            </button>
            <button type="button" className={`flex-1 py-2 px-4 rounded-lg ${discountType === 'percentage' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setDiscountType('percentage')}>
              نسبة مئوية
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{discountType === 'fixed' ? 'قيمة الخصم (د.أ)' : 'نسبة الخصم (%)'}</label>
            <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="w-full p-2 border rounded-lg" min="0" max={discountType === 'percentage' ? '100' : subtotal} step={discountType === 'percentage' ? '1' : '0.001'} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">سبب الخصم</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-2 border rounded-lg" required placeholder="أدخل سبب الخصم" />
          </div>

          <div className="text-left text-sm text-gray-500">{discountType === 'fixed' ? `الحد الأقصى: ${subtotal} د.أ` : 'الحد الأقصى: 100%'}</div>

          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
            إرسال طلب الخصم
          </button>
        </form>
      </div>
    </div>
  );
};

export default DiscountRequestPopup;
