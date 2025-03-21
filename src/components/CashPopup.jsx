import { X } from 'lucide-react';
import React, { useState } from 'react';
import Decimal from 'decimal.js';

const CashPopup = ({ showCashPopup, setShowCashPopup, amountReceived, handleNumberInput, handleBackspace, handleClearInput, handleCashPayment, subtotal, pendingDiscountRequests = {}, currentOrderId, selectedPaymentMethod }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [cardAmount, setCardAmount] = useState('');
  const [activeInput, setActiveInput] = useState('cash'); // 'cash' or 'card'

  if (!showCashPopup) return null;

  const receivedAmount = new Decimal(amountReceived || 0);
  const cardAmountDecimal = new Decimal(cardAmount || 0);
  const subtotalDecimal = new Decimal(subtotal || 0);
  
  // For double payment, calculate total received and change
  const totalReceived = selectedPaymentMethod === 'double' 
    ? receivedAmount.plus(cardAmountDecimal)
    : receivedAmount;
  
  const change = totalReceived.minus(subtotalDecimal);
  const isPaymentAllowed = selectedPaymentMethod === 'double' 
    ? totalReceived.greaterThanOrEqualTo(subtotalDecimal)
    : receivedAmount.greaterThanOrEqualTo(subtotalDecimal);
    
  const hasPendingDiscount = Boolean(pendingDiscountRequests[currentOrderId]);

  const handlePaymentWithProcessing = async () => {
    if (isProcessing || isClicked) return;
    setIsClicked(true);
    setIsProcessing(true);
    try {
      // Always pass a valid cardAmount for double payment
      await handleCashPayment(
        selectedPaymentMethod === 'double' 
          ? { 
              cardAmount: cardAmount ? cardAmountDecimal.toNumber() : 0,
              cashAmount: receivedAmount.toNumber(),
              resetCardInput: () => setCardAmount('') // Pass the reset function
            } 
          : undefined
      );
      // Reset card amount after successful payment
      if (selectedPaymentMethod === 'double') {
        setCardAmount('');
      }
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setIsClicked(false);
      }, 1000);
    }
  };

  const handleInputSelect = (inputType) => {
    setActiveInput(inputType);
  };

  const handleInputChange = (value) => {
    if (activeInput === 'cash') {
      handleNumberInput(value);
    } else {
      setCardAmount((prev) => {
        // If starting with decimal point, add leading zero
        if (value === '.' && prev === '') {
          return '0.';
        }

        // Prevent multiple decimal points
        if (value === '.' && prev.includes('.')) {
          return prev;
        }

        const newAmount = prev + value;

        // Split into whole and decimal parts
        const [wholePart, decimalPart] = newAmount.split('.');

        // Check if whole part exceeds 6 digits
        if (wholePart.length > 6) {
          return prev;
        }

        // Check decimal places (max 3)
        if (decimalPart && decimalPart.length > 3) {
          return prev;
        }

        return newAmount;
      });
    }
  };

  const handleClearActiveInput = () => {
    if (activeInput === 'cash') {
      handleClearInput();
    } else {
      setCardAmount('');
    }
  };

  const handleBackspaceActiveInput = () => {
    if (activeInput === 'cash') {
      handleBackspace();
    } else {
      setCardAmount((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">أدخل المبلغ المستلم</h2>
          <button onClick={() => setShowCashPopup(false)} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        
        <div className="text-xl mb-4 text-right">المبلغ المطلوب: {subtotalDecimal.toFixed(4)} د.أ</div>
        
        {selectedPaymentMethod === 'double' ? (
          <div className="mb-4 space-y-2">
            <div className="flex gap-2">
              <div 
                className={`flex-1 border-2 ${activeInput === 'cash' ? 'border-blue-500' : 'border-gray-300'} rounded-lg cursor-pointer`}
                onClick={() => handleInputSelect('cash')}
              >
                <div className="bg-gray-100 p-2 text-center font-semibold">نقداً</div>
                <input 
                  type="text" 
                  value={amountReceived} 
                  readOnly 
                  className="p-4 w-full text-right text-2xl rounded-b-lg" 
                />
              </div>
              <div 
                className={`flex-1 border-2 ${activeInput === 'card' ? 'border-blue-500' : 'border-gray-300'} rounded-lg cursor-pointer`}
                onClick={() => handleInputSelect('card')}
              >
                <div className="bg-gray-100 p-2 text-center font-semibold">بطاقة</div>
                <input 
                  type="text" 
                  value={cardAmount} 
                  readOnly 
                  className="p-4 w-full text-right text-2xl rounded-b-lg" 
                />
              </div>
            </div>
            <div className="text-right text-lg">
              المجموع المستلم: {totalReceived.toFixed(4)} د.أ
            </div>
          </div>
        ) : (
          <input 
            type="text" 
            value={amountReceived} 
            readOnly 
            className="border-2 border-gray-300 p-4 mb-2 w-full text-right text-3xl rounded-lg" 
          />
        )}
        
        <div className={`text-xl mb-4 text-right ${change.isNegative() ? 'text-red-500' : 'text-green-500'}`}>
          {change.isNegative() ? 'المبلغ المتبقي' : 'المبلغ المتبقي للعميل'}: {change.abs().toFixed(4)} د.أ
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
            <button 
              key={num} 
              onClick={() => handleInputChange(num.toString())} 
              className="bg-gray-200 p-6 rounded-lg text-2xl font-semibold hover:bg-gray-300 transition-colors"
            >
              {num}
            </button>
          ))}
          <button 
            onClick={() => handleInputChange('.')} 
            className="bg-gray-200 p-6 rounded-lg text-2xl font-semibold hover:bg-gray-300 transition-colors"
          >
            .
          </button>
          <button 
            onClick={() => handleInputChange('0')} 
            className="bg-gray-200 p-6 rounded-lg text-2xl font-semibold hover:bg-gray-300 transition-colors"
          >
            0
          </button>
          <button 
            onClick={handleBackspaceActiveInput} 
            className="bg-red-200 p-6 rounded-lg text-2xl font-semibold hover:bg-red-300 transition-colors"
          >
            ←
          </button>
        </div>
        
        <div className="flex justify-between mt-6">
          <button 
            onClick={handleClearActiveInput} 
            className="bg-yellow-500 text-white px-6 py-3 rounded-lg text-xl font-semibold hover:bg-yellow-600 transition-colors"
          >
            محو
          </button>
          <button
            onClick={handlePaymentWithProcessing}
            className={`bg-green-500 text-white px-6 py-3 rounded-lg text-xl font-semibold transition-colors ${!isPaymentAllowed || hasPendingDiscount || isProcessing || isClicked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}`}
            disabled={!isPaymentAllowed || hasPendingDiscount || isProcessing || isClicked}
            title={hasPendingDiscount ? 'في انتظار موافقة الإدارة على الخصم' : isProcessing || isClicked ? 'جاري معالجة لدفع' : ''}
          >
            {hasPendingDiscount ? 'في انتظار موافقة الخصم' : isProcessing || isClicked ? 'جاري المعالجة...' : 'تأكيد الدفع'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashPopup;
