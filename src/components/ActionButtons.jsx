import React from 'react';

const ActionButtons = ({ onCashOpen, onPriceCheck, onWithdraw, onDeposit, onReturnItems, onBarcodeInput }) => {
  const handleCashOpen = async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const printResult = await window.electronAPI.printOrder(`
          <html>
            <head>
              <style>
                body { 
                  margin: 0;
                  padding: 0;
                  width: 72mm;
                }
              </style>
            </head>
            <body>
              <!-- Minimal content to trigger printer -->
              <div style="height: 1mm;"></div>
            </body>
          </html>
        `);

        if (!printResult.success) {
          console.error('Cash drawer open failed:', printResult.error);
        }
      } catch (error) {
        console.error('Error opening cash drawer:', error);
      }
    }

    // Still call the original onCashOpen if it exists
    if (onCashOpen) onCashOpen();
  };

  return (
    <div className="flex flex-col gap-2 bg-white rounded-xl shadow-md p-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm rounded-lg w-full border border-blue-700 transition-all duration-200 ease-in-out" onClick={handleCashOpen}>
          فتح الكاش
        </button>
        <button className="bg-blue-100 hover:bg-blue-200 text-blue-600 px-3 py-1.5 text-sm rounded-lg w-full border border-blue-200 transition-all duration-200 ease-in-out" onClick={onPriceCheck}>
          فحص سعر
        </button>
        <button className="bg-gray-200 hover:bg-gray-300 px-3 py-1.5 text-sm rounded-lg w-full border border-gray-300 transition-all duration-200 ease-in-out" onClick={onWithdraw}>
          سند صرف
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <button className="bg-gray-200 hover:bg-gray-300 px-3 py-1.5 text-sm rounded-lg w-full border border-gray-300 transition-all duration-200 ease-in-out" onClick={onDeposit}>
          سند قبض
        </button>
        <button className="bg-orange-100 hover:bg-orange-200 text-orange-600 px-3 py-1.5 text-sm rounded-lg w-full border border-orange-200 transition-all duration-200 ease-in-out" onClick={onReturnItems}>
          إرجاع مواد
        </button>
        <button className="bg-green-100 hover:bg-green-200 text-green-600 px-3 py-1.5 text-sm rounded-lg w-full border border-green-200 transition-all duration-200 ease-in-out" onClick={onBarcodeInput}>
          إدخال باركود
        </button>
      </div>
    </div>
  );
};

export default ActionButtons;
