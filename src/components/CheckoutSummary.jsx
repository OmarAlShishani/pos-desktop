import { Layers2, Calculator } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import Decimal from 'decimal.js';
import axios from 'axios';
import { toast } from 'react-toastify';

const CheckoutSummary = ({
  calculateTotals,
  selectedPaymentMethod,
  handlePaymentMethodSelect,
  handlePayButtonClick,
  cashImg,
  cardImg,
  debtImg,
  cart,
  appliedDiscount,
  isWaitingForNFC,
  nfcPendingOrderId,
  currentOrderId,
  onDiscountClick,
  onCancelNFC,
  pendingDiscountRequests = {},
  setShowCashPopup,
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isProcessingDebit, setIsProcessingDebit] = useState(false);
  const [currentTotals, setCurrentTotals] = useState(calculateTotals());
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isButtonClicked, setIsButtonClicked] = useState(false);

  useEffect(() => {
    const newTotals = calculateTotals();
    setCurrentTotals({
      ...newTotals,
      subtotal: new Decimal(newTotals.subtotal || 0).toFixed(4),
      tax: new Decimal(newTotals.tax || 0).toFixed(4),
      total: new Decimal(newTotals.total || 0).toFixed(4),
      itemCount: new Decimal(newTotals.itemCount || 0).toFixed(4),
    });
  }, [appliedDiscount, cart, calculateTotals]);

  // Use currentTotals instead of calling calculateTotals() directly
  const totals = currentTotals;

  // Format numbers with 4 decimal places using Decimal.js
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0.0000';
    return new Decimal(num).toFixed(4);
  };

  const handleCardPayment = () => {
    setShowConfirmDialog(true);
  };

  const confirmCardPayment = async () => {
    // Add immediate return if already processing
    if (isProcessingPayment) return;

    try {
      setIsProcessingPayment(true);
      setShowConfirmDialog(false);

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/sale`, {
        currencyCode: process.env.REACT_APP_CURRENCY_CODE,
        merchantKey: process.env.REACT_APP_MERCHANT_KEY,
        mid: process.env.REACT_APP_MID,
        tid: process.env.REACT_APP_TID,
        amount: totals.subtotal.toString(),
        invoiceNumber: '1',
        receiptNote: '1',
        referenceNumber: '1',
      });

      if (response.data.success) {
        toast.success(`تم تحويل المبلغ: ${formatNumber(totals.subtotal)} `, {
          position: 'top-right',
          autoClose: 1000,
          theme: 'colored',
        });
        handlePayButtonClick();
      } else {
        toast.error(`فشلت معالجة البطاقة: ${response.data.responseText}`, {
          position: 'top-right',
          autoClose: 1000,
          theme: 'colored',
        });
      }
    } catch (error) {
      toast.error('فشل في تحويل المبلغ. يرجى المحاولة مرة أخرى.', {
        position: 'top-right',
        autoClose: 1000,
        theme: 'colored',
      });
    } finally {
      // Add delay before resetting processing state
      setTimeout(() => {
        setIsProcessingPayment(false);
      }, 1000);
    }
  };

  const handleDebitPayment = async () => {
    try {
      setIsProcessingDebit(true);

      // Simulate API call with a delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock successful response
      const response = { success: true };

      if (response.success) {
        toast.success(`تم تسجيل المبلغ في الذمم: ${formatNumber(totals.subtotal)} `, {
          position: 'top-center',
          autoClose: 3000,
          theme: 'colored',
        });
        handlePayButtonClick();
      } else {
        toast.error('فشل في تسجيل المبلغ في الذمم', {
          position: 'top-center',
          autoClose: 3000,
          theme: 'colored',
        });
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء معالجة الذمم', {
        position: 'top-center',
        autoClose: 3000,
        theme: 'colored',
      });
      console.error('Debit payment error:', error);
    } finally {
      setIsProcessingDebit(false);
    }
  };

  const handlePaymentClick = () => {
    // Add immediate return if either processing flag is true
    if (isProcessingPayment || isButtonClicked) {
      return;
    }
    if (!currentOrderId) {
      return;
    }

    setIsProcessingPayment(true);
    setIsButtonClicked(true);

    // Check for pending discount request for current order only
    if (pendingDiscountRequests[currentOrderId]) {
      toast.info('يرجى انتظار موافقة الإدارة على الخصم', {
        position: 'top-center',
        autoClose: 3000,
        theme: 'colored',
      });
      setIsProcessingPayment(false);
      setIsButtonClicked(false);
      return;
    }

    // Show cash popup if payment method is "double"
    if (selectedPaymentMethod === 'double') {
      setShowCashPopup(true);
      setIsProcessingPayment(false);
      setIsButtonClicked(false);
      return;
    }

    if (selectedPaymentMethod === 'debit') {
      handlePayButtonClick('requireNFC');
    } else {
      handlePayButtonClick();
    }

    // Add delay before resetting states
    setTimeout(() => {
      setIsProcessingPayment(false);
      setIsButtonClicked(false);
    }, 1000);
  };

  const isCurrentOrderWaitingForNFC = isWaitingForNFC && nfcPendingOrderId === currentOrderId;
  const hasPendingDiscount = Boolean(pendingDiscountRequests[currentOrderId]);

  // Reset processing state when discount request is approved/rejected
  useEffect(() => {
    if (!hasPendingDiscount) {
      setIsProcessingPayment(false);
    }
  }, [hasPendingDiscount]);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-6 h-full flex flex-col">
        <div className="flex justify-between flex-grow">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm font-medium">عدد المواد</span>
              <span className="text-gray-800 text-base font-semibold">{totals.itemCount || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm font-medium">المجموع الفرعي &nbsp;</span>
              <span className="text-gray-800 text-base font-semibold">{formatNumber(totals.subtotal)}</span>
            </div>
            {totals.tax > 0 && (
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-sm font-medium">الضريبة</span>
                <span className="text-base font-semibold">{formatNumber(totals.tax)}</span>
              </div>
            )}
            {appliedDiscount > 0 && (
              <div className="flex justify-between items-center text-green-600">
                <span className="text-sm font-medium">الخصم</span>
                <span className="text-base font-semibold">{formatNumber(appliedDiscount)}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <p className="text-xl text-left font-bold text-gray-900">المجموع</p>
              <button onClick={() => setShowCashPopup(true)} className="p-1 hover:bg-gray-100 rounded-full" title="فتح آلة حاسبة">
                <Calculator size={16} className="text-gray-500" />
              </button>
            </div>
            <p className="text-2xl font-bold text-left text-blue-600 mt-4">{formatNumber(totals.total)}</p>
          </div>
        </div>

        <button onClick={onDiscountClick} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          إضافة خصم
        </button>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            className={`px-4 py-2.5 rounded-lg flex items-center justify-center text-sm font-medium transition-colors duration-200 ${selectedPaymentMethod === 'cash' ? 'bg-green-500 text-white shadow-sm hover:bg-green-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => handlePaymentMethodSelect('cash')}
          >
            <img src={cashImg} alt="Cash" className="w-5 h-5 mr-2 object-contain" /> &nbsp; كاش &nbsp;
          </button>
          <button
            className={`px-4 py-2.5 rounded-lg flex items-center justify-center text-sm font-medium transition-colors duration-200 ${selectedPaymentMethod === 'card' ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => {
              handlePaymentMethodSelect('card');
              handleCardPayment();
            }}
          >
            <img src={cardImg} alt="Card" className="w-5 h-5 mr-2 object-contain" /> &nbsp; بطاقة &nbsp;
          </button>
          <button
            className={`px-4 py-2.5 rounded-lg flex items-center justify-center text-sm font-medium transition-colors duration-200 ${selectedPaymentMethod === 'double' ? 'bg-red-500 text-white shadow-sm hover:bg-red-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => handlePaymentMethodSelect('double')}
          >
            <Layers2 size={16} className="mr-2 object-contain" /> &nbsp; مزدوج &nbsp;
          </button>
          <button
            className={`px-4 py-2.5 rounded-lg flex items-center justify-center text-sm font-medium transition-colors duration-200 ${selectedPaymentMethod === 'debit' ? 'bg-yellow-500 text-white shadow-sm hover:bg-yellow-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => handlePaymentMethodSelect('debit')}
          >
            <img src={debtImg} alt="Debit" className="w-5 h-5 mr-2 object-contain" /> &nbsp; ذمم &nbsp;
          </button>
        </div>

        <div className="mt-6">
          <button
            className={`w-full text-white py-3 rounded-xl transition-colors duration-200 ${isCurrentOrderWaitingForNFC ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
            onClick={isCurrentOrderWaitingForNFC ? onCancelNFC : handlePaymentClick}
            disabled={cart.length === 0 || isProcessingDebit || hasPendingDiscount || isProcessingPayment || isButtonClicked}
            title={hasPendingDiscount ? 'في انتظار موافقة الإدارة على الخصم' : ''}
          >
            {isCurrentOrderWaitingForNFC ? 'بانتظار NFC (انقر للإلغاء)' : hasPendingDiscount ? 'في انتظار موافقة الخصم...' : isProcessingDebit ? 'جاري المعالجة...' : <span className="text-base font-semibold">{`دفع ${formatNumber(totals.total)} `}</span>}
          </button>
        </div>
      </div>

      {/* Add confirmation dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-right">هل أنت متأكد أنك تريد تحويل المبلغ إلى جهاز البطاقة؟</h3>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowConfirmDialog(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200" disabled={isProcessingPayment}>
                إلغاء
              </button>
              <button onClick={confirmCardPayment} className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg ${isProcessingPayment ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`} disabled={isProcessingPayment}>
                {isProcessingPayment ? 'جاري المعالجة...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CheckoutSummary;
