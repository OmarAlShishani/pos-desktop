import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import db from '../pouchdb';
import { toast } from 'react-toastify';

const BarcodeInputPopup = ({ isOpen, onClose, onSubmit }) => {
  const [barcode, setBarcode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBarcode('');
      setIsProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const findProductByBarcode = async (barcode) => {
    try {
      const product = await db.get(barcode);
      return product;
    } catch (error) {
      toast.error('المنتج غير موجود', {
        position: 'top-right',
        autoClose: 1000,
        theme: 'colored',
      });
      return null;
    }
  };

  const handleNumberInput = async (value) => {
    if (isProcessing) return;

    const newBarcode = barcode.length >= 13 ? barcode : barcode + value;
    setBarcode(newBarcode);

    // If barcode reaches 13 digits (standard EAN-13 length), automatically search
    if (newBarcode.length === 13) {
      setIsProcessing(true);
      try {
        const product = await findProductByBarcode(newBarcode);
        if (product) {
          onSubmit(product);
          setBarcode('');
          onClose();
        }
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleBackspace = () => {
    setBarcode((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setBarcode('');
  };

  const handleSubmit = async () => {
    if (!barcode.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const product = await findProductByBarcode(barcode);
      if (product) {
        onSubmit(product);
        setBarcode('');
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">إدخال باركود</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <input type="text" value={barcode} readOnly className="w-full border-2 border-gray-300 p-4 mb-4 text-right text-3xl rounded-lg" placeholder="أدخل الباركود" />

        <div className="grid grid-cols-3 gap-4 mb-4">
          {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
            <button key={num} onClick={() => handleNumberInput(num.toString())} className="bg-gray-200 p-6 rounded-lg text-2xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isProcessing}>
              {num}
            </button>
          ))}
          <button onClick={handleClear} className="bg-yellow-200 p-6 rounded-lg text-xl font-semibold hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isProcessing}>
            محو
          </button>
          <button onClick={() => handleNumberInput('0')} className="bg-gray-200 p-6 rounded-lg text-2xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isProcessing}>
            0
          </button>
          <button onClick={handleBackspace} className="bg-red-200 p-6 rounded-lg text-2xl font-semibold hover:bg-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isProcessing}>
            ←
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 px-6 py-3 rounded-lg text-xl font-semibold transition-colors" disabled={isProcessing}>
            إلغاء
          </button>
          <button onClick={handleSubmit} className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-xl font-semibold transition-colors ${!barcode.trim() || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!barcode.trim() || isProcessing}>
            {isProcessing ? 'جاري البحث...' : 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeInputPopup;
