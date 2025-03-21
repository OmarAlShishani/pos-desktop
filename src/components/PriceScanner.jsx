import { useState } from 'react';
import { X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getPOSDateTime } from '../utils/dateUtils';
import db from '../pouchdb';
import { useBarcode } from '../hooks/useBarcode';

export const PriceScannerPopup = ({ isOpen, onClose }) => {
  const [product, setProduct] = useState(null);
  const [manualBarcode, setManualBarcode] = useState('');

  const handleClose = () => {
    setProduct(null); // Reset product state
    setManualBarcode(''); // Reset manual barcode input
    closeNotFoundPopup(); // Reset not found popup state
    onClose();
  };

  const handleProductFound = async (foundProduct) => {
    setProduct(foundProduct);

    // Log the price check
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const terminal_id = localStorage.getItem('posTerminal');
      const posDateTime = await getPOSDateTime();

      const logEntry = {
        _id: uuidv4(),
        document_type: 'log',
        statement: `تم فحص سعر المنتج ${foundProduct.name} (${foundProduct.barcode}) بواسطة المستخدم ${currentUser.username}`,
        user_id: currentUser.id,
        terminal_id: terminal_id,
        created_at: posDateTime,
        realworld_date: new Date().toISOString(),
      };

      await db.put(logEntry);
    } catch (error) {
      console.error('Error logging price check:', error);
    }
  };

  const { BarcodeReader, showNotFoundPopup, notFoundBarcode, closeNotFoundPopup } = useBarcode(
    handleProductFound,
    isOpen,
    async () => {}, // Replace null with empty async function for ensureActiveOrder
    [], // empty cart
    () => {}, // dummy updateQuantity function
  );

  const handleNewScan = () => {
    setProduct(null);
  };

  const handleManualSearch = async (e) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;

    try {
      const result = await db.find({
        selector: {
          document_type: 'product',
          barcode: manualBarcode,
        },
      });

      if (result.docs.length > 0) {
        handleProductFound(result.docs[0]);
      } else {
        closeNotFoundPopup();
      }
    } catch (error) {
      console.error('Error searching product:', error);
    }

    setManualBarcode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {BarcodeReader}
      <div className="bg-white rounded-lg w-full max-w-md mx-4 overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">فحص سعر مادة</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {showNotFoundPopup ? (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">المنتج غير معرف في النظام ({notFoundBarcode})</div>
              <button
                onClick={() => {
                  closeNotFoundPopup();
                  handleNewScan();
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg transition-colors"
              >
                فحص منتج آخر
              </button>
            </div>
          ) : !product ? (
            <div className="space-y-6">
              <form onSubmit={handleManualSearch} className="space-y-3">
                <div className="flex gap-2">
                  <input type="text" value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)} placeholder="أدّخل الباركود يدويًا..." className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-right" />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    بحث
                  </button>
                </div>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">أو</span>
                </div>
              </div>

              <div className="border-2 border-dashed border-blue-200 rounded-lg p-8 bg-blue-50">
                <div className="w-48 h-48 mx-auto">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-blue-900">
                    <path fill="currentColor" d="M10,10 L30,10 L30,15 L15,15 L15,30 L10,30 Z" />
                    <path fill="currentColor" d="M70,10 L90,10 L90,30 L85,30 L85,15 L70,15 Z" />
                    <path fill="currentColor" d="M10,70 L10,90 L30,90 L30,85 L15,85 L15,70 Z" />
                    <path fill="currentColor" d="M70,85 L70,90 L90,90 L90,70 L85,70 L85,85 Z" />
                    <rect x="35" y="40" width="5" height="20" fill="currentColor" />
                    <rect x="45" y="40" width="5" height="20" fill="currentColor" />
                    <rect x="55" y="40" width="5" height="20" fill="currentColor" />
                  </svg>
                </div>
                <p className="text-center text-sm text-gray-600 mt-4">يرجى مسح المنتج باستخدام ماسح الكود</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <img src={product.image ? `${process.env.REACT_APP_PUBLIC_IMAGE_URL}/${product.image}` : '/api/placeholder/200/200'} alt={product.name} className="w-32 h-32 object-contain mx-auto rounded-lg" />
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
                <p className="text-3xl font-bold text-blue-600">{product.price} د.أ</p>
              </div>
              <button onClick={handleNewScan} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg transition-colors">
                فحص منتج آخر
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PriceScannerPopup;
