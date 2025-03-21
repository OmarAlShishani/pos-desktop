import React, { useState, useRef } from 'react';
import { X, Barcode } from 'lucide-react';
import BarcodeScannerComponent from './BarcodeScannerComponent';
import db from '../pouchdb';
import { toast } from 'react-toastify';

/**
 * Quick Barcode Scanner Component
 * A fast, standalone component for quick barcode scanning
 * Optimized for high-speed scanning with minimal delays
 */
const QuickBarcodeScanner = ({ isOpen, onClose, onProductFound }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [lastScannedProduct, setLastScannedProduct] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const processingTimeoutRef = useRef(null);

  if (!isOpen) return null;

  const handleProcessingStart = () => {
    setIsProcessing(true);
    setErrorMessage('');
  };

  const handleProcessingEnd = () => {
    setIsProcessing(false);
  };

  const handleProductNotFound = (barcode) => {
    setErrorMessage(`المنتج غير موجود: ${barcode}`);
    // Show error toast with a shorter display time
    toast.error(`المنتج غير موجود: ${barcode}`, {
      position: 'top-right',
      autoClose: 1500, // Reduced from 2000ms
    });
  };

  const handleBarcodeScan = async (barcodeData) => {
    setLastScannedBarcode(barcodeData);

    try {
      // Try to find the product in the database
      const product = await db.get(barcodeData);

      if (product) {
        setLastScannedProduct(product);
        setErrorMessage('');

        // Call the callback function with the found product
        if (onProductFound) {
          onProductFound(product);
        }

        // Show success toast with shorter display time
        toast.success(`تم العثور على المنتج: ${product.name}`, {
          position: 'top-right',
          autoClose: 1500, // Reduced from 2000ms
        });
      }
    } catch (error) {
      console.error('Error finding product:', error);
      setLastScannedProduct(null);
      handleProductNotFound(barcodeData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-11/12 max-w-md mx-auto relative">
        <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-700" onClick={onClose}>
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-center">الماسح الضوئي السريع</h2>

        <div className="text-center mb-4">
          <div className="w-16 h-16 mx-auto mb-2">
            <Barcode size={64} className="text-blue-600" />
          </div>
          <p className="text-gray-600 text-sm">قم بمسح باركود المنتج باستخدام الماسح الضوئي</p>
        </div>

        {lastScannedBarcode && (
          <div className="bg-gray-100 p-3 rounded-lg mb-3 text-center">
            <p className="font-medium text-sm">آخر باركود تم مسحه:</p>
            <p className="text-lg font-bold">{lastScannedBarcode}</p>
          </div>
        )}

        {lastScannedProduct && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg mb-3 text-center">
            <p className="font-medium text-sm">المنتج:</p>
            <p className="text-lg font-bold">{lastScannedProduct.name}</p>
            <p className="text-lg font-bold text-green-600">{lastScannedProduct.price} د.أ</p>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-lg mb-3 text-center">
            <p className="text-red-600">{errorMessage}</p>
          </div>
        )}

        <div className={`mt-3 text-center ${isProcessing ? 'opacity-70' : ''}`}>
          <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{isProcessing ? 'جاري المسح...' : 'جاهز للمسح'}</div>
        </div>

        {/* Include the optimized barcode scanner component */}
        <BarcodeScannerComponent enabled={isOpen} onScan={handleBarcodeScan} onProcessingStart={handleProcessingStart} onProcessingEnd={handleProcessingEnd} onNotFound={handleProductNotFound} />
      </div>
    </div>
  );
};

export default QuickBarcodeScanner;
