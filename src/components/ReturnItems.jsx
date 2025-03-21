import React, { useState, useCallback } from 'react';
import { X, Trash, Barcode } from 'lucide-react';
import db from '../pouchdb';
import { Decimal } from 'decimal.js';
import { toast } from 'react-toastify';
import { getPOSDateTime } from '../utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';
import BarcodeScannerComponent from './BarcodeScannerComponent';
import debounce from 'lodash/debounce';
import { containsArabic, convertArabicNumeralsToEnglish } from '../utils/languageUtils';

export const ReturnItemsPopup = ({ isOpen, onClose }) => {
  const [showScanner, setShowScanner] = useState(true);
  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [returnedItems, setReturnedItems] = useState([]);
  const [pendingReturnRequest, setPendingReturnRequest] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const applyOffers = (product, quantity, existingItem = null) => {
    const baseItem = existingItem || product;
    const sortedOffers = baseItem.offers.slice().sort((a, b) => b.quantity - a.quantity);
    const newItems = [];
    let remainingQuantity = quantity;
    const baseTime = existingItem ? new Date(existingItem.added_at).getTime() : Date.now();

    while (remainingQuantity > 0) {
      const applicableOffer = sortedOffers.find((offer) => remainingQuantity >= offer.quantity);
      if (applicableOffer) {
        const offerSets = Math.floor(remainingQuantity / applicableOffer.quantity);
        for (let i = 0; i < offerSets; i++) {
          newItems.push({
            ...baseItem,
            quantity: applicableOffer.quantity,
            original_price: baseItem.price,
            price: new Decimal(applicableOffer.price).dividedBy(applicableOffer.quantity).toString(),
            is_offer_applied: true,
            has_offer: baseItem.has_offer,
            offers: baseItem.offers,
            offer_details: {
              name: applicableOffer.name,
              total_price: applicableOffer.price,
              original_price: baseItem.price,
              savings: new Decimal(baseItem.price).times(applicableOffer.quantity).minus(applicableOffer.price).toString(),
            },
            added_at: new Date(baseTime + i).toISOString(),
          });
        }
        remainingQuantity %= applicableOffer.quantity;
      } else {
        if (remainingQuantity > 0) {
          newItems.push({
            ...baseItem,
            quantity: remainingQuantity,
            original_price: baseItem.price,
            price: baseItem.price,
            is_offer_applied: false,
            has_offer: baseItem.has_offer,
            offers: baseItem.offers,
            added_at: new Date(baseTime + newItems.length).toISOString(),
          });
          remainingQuantity = 0;
        }
      }
    }
    return newItems;
  };

  const calculateTotal = () => {
    return returnedItems.reduce((sum, item) => {
      if (item.has_offer && item.offers && item.offers.length > 0) {
        const splitItems = applyOffers(item, item.quantity);
        const itemTotal = splitItems.reduce((subSum, si) => subSum.plus(new Decimal(si.price).times(si.quantity)), new Decimal(0));

        // Check if the number is a repeating decimal like 0.99999
        const totalStr = itemTotal.toString();
        const decimalPart = totalStr.includes('.') ? totalStr.split('.')[1] : '';

        // If it has a long decimal part with repeating 9s (likely a recurring decimal)
        if (decimalPart.length > 4 && decimalPart.match(/9{4,}$/)) {
          // Round up to the nearest integer
          return sum.plus(itemTotal.ceil());
        } else {
          // Keep the fractional number as is
          return sum.plus(itemTotal);
        }
      }
      return sum.plus(new Decimal(item.price).times(item.quantity));
    }, new Decimal(0));
  };

  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      try {
        setIsSearching(true);
        const result = await db.find({
          selector: {
            document_type: 'product',
            $or: [
              { barcode: { $regex: RegExp(query, 'i') } },
              { name: { $regex: RegExp(query, 'i') } },
              { name_ar: { $regex: RegExp(query.replace(/[٠-٩]/g, (d) => convertArabicNumeralsToEnglish(d)), 'i') } },
              { sku_code: { $regex: RegExp(query, 'i') } },
              { other_barcodes: { $elemMatch: { $regex: RegExp(query, 'i') } } }
            ],
          },
          limit: 10,
        });

        const uniqueProducts = result.docs.reduce((acc, product) => {
          if (product.is_other_product) {
            const mainProduct = acc.find((p) => p._id === product.main_product_id);
            if (!mainProduct) {
              const mainProductInResults = result.docs.find((p) => p._id === product.main_product_id);
              if (!mainProductInResults) {
                acc.push(product);
              }
            }
          } else {
            acc.push(product);
          }
          return acc;
        }, []);

        setSearchResults(uniqueProducts);
      } catch (error) {
        console.error('Error searching products:', error);
        toast.error('حدث خطأ أثناء البحث عن المنتجات');
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [],
  );

  const handleBarcodeScanned = async (barcodeToUse) => {
    try {
      const product = await db.get(barcodeToUse);

      if (product) {
        // Check if the product already exists in returnedItems
        const existingItemIndex = returnedItems.findIndex((item) => item.barcode === product.barcode);

        if (existingItemIndex !== -1) {
          // If product exists, update its quantity
          const newItems = [...returnedItems];
          newItems[existingItemIndex].quantity += 1;
          setReturnedItems(newItems);
        } else {
          // If product doesn't exist, add it as new item
          setReturnedItems([...returnedItems, { ...product, quantity: 1 }]);
        }

        setBarcode('');
        setShowScanner(false);
      }
    } catch (error) {
      // console.error('Error finding product:', error);
      // toast.error('المنتج غير موجود', {
      //   position: 'top-right',
      //   autoClose: 2000,
      //   theme: 'colored',
      // });
    }
  };

  const handleBarcodeChange = async (e) => {
    const value = e.target.value;
    setBarcode(value);

    // Most barcode scanners automatically add a return character
    // We can use this to detect when a scan is complete
    if (value.length >= 4) {
      // Assuming minimum barcode length is 4
      await handleBarcodeScanned(value);
    }
  };

  const updateQuantity = (index, value) => {
    const newItems = [...returnedItems];
    // Convert to float and handle empty/invalid input
    const numValue = value === '' ? 0 : parseFloat(value);
    newItems[index].quantity = numValue;
    setReturnedItems(newItems);
  };

  const removeItem = (index) => {
    setReturnedItems(returnedItems.filter((_, i) => i !== index));
  };

  const resetPopup = () => {
    setShowScanner(true);
    setBarcode('');
    setReturnedItems([]);
    setPendingReturnRequest(null);
  };

  const handleClose = () => {
    resetPopup();
    onClose();
  };

  const getDisplayPrice = (item) => {
    if (item.has_offer && item.offers && item.offers.length > 0) {
      const applicableOffer = item.offers
        .slice()
        .sort((a, b) => b.quantity - a.quantity)
        .find((offer) => item.quantity >= offer.quantity);
      if (applicableOffer) {
        // Return the offer price per unit
        return new Decimal(applicableOffer.price).dividedBy(applicableOffer.quantity).toFixed(4);
      }
    }
    // Return regular price if no applicable offer
    return item.price;
  };

  const getItemTotal = (item) => {
    let total;
    if (item.has_offer && item.offers && item.offers.length > 0) {
      const splitItems = applyOffers(item, item.quantity);
      total = splitItems.reduce((sum, si) => sum.plus(new Decimal(si.price).times(si.quantity)), new Decimal(0));
    } else {
      total = new Decimal(item.price).times(item.quantity);
    }

    // Check if the number is periodic (like 0.9999...)
    const totalStr = total.toString();
    if (totalStr.match(/\.\d*9{4,}$/)) {
      // Round up periodic numbers
      return total.ceil().toString();
    }

    // Return the original decimal value for non-periodic numbers
    return total.toString();
  };

  const processReturn = async () => {
    if (returnedItems.length === 0) {
      toast.error('لا يمكن معالجة إرجاع فارغ');
      return;
    }

    // Check if there's already a pending request
    if (pendingReturnRequest) {
      toast.info('طلب الإرجاع قيد المعالجة', {
        position: 'top-center',
        autoClose: 3000,
        theme: 'colored',
      });
      return;
    }

    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser'));
      const terminal_id = localStorage.getItem('posTerminal');
      const shift_id = localStorage.getItem('currentShift');
      const posDateTime = await getPOSDateTime();
      const returnId = uuidv4();

      // Process items to apply offers before creating the return order
      const processedItems = returnedItems.flatMap((item) => {
        if (item.has_offer && item.offers && item.offers.length > 0) {
          // Apply offers to calculate correct pricing
          return applyOffers(item, item.quantity);
        }
        return item;
      });

      // Create return order document first
      const returnOrder = {
        _id: returnId,
        document_type: 'order',
        type: 'return',
        status: 'pending',
        items: processedItems,
        total: calculateTotal().toString(),
        created_at: posDateTime,
        realworld_date: new Date().toISOString(),
        terminal_id,
        user_id: currentUser?.id || 'Unknown User',
        requestedBy: currentUser?.username || 'Unknown User',
        shift_id,
      };

      // Save the return order
      await db.put(returnOrder);

      // Create return request linked to the order
      const returnRequest = {
        _id: `request_${returnId}`,
        document_type: 'return_request',
        order_id: returnId,
        status: 'pending',
        items: processedItems,
        total: calculateTotal().toString(),
        created_at: posDateTime,
        realworld_date: new Date().toISOString(),
        terminal_id,
        user_id: currentUser?.id || 'Unknown User',
        requestedBy: currentUser?.username || 'Unknown User',
        shift_id,
      };

      // Save the return request
      await db.put(returnRequest);
      setPendingReturnRequest(returnId);

      toast.info('تم إرسال طلب الإرجاع للإدارة', {
        position: 'top-center',
        autoClose: 3000,
        theme: 'colored',
      });

      // Listen for approval/rejection
      listenForReturnApproval(returnId);

      // After creating the request, close and reset the popup
      handleClose();
    } catch (error) {
      console.error('Error creating return request:', error);
      toast.error('حدث خطأ أثناء إنشاء طلب الإرجاع');
      setPendingReturnRequest(null);
    }
  };

  const listenForReturnApproval = (returnId) => {
    const changes = db.changes({
      since: 'now',
      live: true,
      include_docs: true,
    });

    changes.on('change', async (change) => {
      // Check for changes to the return request document
      if (change.id === `request_${returnId}`) {
        if (change.deleted || (change.doc && change.doc.status === 'approved')) {
          try {
            setPendingReturnRequest(null);
            toast.success('تمت الموافقة على طلب الإرجاع وتمت معالجته', {
              position: 'top-center',
              autoClose: 3000,
              theme: 'colored',
            });
            onClose();
          } catch (error) {
            console.error('Error processing approved return:', error);
            toast.error('حدث خطأ أثناء معالجة الإرجاع المعتمد');
          }
          changes.cancel();
        } else if (change.doc && change.doc.status === 'rejected') {
          try {
            // Delete the return order document when rejected
            const returnOrder = await db.get(returnId);
            await db.remove(returnOrder);

            setPendingReturnRequest(null);
            setReturnedItems([]);
            toast.error('تم رفض طلب الإرجاع', {
              position: 'top-center',
              autoClose: 3000,
              theme: 'colored',
            });
          } catch (error) {
            console.error('Error handling return rejection:', error);
          }
          changes.cancel();
        }
      }
    });

    changes.on('error', (err) => {
      console.error('Error in changes feed:', err);
      toast.error('حدث خطأ في متابعة طلب الإرجاع');
      setPendingReturnRequest(null);
    });
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleSearchResultClick = (product) => {
    const existingItemIndex = returnedItems.findIndex((item) => item.barcode === product.barcode);

    if (existingItemIndex !== -1) {
      const newItems = [...returnedItems];
      newItems[existingItemIndex].quantity += 1;
      setReturnedItems(newItems);
    } else {
      setReturnedItems([...returnedItems, { ...product, quantity: 1 }]);
    }

    setSearchQuery('');
    setSearchResults([]);
    setShowScanner(false);
  };

  const renderScanner = () => {
    if (!isOpen || !showScanner) return null;

    return <BarcodeScannerComponent enabled={isOpen && showScanner} onScan={handleBarcodeScanned} onProcessingStart={() => toast.info('جاري مسح الباركود...', { autoClose: 500 })} onNotFound={(barcode) => toast.error(`المنتج غير موجود: ${barcode}`, { autoClose: 2000 })} />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {renderScanner()}
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-bold">إرجاع مواد</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {showScanner ? (
            <div className="flex flex-col items-center justify-center space-y-6 py-12">
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
              <div className="w-full max-w-md space-y-4">
                <input type="text" value={barcode} onChange={handleBarcodeChange} placeholder="امسح الباركود" className="w-full p-3 border rounded-md text-right text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" autoFocus />
                <div className="relative">
                  <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="ابحث بالاسم أو الرمز" className="w-full p-3 border rounded-md text-right text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  {isSearching && <div className="absolute top-full left-0 right-0 mt-1 p-2 text-center text-gray-600 bg-white border rounded-md shadow-lg">جاري البحث...</div>}
                  {!isSearching && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                      {searchResults.map((product) => (
                        <button key={product._id} onClick={() => handleSearchResultClick(product)} className="w-full p-2 text-right hover:bg-gray-100 border-b last:border-b-0">
                          <div>{product.name_ar}</div>
                          <div className="text-sm text-gray-500">{product.sku_code}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-1/2">
                  <input type="text" value={barcode} onChange={handleBarcodeChange} placeholder="امسح الباركود" className="w-full p-3 border rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" autoFocus />
                </div>
                <div className="w-1/2 relative">
                  <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="ابحث بالاسم أو الرمز" className="w-full p-3 border rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  {isSearching && <div className="absolute top-full left-0 right-0 mt-1 p-2 text-center text-gray-600 bg-white border rounded-md shadow-lg">جاري البحث...</div>}
                  {!isSearching && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                      {searchResults.map((product) => (
                        <button key={product._id} onClick={() => handleSearchResultClick(product)} className="w-full p-2 text-right hover:bg-gray-100 border-b last:border-b-0">
                          <div>{product.name_ar}</div>
                          <div className="text-sm text-gray-500">{product.sku_code}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full border-collapse bg-white">
                  <thead>
                    <tr>
                      <th className="p-3 bg-gray-50 border text-right font-medium text-gray-600">رمز المادة</th>
                      <th className="p-3 bg-gray-50 border text-right font-medium text-gray-600">رمز المادة</th>
                      <th className="p-3 bg-gray-50 border text-center font-medium text-gray-600">الكمية</th>
                      <th className="p-3 bg-gray-50 border text-center font-medium text-gray-600">السعر</th>
                      <th className="p-3 bg-gray-50 border text-center font-medium text-gray-600">المجموع</th>
                      <th className="p-3 bg-gray-50 border text-center font-medium text-gray-600">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnedItems.map((item, index) => (
                      <tr key={index}>
                        <td className="p-3 border text-blue-600">{item.barcode}</td>
                        <td className="p-3 border">{item.name_ar}</td>
                        <td className="p-3 border text-center">
                          <input
                            type="number"
                            className="w-20 p-2 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, e.target.value)}
                            step="any"
                          />
                        </td>
                        <td className="p-3 border text-center">{getDisplayPrice(item)} د.أ</td>
                        <td className="p-3 border text-center">{getItemTotal(item)} د.أ</td>
                        <td className="p-3 border text-center">
                          <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                            <Trash size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t">
                <button onClick={processReturn} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-lg transition-colors" disabled={returnedItems.length === 0}>
                  إرجاع
                </button>
                <div className="text-left">
                  <p className="text-sm text-gray-600">عدد المواد: {returnedItems.length}</p>
                  <p className="font-bold text-lg">المجموع: {calculateTotal().toString()} د.أ</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReturnItemsPopup;
