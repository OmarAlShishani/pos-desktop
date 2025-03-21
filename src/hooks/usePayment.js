import { useState } from 'react';
import db from '../pouchdb';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
import { Decimal } from 'decimal.js';
import { getPOSDateTime } from '../utils/dateUtils';

const formatQuantity = (quantity) => {
  try {
    const num = new Decimal(quantity || 0);
    // Check if the number is an integer
    return num.isInteger() ? num.toFixed(0) : num.toFixed(4);
  } catch (error) {
    console.error('Error formatting quantity:', error);
    return '0';
  }
};

const safeDecimalString = (value, decimals = 4) => {
  try {
    const decimal = new Decimal(value || 0);
    return decimal.toFixed(decimals);
  } catch (error) {
    console.error('Error converting to decimal:', error);
    return '0.0000';
  }
};

export const usePayment = (cart, currentOrderId, onOrderComplete, calculateTotals) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [showCashPopup, setShowCashPopup] = useState(false);
  const [amountReceived, setAmountReceived] = useState('');
  const [isWaitingForNFC, setIsWaitingForNFC] = useState(false);
  const [nfcPendingOrderId, setNfcPendingOrderId] = useState(null);

  const toastConfig = {
    position: 'top-right',
    autoClose: 1000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: 'colored',
  };

  const processPayment = async (amountPaid, change, totals, orderIdOverride = null, additionalData = {}) => {
    try {
      const currentTotals = calculateTotals();
      const posDateTime = await getPOSDateTime();

      // Check if there's an applied discount but it's still pending
      if (currentTotals.appliedDiscount > 0 && totals.pendingDiscountRequest) {
        toast.error('لا يمكن إتمام الدفع حتى تتم الموافقة على طلب الخصم', {
          position: 'top-right',
          autoClose: 1000,
          theme: 'colored',
        });
        return false;
      }

      // Ensure we have a valid orderIdToUse
      const orderIdToUse = orderIdOverride || currentOrderId || uuidv4();
      const currentUser = JSON.parse(localStorage.getItem('currentUser'));
      const user_id = currentUser?.id || 'Unknown User';
      const terminal_id = localStorage.getItem('posTerminal');
      const shift_id = localStorage.getItem('currentShift');

      // Ensure we have valid numbers for all monetary values
      const safeDecimal = (value) => {
        if (value === null || value === undefined) return new Decimal(0);
        if (value instanceof Decimal) return value;
        return new Decimal(value.toString());
      };

      const finalAmountPaid = safeDecimal(amountPaid || currentTotals.total);
      const finalChange = safeDecimal(change || 0);

      // Convert cart items to safe numbers
      const serializedCart = cart.map((item) => ({
        ...item,
        price: safeDecimal(item.price).toNumber(),
        quantity: safeDecimal(item.quantity).toNumber(),
      }));

      // Convert totals to safe numbers
      const serializedTotals = Object.entries(currentTotals).reduce((acc, [key, value]) => {
        // Skip non-numeric values
        if (key === 'pendingDiscountRequest') {
          return { ...acc, [key]: value }; // Keep boolean value as is
        }

        // Handle numeric values
        const numericValue = new Decimal(value || 0);
        return { ...acc, [key]: numericValue.toNumber() };
      }, {});

      // Create the base order object
      const order = {
        _id: orderIdToUse, // Ensure _id is always set
        items: serializedCart,
        ...serializedTotals,
        paymentMethod: selectedPaymentMethod,
        amountPaid: finalAmountPaid.toNumber(),
        change: finalChange.toNumber(),
        created_at: posDateTime,
        document_type: 'order',
        type: 'sale',
        terminal_id,
        user_id,
        shift_id,
      };

      // Add double payment specific fields if applicable
      if (selectedPaymentMethod === 'double') {
        if (additionalData && typeof additionalData === 'object') {
          // Ensure we have valid numbers for card and cash amounts
          if (additionalData.cardAmount !== undefined) {
            const cardAmountDecimal = safeDecimal(additionalData.cardAmount);
            order.cardAmount = cardAmountDecimal.toNumber();
            
            // Calculate the actual cash amount needed to complete the payment
            // This is the total minus what was paid by card
            const totalAmountDecimal = safeDecimal(currentTotals.total);
            const requiredCashAmount = totalAmountDecimal.minus(cardAmountDecimal);
            
            // Store the required cash amount as cashAmount
            order.cashAmount = requiredCashAmount.toNumber();
            
            // Keep the original amountPaid as the full cash received
            // This is already set in the order object above
            // order.amountPaid = finalAmountPaid.toNumber();
          } else {
            // If no card amount is provided, all payment is considered cash
            order.cashAmount = safeDecimal(currentTotals.total).toNumber();
          }
        } else {
          console.warn('Double payment selected but no additionalData provided');
        }
      }
      // Wrap the stock updates in a try-catch block and use retries
      const updateStockWithRetry = async (item, maxRetries = 3) => {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // Get latest document state
            const product = await db.get(item._id);

            // Calculate new stock
            const newShowroomStock = (product.showroom_stock || 0) - item.quantity;

            // Update document
            await db.put({
              ...product,
              showroom_stock: newShowroomStock,
              updated_at: new Date().toISOString(),
            });

            // Handle container type products
            if (product.type === 'container' && product.parent_product_id && product.container_qty) {
              try {
                const parentProduct = await db.get(product.parent_product_id);
                const parentStockReduction = item.quantity * product.container_qty;

                await db.put({
                  ...parentProduct,
                  showroom_stock: (parentProduct.showroom_stock || 0) - parentStockReduction,
                  updated_at: new Date().toISOString(),
                });
              } catch (error) {
                // console.error('Error updating parent product stock:', error);
              }
            }

            // Handle other product types (existing logic)
            if (item.hasOwnProperty('is_other_product') && item.is_other_product && item.hasOwnProperty('main_product_id')) {
              try {
                const mainProduct = await db.get(item.main_product_id);
                await db.put({
                  ...mainProduct,
                  showroom_stock: (mainProduct.showroom_stock || 0) - item.quantity,
                  updated_at: new Date().toISOString(),
                });
              } catch (error) {
                // console.error('Error updating main product stock:', error);
              }
            }

            return true;
          } catch (error) {
            lastError = error;
            if (error.name === 'conflict' && attempt < maxRetries) {
              // Exponential backoff with jitter
              const delay = Math.min(100 * Math.pow(2, attempt - 1) + Math.random() * 100, 1000);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            break;
          }
        }

        throw lastError;
      };

      // Process stock updates sequentially with retries
      try {
        // Process all stock updates in parallel
        const stockUpdatePromises = serializedCart.map(async (item) => {
          try {
            const result = await updateStockWithRetry(item);
            return { item, success: true };
          } catch (error) {
            return { item, success: false, error };
          }
        });

        // Wait for all updates to complete
        const results = await Promise.all(stockUpdatePromises);

        // Handle any failures after all updates are complete
        const failures = results.filter((r) => !r.success);
        if (failures.length > 0) {
          failures.forEach(({ item }) => {
            // console.error(`فشل تحديث المخزون للمنتج: ${item.name_ar}`);
          });
        }
      } catch (error) {
        // console.error('Stock update error:', error);
      }

      // Save the order with retry mechanism
      // console.time('Save Order');
      const saveOrderWithRetry = async (maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await db.put(order);
            return true;
          } catch (error) {
            if (error.name === 'conflict' && attempt < maxRetries) {
              // For orders, we can generate a new ID if there's a conflict
              order._id = uuidv4();
              continue;
            }
            throw error;
          }
        }
      };

      await saveOrderWithRetry();

      // Show change amount in a more prominent toast if there is change to return
      if (finalChange.greaterThan(0)) {
        toast.info(`المبلغ المتبقي للعميل: ${finalChange.toFixed(4)} د.أ`, {
          position: 'top-right',
          autoClose: 3000, // Show for 5 seconds
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'colored',
          className: 'font-bold text-xl p-4', // Larger text and padding
          style: {
            textAlign: 'center',
            minWidth: '300px',
          },
          rtl: true,
        });
      }

      // Clear cart and state immediately after saving order
      onOrderComplete(orderIdToUse);
      setShowCashPopup(false);
      setAmountReceived('');
      setSelectedPaymentMethod('cash');

      // Create log entry
      const logEntry = {
        _id: uuidv4(),
        statement: `تم إنشاء طلب ومعرفه: ${orderIdToUse}, المبلغ الإجمالي: ${totals.total}, طريقة الدفع: ${selectedPaymentMethod}`,
        user_id: user_id,
        terminal_id: terminal_id,
        created_at: posDateTime,
        realworld_date: new Date().toISOString(),
        document_type: 'log',
      };

      await db.put(logEntry);

      // Try to print last, after everything else is done
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          const printResult = await window.electronAPI.printOrder(`
            <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>POS Bill</title>
                <style>
                  @page { margin: 0; }
                  body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 5px;
                    width: 72mm; /* Standard thermal paper width */
                    box-sizing: border-box;
                    margin-left: 10px;
                  }
                  .bill {
                    display: flex;
                    flex-direction: column;
                    direction: rtl;
                  }
                  .logo {
                    text-align: center;
                    margin-bottom: 10px;
                  }
                  .logo img {
                    max-width: 100px;
                    height: auto;
                  }
                  .store-info {
                    text-align: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px dashed #000;
                  }
                  .store-info h1 {
                    font-size: 16px;
                    margin: 0 0 5px 0;
                  }
                  .store-info p {
                    font-size: 10px;
                    margin: 2px 0;
                  }
                  .receipt-info {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    margin-bottom: 10px;
                    padding-bottom: 5px;
                    border-bottom: 1px dashed #000;
                  }
                  .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 10px;
                    font-size: 11px;
                  }
                  .items-table th {
                    border-bottom: 1px solid #000;
                    padding: 3px 0;
                    text-align: right;
                  }
                  .items-table td {
                    padding: 3px 0;
                    text-align: right;
                  }
                  .totals {
                    border-top: 1px dashed #000;
                    padding-top: 5px;
                    margin-top: 5px;
                  }
                  .total-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    margin: 3px 0;
                  }
                  .grand-total {
                    font-weight: bold;
                    font-size: 14px;
                    border-top: 1px dashed #000;
                    padding-top: 5px;
                    margin-top: 5px;
                  }
                  .footer {
                    text-align: center;
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px dashed #000;
                  }
                  .footer p {
                    font-size: 10px;
                    margin: 3px 0;
                  }
                  .qr-code {
                    text-align: center;
                    margin: 10px 0;
                  }
                  .product-name {
                    max-width: 120px; /* Adjust based on your needs */
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 1.2;
                    min-height: 2.4em; /* Ensures consistent height even with short names */
                  }
                </style>
              </head>
              <body>
                <div class="bill">
                  <div class="store-info">
                    <h1>استراحة المسافر</h1>
                  </div>

                  <div class="receipt-info">
                    <span>رقم الفاتورة: ${order._id.slice(-6)}</span>
                    <span>${new Date().toLocaleString('ar-JO')}</span>
                  </div>

                  <table class="items-table">
                    <thead>
                      <tr>
                        <th>المنتج</th>
                        <th>الكمية</th>
                        <th>السعر</th>
                        <th>المجموع</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${cart
                        .map((item) => {
                          try {
                            const itemQuantity = new Decimal(item.quantity || 0);
                            const itemPrice = new Decimal(item.is_scalable_item ? item.kilo_price || item.original_price || 0 : item.price || 0);
                            const itemTotal = itemPrice.times(itemQuantity);

                            return `
                            <tr>
                              <td><div class="product-name">${item.name_ar || ''}</div></td>
                              <td>${formatQuantity(itemQuantity)}${item.is_scalable_item ? ' كغ' : ''}</td>
                              <td>${safeDecimalString(itemPrice)}${item.is_scalable_item ? '/كغ' : ''}</td>
                              <td>${safeDecimalString(itemTotal)}</td>
                            </tr>
                          `;
                          } catch (error) {
                            console.error('Error processing item:', error);
                            return `
                            <tr>
                              <td><div class="product-name">${item.name_ar || ''}</div></td>
                              <td>0</td>
                              <td>0.0000</td>
                              <td>0.0000</td>
                            </tr>
                          `;
                          }
                        })
                        .join('')}
                    </tbody>
                  </table>

                  <div class="totals">
                    <div class="total-row">
                      <span>المجموع الفرعي: </span>
                      <span>${safeDecimalString(totals.subtotal)} د.أ</span>
                    </div>
                    <div class="total-row">
                      <span>الضريبة: </span>
                      <span>${safeDecimalString(totals.tax)} د.أ</span>
                    </div>
                    ${
                      totals.discount > 0
                        ? `
                      <div class="total-row">
                        <span>الخصم: </span>
                        <span>${safeDecimalString(totals.discount)} د.أ</span>
                      </div>
                    `
                        : ''
                    }
                    <div class="total-row grand-total">
                      <span>المجموع النهائي: </span>
                      <span>${safeDecimalString(totals.total)} د.أ</span>
                    </div>
                    ${
                      selectedPaymentMethod === 'cash'
                        ? `
                      <div class="total-row">
                        <span>المبلغ ${selectedPaymentMethod === 'cash' ? 'المستلم' : 'المدفوع'}: </span>
                        <span>${safeDecimalString(amountPaid || totals.total)} د.أ</span>
                      </div>
                      ${
                        selectedPaymentMethod === 'cash'
                          ? `
                        <div class="total-row">
                          <span>المبلغ المتبقي: </span>
                          <span>${safeDecimalString(change || 0)} د.أ</span>
                        </div>
                      `
                          : ''
                      }
                    `
                        : ''
                    }
                    <div class="total-row">
                      <span>طريقة الدفع: </span>
                      <span>${selectedPaymentMethod === 'cash' ? 'نقداً' : selectedPaymentMethod === 'card' ? 'بطاقة' : selectedPaymentMethod === 'nfc' ? 'ذمم' : 'متعدد'}</span>
                    </div>
                  </div>

                  <div class="footer">
                    <p>شكراً لتسوقكم معنا</p>
                    <p>نتمنى لكم يوماً سعيداً</p>
                  </div>
                </div>
              </body>
            </html>`);

          if (!printResult.success) {
            // console.error('Print failed:', printResult.error);
            toast.error('فشل الطباعة. يرجى المحاولة مرة أخرى.');
          } else {
            // console.log('Print completed successfully');
          }
        } catch (printError) {
          console.error('Print error:', printError);
          toast.error('حدث خطأ أثناء الطباعة.');
        }
      } else {
        // console.warn("Electron API not available - running in browser mode");
      }
      return true;
    } catch (error) {
      toast.error('حدث خطأ أثناء معالجة الدفع. يرجى المحاولة مرة أخرى.');
      return false;
    }
  };
  const handlePayment = async (requireNFC) => {
    const currentTotals = calculateTotals();
  
    // Check for pending discount
    if (currentTotals.appliedDiscount > 0 && currentTotals.pendingDiscountRequest) {
      toast.error('لا يمكن إتمام الدفع حتى تتم الموافقة على طلب الخصم', {
        position: 'top-right',
        autoClose: 1000,
        theme: 'colored',
      });
      return;
    }
  
    if (requireNFC) {
      setIsWaitingForNFC(true);
      setNfcPendingOrderId(currentOrderId);
      return;
    }
  
    // Remove automatic cash popup trigger
    if (selectedPaymentMethod === 'card' || selectedPaymentMethod === 'debit') {
      const totals = calculateTotals();
      processPayment(null, null, totals);
    } else {
      // For cash and double payments, process directly with total amount
      const totals = calculateTotals();
      processPayment(totals.total, 0, totals);
    }
  };
  const handleCashPayment = async (additionalData) => {
    try {
      // Get current totals
      const currentTotals = calculateTotals();
      
      // Ensure we have valid numbers by providing fallbacks and validation
      const receivedAmount = new Decimal(amountReceived || '0');
      const totalAmount = new Decimal(currentTotals?.total || '0');
  
      // Validate that we have proper numbers before proceeding
      if (receivedAmount.isNaN() || totalAmount.isNaN()) {
        toast.error('قيم غير صالحة للدفع');
        return;
      }
  
      // For double payment, use the total of cash and card
      let finalReceivedAmount = receivedAmount;
      let paymentData = {};
      
      if (selectedPaymentMethod === 'double' && additionalData?.cardAmount !== undefined) {
        const cardAmount = new Decimal(additionalData.cardAmount);
        finalReceivedAmount = receivedAmount.plus(cardAmount);
        
        // Add card amount to payment data
        paymentData = {
          cardAmount: cardAmount.toNumber(),
          cashAmount: receivedAmount.toNumber()
        };
        
      }
  
      const change = finalReceivedAmount.minus(totalAmount);
  
      const paymentProcessed = await processPayment(
        finalReceivedAmount.toNumber(), 
        change.toNumber(), 
        currentTotals,
        null, // orderIdOverride
        paymentData // Additional data for double payment
      );
  
      if (!paymentProcessed) return;
  
      if (change.greaterThan(0)) {
        toast.info(`يجب إرجاع ${change.toFixed(2)} للعميل`);
      }
  
      setShowCashPopup(false);
      setAmountReceived('');
      
      // Reset any card input in the CashPopup component
      if (additionalData && additionalData.resetCardInput && typeof additionalData.resetCardInput === 'function') {
        additionalData.resetCardInput();
      }
    } catch (error) {
      console.error('Cash payment error:', error);
      toast.error('حدث خطأ أثناء معالجة الدفع النقدي');
    }
  };
  const handleNFCApproval = (approved) => {
    const totals = calculateTotals();
    setIsWaitingForNFC(false);
  
    if (approved) {
      processPayment(null, null, totals, nfcPendingOrderId);
    } else {
      toast.error('تم رفض الدفع بالذمم', toastConfig);
    }
    setNfcPendingOrderId(null);
  };
  const cancelNFCWaiting = () => {
    setIsWaitingForNFC(false);
    setNfcPendingOrderId(null);
    toast.info('تم إلغاء عملية الدفع بالذمم', toastConfig);
  };
  return {
    selectedPaymentMethod,
    showCashPopup,
    amountReceived,
    setSelectedPaymentMethod,
    setShowCashPopup,
    setAmountReceived,
    handlePayment,
    handleCashPayment,
    isWaitingForNFC,
    handleNFCApproval,
    nfcPendingOrderId,
    cancelNFCWaiting,
  };
};
