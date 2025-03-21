import React, { useEffect } from 'react';
import errorSound from '../assets/sounds/error.mp3';

const ProductNotFoundPopup = ({ isOpen, onClose, barcode }) => {
  useEffect(() => {
    if (isOpen) {
      const audio = new Audio(errorSound);
      audio.play().catch((err) => console.error('Error playing sound:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="text-xl font-bold text-red-600 mb-4">المنتج غير موجود</div>
          <div className="text-gray-600 mb-4">
            الباركود المدخل غير موجود في النظام
            <div className="font-mono bg-gray-100 p-2 rounded mt-2 text-center">{barcode}</div>
          </div>
          <button onClick={onClose} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductNotFoundPopup;
