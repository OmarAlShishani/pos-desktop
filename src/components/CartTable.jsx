import { Minus, Plus, Trash, X, Edit2 } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import Decimal from 'decimal.js';

const NumberPad = ({ isOpen, onClose, onConfirm, currentValue, title = 'أدخل الكمية', allowDecimal = false }) => {
  const [value, setValue] = useState(currentValue.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when popup opens
  useEffect(() => {
    if (isOpen) {
      setValue(currentValue.toString());
      setIsSubmitting(false);
    }
  }, [isOpen, currentValue]);

  const handleClose = () => {
    setValue('');
    onClose();
  };

  if (!isOpen) return null;

  const handleNumberInput = (num) => {
    setValue((prev) => {
      // If starting with decimal point, add leading zero
      if (num === '.' && prev === '') {
        return '0.';
      }

      // Prevent multiple decimal points
      if (num === '.' && prev.includes('.')) {
        return prev;
      }

      const newValue = prev + num;

      // Split into whole and decimal parts
      const [wholePart, decimalPart] = newValue.split('.');

      // Check if whole part exceeds 4 digits
      if (wholePart.length > 4) {
        return prev;
      }

      // Check decimal places (max 4)
      if (decimalPart && decimalPart.length > 4) {
        return prev;
      }

      return newValue;
    });
  };

  const handleBackspace = () => {
    setValue((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setValue('');
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;

    const newValue = new Decimal(value || 0);
    if (newValue.greaterThan(0) && newValue.lessThanOrEqualTo(9999)) {
      setIsSubmitting(true);
      try {
        await onConfirm(newValue.toNumber());
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <input type="text" value={value} readOnly className="border-2 border-gray-300 p-4 mb-4 w-full text-right text-3xl rounded-lg" />

        <div className="grid grid-cols-3 gap-4">
          {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
            <button key={num} onClick={() => handleNumberInput(num.toString())} className="bg-gray-200 p-6 rounded-lg text-2xl font-semibold hover:bg-gray-300 transition-colors">
              {num}
            </button>
          ))}
          <button onClick={handleClear} className="bg-yellow-200 p-6 rounded-lg text-2xl font-semibold hover:bg-yellow-300 transition-colors">
            C
          </button>
          <button onClick={() => handleNumberInput('0')} className="bg-gray-200 p-6 rounded-lg text-2xl font-semibold hover:bg-gray-300 transition-colors">
            0
          </button>
          <button onClick={() => handleNumberInput('.')} className="bg-gray-200 p-6 rounded-lg text-2xl font-semibold hover:bg-gray-300 transition-colors">
            .
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleConfirm}
            className={`bg-green-500 text-white px-6 py-3 rounded-lg text-xl 
              font-semibold hover:bg-green-600 transition-colors
              ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!value || new Decimal(value || 0).lessThanOrEqualTo(0) || isSubmitting}
          >
            {isSubmitting ? 'جاري التنفيذ...' : 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CartTable = ({ cart = [], handleQuantityChange, removeProductFromCart, pendingDeletions = {}, pendingDiscountRequest = null, appliedDiscount = 0, isWaitingForNFC = false, setCart, setOrders, currentOrderId, updateItemPrice, pendingPriceChanges = {} }) => {
  const [quantityPopup, setQuantityPopup] = useState({
    isOpen: false,
    itemId: null,
    currentValue: 1,
  });

  const [pricePopup, setPricePopup] = useState({
    isOpen: false,
    itemId: null,
    itemKey: null,
    currentPrice: 0,
  });

  const tableBodyRef = useRef(null);

  useEffect(() => {
    if (tableBodyRef.current) {
      tableBodyRef.current.scrollTop = tableBodyRef.current.scrollHeight;

      const lastRow = tableBodyRef.current.querySelector('tbody tr:last-child');
      if (lastRow) {
        lastRow.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [cart]);

  const handleQuantityPopupConfirm = async (newValue) => {
    const items = cart.filter((i) => i._id === quantityPopup.itemId);
    const targetItem = items.find((i) => !i.is_offer_applied) || items[0];

    if (!targetItem) return;

    // If the item has offers and we're using the quantity popup
    if (targetItem.has_offer && targetItem.offers) {
      handleQuantityChange(quantityPopup.itemId, newValue, true);
    } else {
      // For non-offer items or regular quantity updates
      const change = newValue - targetItem.quantity;
      handleQuantityChange(quantityPopup.itemId, change);
    }

    setQuantityPopup({ isOpen: false, itemId: null, currentValue: 1 });
  };

  const handleQuantityPopupOpen = (itemId) => {
    const targetItem = cart.filter((item) => item._id === itemId).find((item) => !item.is_offer_applied) || cart.find((item) => item._id === itemId);

    setQuantityPopup({
      isOpen: true,
      itemId: itemId,
      currentValue: targetItem.quantity,
    });
  };

  const handlePriceEdit = (item) => {
    setPricePopup({
      isOpen: true,
      itemId: item._id,
      itemKey: item.offer_group_id || item.added_at,
      currentPrice: item.price,
    });
  };

  const handlePricePopupConfirm = (newPrice) => {
    if (pricePopup.itemId && pricePopup.itemKey) {
      updateItemPrice(pricePopup.itemId, newPrice, pricePopup.itemKey);
    }
    setPricePopup({ isOpen: false, itemId: null, itemKey: null, currentPrice: 0 });
  };

  const renderQuantityCell = (item) => (
    <td className="px-1 py-2 text-center text-[#4F5E83]">
      {item.is_scalable_item ? (
        <div className="flex items-center justify-center">
          <span className="w-16 text-center border rounded p-1">{new Decimal(item.quantity).isInteger() ? new Decimal(item.quantity).toString() : new Decimal(item.quantity).toFixed(4)} كغ</span>
        </div>
      ) : item.is_offer_applied ? (
        <div className="flex items-center justify-center">
          <span className="w-12 text-center border rounded p-1 bg-green-50">{new Decimal(item.quantity).isInteger() ? new Decimal(item.quantity).toString() : new Decimal(item.quantity).toFixed(4)}</span>
        </div>
      ) : (
        <div className="flex items-center justify-center space-x-reverse space-x-1">
          <button onClick={() => handleQuantityChange(item._id, 1)} className="p-1 hover:bg-gray-100 rounded">
            <Plus size={12} className="text-green-500" />
          </button>
          <button onClick={() => handleQuantityPopupOpen(item._id)} className="w-12 text-center border rounded p-1 hover:bg-gray-50" disabled={pendingDeletions && pendingDeletions[item._id]}>
            {new Decimal(item.quantity).isInteger() ? new Decimal(item.quantity).toString() : new Decimal(item.quantity).toFixed(4)}
          </button>
          <button onClick={() => handleQuantityChange(item._id, -1)} className="p-1 hover:bg-gray-100 rounded">
            <Minus size={12} className="text-red-500" />
          </button>
        </div>
      )}
    </td>
  );

  const renderPriceCell = (item) => (
    <td className="px-1 py-2 text-center text-[#4F5E83] whitespace-nowrap">
      <div className="flex items-center justify-center gap-1">
        <b>{item.is_scalable_item ? `${new Decimal(item.kilo_price || item.original_price || 0).toFixed(4)}د/كغ` : `${new Decimal(item.price || 0).toFixed(4)}د`}</b>
        {!item.is_offer_applied && (
          <button
            onClick={() => handlePriceEdit(item)}
            className={`p-1 hover:bg-gray-100 rounded ${pendingPriceChanges?.[`${currentOrderId}-${item._id}-${item.offer_group_id || item.added_at}`] ? 'opacity-50' : ''}`}
            disabled={pendingPriceChanges?.[`${currentOrderId}-${item._id}-${item.offer_group_id || item.added_at}`]}
          >
            {pendingPriceChanges?.[`${currentOrderId}-${item._id}-${item.offer_group_id || item.added_at}`] ? <div className="animate-spin h-3 w-3 border-2 border-yellow-500 rounded-full border-t-transparent" /> : <Edit2 size={12} className="text-blue-500" />}
          </button>
        )}
      </div>
    </td>
  );

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Clean up any pending state when component unmounts
      setQuantityPopup({
        isOpen: false,
        itemId: null,
        currentValue: 1,
      });
    };
  }, []);

  return (
    <div className="relative sm:rounded-lg">
      {(pendingDiscountRequest || isWaitingForNFC) && (
        <div className="absolute inset-0 bg-yellow-50 bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <span className="text-yellow-600 font-medium">{isWaitingForNFC ? 'في انتظار مسح بطاقة NFC...' : 'طلب الخصم قيد المعالجة...'}</span>
          </div>
        </div>
      )}
      <div className="max-h-[calc(100vh-320px)] overflow-y-auto shadow-md" ref={tableBodyRef}>
        <table className="w-full text-[11px] md:text-xs text-center text-gray-500 dark:text-gray-400" dir="rtl">
          <thead className="text-[11px] text-gray-700 uppercase bg-[#F5F9FF] sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-1 py-2 text-center text-[#4F5E83] whitespace-nowrap">
                اسم المادة
              </th>
              <th scope="col" className="px-1 py-2 text-center text-[#4F5E83] w-[90px]">
                الباركود
              </th>
              <th scope="col" className="px-1 py-2 text-center text-[#4F5E83] w-[90px]">
                الكمية
              </th>
              <th scope="col" className="px-1 py-2 text-center text-[#4F5E83] w-[70px]">
                السعر
              </th>
              <th scope="col" className="px-1 py-2 text-center text-[#4F5E83] w-[70px]">
                الإجمالي
              </th>
              <th scope="col" className="px-1 py-2 text-center text-[#4F5E83] w-[50px]">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody>
            {cart.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-4">
                  لا توجد مواد في السلة
                </td>
              </tr>
            ) : (
              cart.map((item, index) => (
                <tr className={`border-b border-gray-200 transition-all duration-300 hover:bg-gray-50 ${item.is_offer_applied ? 'bg-green-50' : ''} ${pendingDeletions && pendingDeletions[item._id] ? 'bg-yellow-50' : ''}`} key={`${item._id}-${item.added_at}-${index}`}>
                  <td className="px-1 py-2 text-center text-[#4F5E83] max-w-[100px]">
                    <div className="overflow-hidden">
                      <div className="line-clamp-2 text-xs">
                        {item.name_ar}
                        {item.is_offer_applied && (
                          <span className="block text-green-600 text-[10px]">
                            {item.offer_details.name}
                            <br />
                            توفير: {new Decimal(item.offer_details.savings).toFixed(3)}د
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-1 py-2 text-center text-[#4F5E83] truncate">{item?.barcode}</td>
                  {renderQuantityCell(item)}
                  {renderPriceCell(item)}
                  <td className="px-1 py-2 text-center text-[#4F5E83] whitespace-nowrap">
                    <b>{item.is_scalable_item ? new Decimal(item.kilo_price || item.original_price || 0).times(item.quantity || 0).toFixed(4) : new Decimal(item.price || 0).times(item.quantity || 0).toFixed(4)}د</b>
                  </td>
                  <td className="px-1 py-2 text-center">
                    <button onClick={() => removeProductFromCart(item._id)} disabled={pendingDeletions && pendingDeletions[item._id]} className={`p-1.5 hover:bg-gray-100 rounded mx-auto ${pendingDeletions && pendingDeletions[item._id] ? 'opacity-50' : ''}`}>
                      {pendingDeletions && pendingDeletions[item._id] ? <div className="animate-spin h-3 w-3 border-2 border-yellow-500 rounded-full border-t-transparent" /> : <Trash className="text-red-500" size={14} />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <NumberPad isOpen={quantityPopup.isOpen} onClose={() => setQuantityPopup({ isOpen: false, itemId: null, currentValue: 1 })} onConfirm={handleQuantityPopupConfirm} currentValue={quantityPopup.currentValue} title="أدخل الكمية" />

      <NumberPad isOpen={pricePopup.isOpen} onClose={() => setPricePopup({ isOpen: false, itemId: null, itemKey: null, currentPrice: 0 })} onConfirm={handlePricePopupConfirm} currentValue={pricePopup.currentPrice} title="أدخل السعر" allowDecimal={true} />
    </div>
  );
};

export default CartTable;
