import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import tabletImage from '../assets/images/tablet.png';
import { Decimal } from 'decimal.js';

const OrderSummaryPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { order } = location.state || {};
  const [showMainSidebar, setShowMainSidebar] = useState(false);
  const [isPrinted, setIsPrinted] = useState(false);

  const navigateToHome = useCallback(() => {
    navigate('/home');
  }, [navigate]);

  const formatDate = useCallback((dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('ar-EG', options);
  }, []);

  useEffect(() => {
    if (!isPrinted && typeof window !== 'undefined' && window.electronAPI && order) {
      window.electronAPI.printOrder(`
      <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>POS Bill</title>
                <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    width: 62mm;
                    box-sizing: border-box;
                }
                .bill {
                    display: flex;
                    flex-direction: column;
                    direction: rtl;
                }
                header h1 {
                    text-align: center;
                    margin-bottom: 5px;
                    font-size: 14px;
                }
                .info {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    font-size: 12px;
                    margin-bottom: 5px;
                }
                .info-item {
                    width: 48%;
                    margin-bottom: 2px;
                }
                .items {
                    margin-bottom: 5px;
                }
                .item-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                .item-table th,
                .item-table td {
                    text-align: right;
                    padding: 2px 0;
                }
                .item-table th {
                    font-weight: bold;
                }
                .totals {
                    margin-top: 5px;
                    border-top: 1px solid #ccc;
                    padding-top: 5px;
                }
                .totals-table {
                    width: 100%;
                    font-size: 12px;
                }
                .totals-table td:last-child {
                    text-align: right;
                }
                footer {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin-top: 10px;
                }
                .barcode {
                    width: 100%;
                    height: 40px;
                    background-color: #ccc;
                    margin-bottom: 5px;
                }
                footer p {
                    font-size: 10px;
                    text-align: center;
                    margin: 0;
                }
            </style>
        </head>
        <body>
            <div class="bill">
                <header>
                    <div class="info">
                        <div class="info-item">التاريخ: ${formatDate(date)}</div>
                        <div class="info-item">اسم الفرع: الأزرق</div>
                        <div class="info-item">اسم البائع: أحمد</div>
                        <div class="info-item">رقم الفاتورة: ${id.slice(-4)}</div>
                        <div class="info-item">الرقم الضريبي: 3432</div>
                        <div class="info-item">نقطة البيع: عبدون</div>
                        <div class="info-item">اسم العميل: جون</div>
                    </div>
                </header>
                <section class="items">
                    <table class="item-table">
                        <thead>
                            <tr>
                                <th>اسم المادة</th>
                                <th>الكود</th>
                                <th>الكمية</th>
                                <th>السعر</th>
                                <th>الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>
                        ${items
                          .map(
                            (item) => `
                          <tr>
                            <td>${item.name}</td>
                            <td>${item.code}</td>
                            <td>${item.quantity}</td>
                            <td>${item.price} د.أ</td>
                            <td>${new Decimal(item.price).times(item.quantity)} د.أ</td>
                          </tr>`,
                          )
                          .join('')}
                        </tbody>
                    </table>
                </section>
                <section class="totals">
                    <div class="info">
                        <div class="info-item">إجمالي الفاتورة: ${total} د.أ</div>
                        <div class="info-item">الضريبة: ${tax} د.أ</div>
                        <div class="info-item">عدد المواد: ${itemCount}</div>
                        <div class="info-item">الخصم: 3</div>
                        <div class="info-item">صافي قيمة الفاتورة: 12.31</div>
                        <div class="info-item">طريقة الدفع: ${paymentMethod}</div>
                        <div class="info-item">المبلغ: ${subtotal} د.أ</div>
                        <div class="info-item">الباقي: ${total} د.أ</div>
                    </div>
                </section>
                <footer>
                    <div class="barcode"></div>
                    <p>شكرًا لكم على زيارتكم!</p>
                </footer>
            </div>
        </body>
</html>`);
      setIsPrinted(true);
      setTimeout(navigateToHome, 500);
    } else {
      if (!window.electronAPI) {
        console.error('electronAPI is not available');
      }
      if (!order) {
        console.error('Order is not defined');
      }
    }
  }, [order, isPrinted, navigateToHome]);

  if (!order) {
    return <div className="p-4 text-center">ما من معلومات متاحة</div>;
  }

  const { id, items, itemCount, subtotal, tax, total, paymentMethod, date } = order;

  const toggleMainSidebar = () => {
    setShowMainSidebar(!showMainSidebar);
  };

  const handleFinish = () => {
    navigate('/home');
  };

  const printOrder = () => {
    // Open a new window
    const printWindow = window.open('', '', 'width=800,height=600');
    return printWindow.document.write(`
      <html>
        <head>
          <title>Order Summary</title>
          <style>
            body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
            .order-summary { margin-bottom: 20px; }
            .order-summary h2 { color: #2B3674; }
            .order-summary p { font-size: 16px; }
            .order-summary table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .order-summary th, .order-summary td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .order-summary th { background-color: #f4f4f4; }
          </style>
        </head>
        <body>
          <div class="order-summary">
            <h2>تفاصيل الطلب</h2>
            <p><b>مُعرف الطلب</b>: ${id}</p>
            <p><b>التاريخ</b>: ${formatDate(date)}</p>
            <p><b>طريقة الدفع</b>: ${paymentMethod}</p>
            <p><b>عدد المواد</b>: ${itemCount}</p>
            <p><b>الضريبة</b>: ${tax} د.أ</p>
            <p><b>المجموع الفرعي</b>: ${subtotal} د.أ</p>
            <p><b>المجموع النهائي</b>: ${total} د.أ</p>
            
            <table>
              <thead>
                <tr>
                  <th>اسم المادة</th>
                  <th>رمز المادة</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>الخصم</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item) => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.code}</td>
                    <td>${item.quantity}</td>
                    <td>${item.price} د.أ</td>
                    <td>${item.discount || 0} د.أ</td>
                    <td>${new Decimal(item.price).times(item.quantity)} د.أ</td>
                  </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    // printWindow.document.close();
    // printWindow.print();
    // ipcRenderer.send('print-order', printContent);
  };

  return (
    <div className="flex-grow overflow-auto font-sans">
      <div className="flex flex-row-reverse rtl:flex-row p-4 bg-gray-100 font-sans">
        <div className="w-1/3 p-4">
          <img src={tabletImage} alt="Tablet" className="w-full rounded-lg shadow-lg" />
        </div>
        <div className="w-2/3 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[#4F5E83] text-base font-bold">عدد المواد</span>
                  <span className="text-[#4F5E83] text-lg">{itemCount}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-[#4F5E83] text-base font-bold">الضريبة</span>
                  <span className="text-[#4F5E83] text-lg">{tax} د.أ</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-[#4F5E83] text-base pl-5 font-bold">المجموع الفرعي</span>
                  <span className="text-[#4F5E83] text-lg">{subtotal} د.أ</span>
                </div>
              </div>
              <div>
                <h2 className="text-2xl text-[#2B3674] text-left font-bold">المجموع</h2>
                <div className="text-3xl font-bold text-blue-600 mb-4 text-[#4F5E83] text-2xl pt-10">{total} د.أ</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
            <div className="mb-4">
              <p className="font-bold pb-2">تفاصيل الطلب</p>
              <ul className="list-disc">
                <li className="text-sm text-gray-600">
                  <b>مُعرف الطلب</b>: {id}
                </li>
                <li className="text-sm text-gray-600">
                  <b>التاريخ</b>: {formatDate(date)}
                </li>
                <li className="text-sm text-gray-600">
                  <b>طريقة الدفع</b>: {paymentMethod}
                </li>
              </ul>
            </div>
            <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
              <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-[#F5F9FF]">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-[#4F5E83] text-base">
                      اسم المادة
                    </th>
                    <th scope="col" className="px-6 py-3 text-[#4F5E83] text-base">
                      رمز المادة
                    </th>
                    <th scope="col" className="px-6 py-3 text-[#4F5E83] text-base">
                      الكمية
                    </th>
                    <th scope="col" className="px-6 py-3 text-[#4F5E83] text-base">
                      السعر
                    </th>
                    <th scope="col" className="px-6 py-3 text-[#4F5E83] text-base">
                      الخصم
                    </th>
                    <th scope="col" className="px-6 py-3 text-[#4F5E83] text-base">
                      الإجمالي
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="bg-white border-b">
                      <td className="px-6 py-4">{item.name}</td>
                      <td className="px-6 py-4">{item.barcode}</td>
                      <td className="px-6 py-4">{item.quantity}</td>
                      <td className="px-6 py-4">{item.price} د.أ</td>
                      <td className="px-6 py-4">{new Decimal(item.price).times(item.quantity)} د.أ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSummaryPage;
