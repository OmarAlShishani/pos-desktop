import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import cashImg from '../assets/images/cash_img.png';
import cardImg from '../assets/images/card_img.png';
import debtImg from '../assets/images/debt_img.png';
import db from '../pouchdb';

import { useProducts } from '../hooks/useProducts';
import { useCart } from '../hooks/useCart';
import { usePayment } from '../hooks/usePayment';
import { useBarcode } from '../hooks/useBarcode';
import { useScale } from '../hooks/useScale';
import { useTabs } from '../hooks/useTabs';

import Sidebar from '../components/Sidebar';
import RelatedProducts from '../components/RelatedProducts';
import SearchAndClearCart from '../components/SearchAndClearCart';
import CategoryButtons from '../components/CategoryButtons';
import ActionButtons from '../components/ActionButtons';
import CategorySidebar from '../components/CategorySidebar';
import CashPopup from '../components/CashPopup';
import OrdersSection from '../components/OrdersSection';
import CheckoutSummary from '../components/CheckoutSummary';
import CartTable from '../components/CartTable';
import Header from '../components/Header';
import Tabs from '../components/Tabs';

import { v4 as uuidv4 } from 'uuid';
import { ExpenseVoucherPopup } from '../components/ExpenseVoucher';
import ReceiptVoucherPopup from '../components/ReceiptVoucher';
import { PriceScannerPopup } from '../components/PriceScanner';
import { ReturnItemsPopup } from '../components/ReturnItems';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Decimal from 'decimal.js';
import { getPOSDateTime } from '../utils/dateUtils';
import { checkShiftStatus } from '../utils/shiftUtils';
import DiscountRequestPopup from '../components/DiscountRequestPopup';
import ProductNotFoundPopup from '../components/ProductNotFoundPopup';
import { cleanupOldDocs, performCompaction, logDatabaseInfo } from '../pouchdb';
import BarcodeInputPopup from '../components/BarcodeInputPopup';

// Common baud rates for scales and other serial devices
const baudRates = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

function HomePage() {
  const navigate = useNavigate();
  const { products, categories, fetchRelatedProducts } = useProducts();

  const {
    cart,
    orders,
    currentOrderId,
    appliedDiscount,
    setAppliedDiscount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    calculateTotals,
    ensureActiveOrder,
    setCurrentOrderId,
    setOrders,
    setCart,
    handleNFCApproval: handleNFCApprovalFromHook,
    pendingDiscountRequest,
    requestDiscount,
    pendingDiscountRequests,
    pendingDeletions,
    pendingPriceChanges,
    updateItemPrice,
  } = useCart();

  const handleOrderComplete = (completedOrderId) => {
    setOrders((prevOrders) => prevOrders.filter((order) => order.id !== completedOrderId));
    setCart([]);
    setCurrentOrderId(null);
    setAppliedDiscount(0);
    setRelatedProducts([]);
  };

  const { selectedPaymentMethod, showCashPopup, amountReceived, setSelectedPaymentMethod, setShowCashPopup, setAmountReceived, handlePayment, handleCashPayment, isWaitingForNFC, handleNFCApproval, nfcPendingOrderId, cancelNFCWaiting } = usePayment(cart, currentOrderId, handleOrderComplete, () => {
    const totals = calculateTotals();
    return {
      ...totals,
      pendingDiscountRequest,
    };
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategorySidebar, setShowCategorySidebar] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showMainSidebar, setShowMainSidebar] = useState(false);
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [showExpenseVoucher, setShowExpenseVoucher] = useState(false);
  const [showReceiptVoucher, setShowReceiptVoucher] = useState(false);
  const [showPriceCheck, setShowPriceCheck] = useState(false);
  const [showReturnItems, setShowReturnItems] = useState(false);

  const [selectedBaudRate, setSelectedBaudRate] = useState(9600);
  const [connecting, setConnecting] = useState(false);

  const { weight, ports, selectedPort, isConnected, connectScale, error } = useScale();

  const handleConnect = async (portName) => {
    try {
      if (!portName) {
        // console.log('No port selected');
        return;
      }
      setConnecting(true);
      // console.log('Attempting to connect to:', portName);
      await connectScale(portName, selectedBaudRate);
    } catch (error) {
      // console.error('Connection error:', error);
    } finally {
      setConnecting(false);
    }
  };

  const toggleMainSidebar = () => {
    setShowMainSidebar(!showMainSidebar);
  };

  const handleLogout = async () => {
    try {
      // Check if there are any orders with items
      const ordersWithItems = orders.filter((order) => {
        const orderItems = order.id === currentOrderId ? cart : order.items;
        return orderItems && orderItems.length > 0;
      });

      if (ordersWithItems.length > 0) {
        toast.error('لا يمكنك تسجيل الخروج حتى تغلق جميع الطلبات التي تحتوي على مواد', {
          position: 'top-right',
          autoClose: 1000,
          theme: 'colored',
        });
        return; // Prevent logout
      }

      // Disconnect scale before logout
      if (isConnected) {
        await window.electronAPI.disconnectScale();
      }

      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const terminal_id = localStorage.getItem('posTerminal');
      const posDateTime = await getPOSDateTime();

      // Create logout log entry
      const logEntry = {
        _id: uuidv4(),
        document_type: 'log',
        statement: `تم تسجيل الخروج من قبل ${currentUser.username}`,
        user_id: currentUser.id,
        terminal_id: terminal_id,
        created_at: posDateTime,
        realworld_date: new Date().toISOString(),
      };

      await db.put(logEntry);

      // Clear local storage and redirect
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentShift');
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('حدث خطأ أثناء تسجيل الخروج', {
        position: 'top-right',
        autoClose: 1000,
        theme: 'colored',
      });
    }
  };

  const addProductToCart = async (product) => {
    try {
      // First ensure we have an active order
      await ensureActiveOrder();

      // Check if product already exists in cart and is not a special item
      const existingItem = cart.find((item) => item._id === product._id && !item.is_offer_applied && !item.weight_locked);

      if (existingItem) {
        // Add safety check for maximum quantity
        if (existingItem.quantity >= 9999) {
          toast.error('لا يمكن زيادة الكمية أكثر من ذلك', {
            position: 'top-right',
            autoClose: 1000,
            theme: 'colored',
          });
          return;
        }
        // If item exists, update its quantity instead of adding new item
        await updateQuantity(product._id, 1);
      } else {
        // If item doesn't exist or is a special item, add it normally
        await addToCart(product);
      }

      // Fetch and update related products
      try {
        const similarProducts = await fetchRelatedProducts(product._id);
        setRelatedProducts(similarProducts.filter((p) => p._id !== product._id));
      } catch (error) {
        console.error('Error fetching similar products:', error);
        setRelatedProducts([]);
      }

      setShowSearchDropdown(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error adding product to cart:', error);
      toast.error('حدث خطأ أثناء إضافة المنتج', {
        position: 'top-right',
        autoClose: 1000,
        theme: 'colored',
      });
    }
  };

  const addRelatedProductToCart = async (product) => {
    addToCart(product);
    // Update related products after adding a related product
    try {
      const similarProducts = await fetchRelatedProducts(product._id);
      setRelatedProducts(similarProducts.filter((p) => p._id !== product._id)); // Exclude the current product
    } catch (error) {
      console.error('Error fetching similar products:', error);
      setRelatedProducts([]);
    }
  };

  const removeProductFromCart = (productId) => {
    removeFromCart(productId);
  };

  const handleClearCart = (orderId) => {
    clearCart(orderId);
  };

  const searchProducts = async (e) => {
    const searchTerm = e.target.value;
    setSearchQuery(searchTerm);
    setShowSearchDropdown(true);

    if (!searchTerm.trim()) {
      setShowSearchDropdown(false);
    }
  };

  const handleCategoryClick = async (category) => {
    setSelectedCategory(category);
    setShowCategorySidebar(true);

    try {
      // Fetch all products listed in the special category's product_ids
      const products = await Promise.all(
        category.product_ids.map(async (productId) => {
          try {
            return await db.get(productId);
          } catch (error) {
            console.error(`Error fetching product ${productId}:`, error);
            return null;
          }
        }),
      );

      // Filter out any null values from failed fetches
      const validProducts = products.filter((product) => product !== null);

      setCategoryProducts(validProducts);
      // If first product exists, fetch its similar products
      if (validProducts.length > 0) {
        const similarProducts = await fetchRelatedProducts(validProducts[0]._id);
        setRelatedProducts(similarProducts);
      } else {
        setRelatedProducts([]);
      }
    } catch (error) {
      console.error('Error fetching category products:', error);
    }
  };

  const closeSidebar = () => {
    setShowCategorySidebar(false);
    setSelectedCategory(null);
    setCategoryProducts([]);
  };

  const addNewOrder = () => {
    const newOrderId = uuidv4();
    setOrders([...orders, { id: newOrderId, items: [] }]);
    setCurrentOrderId(newOrderId);
    setCart([]);
  };

  const selectOrder = (orderId) => {
    // First, save current cart items to current order
    if (currentOrderId) {
      setOrders((prevOrders) => prevOrders.map((order) => (order.id === currentOrderId ? { ...order, items: cart } : order)));
    }

    // Then update current order and cart
    setCurrentOrderId(orderId);
    if (orderId) {
      const selectedOrder = orders.find((order) => order.id === orderId);
      setCart(selectedOrder ? selectedOrder.items : []);
    } else {
      setCart([]);
    }
  };

  const handleNumberInput = (value) => {
    setAmountReceived((prevAmount) => {
      // If starting with decimal point, add leading zero
      if (value === '.' && prevAmount === '') {
        return '0.';
      }

      // Prevent multiple decimal points
      if (value === '.' && prevAmount.includes('.')) {
        return prevAmount;
      }

      const newAmount = prevAmount + value;

      // Split into whole and decimal parts
      const [wholePart, decimalPart] = newAmount.split('.');

      // Check if whole part exceeds 6 digits
      if (wholePart.length > 6) {
        return prevAmount;
      }

      // Check decimal places (max 3)
      if (decimalPart && decimalPart.length > 3) {
        return prevAmount;
      }

      return newAmount;
    });
  };

  const handleClearInput = () => {
    setAmountReceived('');
  };

  const handleBackspace = () => {
    setAmountReceived((prevAmount) => prevAmount.slice(0, -1));
  };

  const handleWithdrawClick = () => {
    setShowExpenseVoucher(true);
  };

  const closeExpenseVoucher = () => {
    setShowExpenseVoucher(false);
  };

  const handleDepositClick = () => {
    setShowReceiptVoucher(true);
  };

  const closeReceiptVoucher = () => {
    setShowReceiptVoucher(false);
  };

  const handlePriceCheckClick = () => {
    setShowPriceCheck(true);
  };

  const closePriceCheck = () => {
    setShowPriceCheck(false);
  };

  const handleReturnItemsClick = () => {
    setShowReturnItems(true);
  };

  const closeReturnItems = () => {
    setShowReturnItems(false);
  };

  const filteredProducts = products.filter((product) => {
    // First check if product exists
    if (!product) {
      return false;
    }

    // Then check if it's a scalable item or other product
    if (product.is_scalable_item || product.is_other_product) {
      return false;
    }

    const searchLower = searchQuery.toLowerCase();
    return product.name?.toLowerCase().includes(searchLower) || product.name_ar?.toLowerCase().includes(searchLower) || product.barcode?.includes(searchQuery) || product.other_barcodes?.some((barcode) => barcode.includes(searchQuery));
  });

  useEffect(() => {
    if (currentOrderId) {
      const updatedOrders = orders.map((order) => (order.id === currentOrderId ? { ...order, items: cart } : order));
      setOrders(updatedOrders);
    }
  }, [cart, currentOrderId]);

  const handleProductSelect = async (productId) => {
    try {
      const similarProducts = await fetchRelatedProducts(productId);
      setRelatedProducts(similarProducts);
    } catch (error) {
      console.error('Error fetching similar products:', error);
      setRelatedProducts([]);
    }
  };

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [bufferSize, setBufferSize] = useState(255);

  const renderScaleControls = () => {
    return (
      <div className="bg-white rounded-lg shadow-md p-2 relative">
        <h3 className="font-bold mb-2">Scale Controls</h3>
        <div className="absolute top-0 left-0 p-2 text-sm font-bold text-gray-700">Weight: {weight} kg</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <select
              value={selectedPort}
              onChange={(e) => {
                handleConnect(e.target.value);
              }}
              className="border rounded p-1"
              disabled={connecting}
            >
              <option value="">Select Port</option>
              {ports.map((port) => (
                <option key={port.path} value={port.path}>
                  {port.path} - {port.manufacturer || 'Unknown'}
                </option>
              ))}
            </select>
            <select value={selectedBaudRate} onChange={(e) => setSelectedBaudRate(parseInt(e.target.value))} className="border rounded p-1" disabled={connecting || isConnected}>
              {baudRates.map((rate) => (
                <option key={rate} value={rate}>
                  {rate} baud
                </option>
              ))}
            </select>
            <div className={`border rounded p-2 ${connecting ? 'bg-yellow-100' : isConnected ? 'bg-green-100' : 'bg-red-100'}`}>Status: {connecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}</div>
          </div>
          <div className="border rounded p-2">
            <div className="text-xs text-gray-500">
              Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
              {connecting && ' (Connecting...)'}
            </div>
            <div className="text-xs text-gray-500">Selected Port: {selectedPort || 'None'}</div>
            <div className="text-xs text-gray-500">Baud Rate: {selectedBaudRate}</div>
          </div>

          {error && <div className="text-red-500 text-sm p-2 border border-red-200 rounded bg-red-50">Error: {error}</div>}
        </div>
        <button onClick={() => setShowAdvancedSettings(!showAdvancedSettings)} className="px-2 py-1 border rounded hover:bg-gray-100">
          {showAdvancedSettings ? 'Hide' : 'Show'} Advanced Settings
        </button>
        {renderAdvancedSettings()}
      </div>
    );
  };

  const renderAdvancedSettings = () => {
    if (!showAdvancedSettings) return null;

    return (
      <div className="mt-2 p-2 border rounded">
        <h4 className="font-bold mb-1">Advanced Settings</h4>
        <div className="flex gap-2 items-center">
          <label>Buffer Size:</label>
          <select value={bufferSize} onChange={(e) => setBufferSize(Number(e.target.value))} className="border rounded p-1">
            {[64, 128, 255, 512, 1024].map((size) => (
              <option key={size} value={size}>
                {size} bytes
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const { tabs, scaledItems, selectedTab, setSelectedTab, fetchScaledItems } = useTabs();

  const handleTabSelect = (tabId) => {
    setSelectedTab(tabId);
    if (tabId !== 'supermarket') {
      fetchScaledItems(tabId);
    }
  };

  // Add this useEffect to clean up scale connection on component unmount
  useEffect(() => {
    return () => {
      // Cleanup function
      if (isConnected) {
        connectScale(null); // Disconnect the scale
      }
    };
  }, [isConnected, connectScale]);

  const [showDiscountPopup, setShowDiscountPopup] = useState(false);

  // Update the isPopupOpen check to be more comprehensive
  const isPopupOpen = showPriceCheck || showReturnItems || showDiscountPopup || showReceiptVoucher || showExpenseVoucher || showCashPopup;

  const { BarcodeReader, showNotFoundPopup, notFoundBarcode, closeNotFoundPopup, setIsManualSearch, pendingScans, scanningState } = useBarcode(
    (product) => {
      addToCart(product);
      fetchRelatedProducts(product._id)
        .then((similarProducts) => {
          setRelatedProducts(similarProducts.filter((p) => p._id !== product._id));
        })
        .catch((error) => {
          console.error('Error fetching similar products:', error);
          setRelatedProducts([]);
        });
    },
    !isPopupOpen,
    ensureActiveOrder,
    cart,
    updateQuantity,
  );

  const handleCashDrawerOpen = async () => {
    try {
      const result = await window.electronAPI.openCashDrawer();
      if (result.success) {
        toast.success('تم فتح الدرج بنجاح', {
          position: 'top-right',
          autoClose: 1000,
          theme: 'colored',
        });
      } else {
        toast.error(`فشل فتح الدرج: ${result.error}`, {
          position: 'top-right',
          autoClose: 1000,
          theme: 'colored',
        });
      }
    } catch (error) {
      console.error('Error opening cash drawer:', error);
      toast.error('حدث خطأ أثناء محاولة فتح الدرج', {
        position: 'top-right',
        autoClose: 1000,
        theme: 'colored',
      });
    }
  };

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const terminalId = localStorage.getItem('posTerminal');

    if (!currentUser.id || !terminalId) return;

    // Set up changes listener for shifts
    const changes = db.changes({
      since: 'now',
      live: true,
      include_docs: true,
      filter: function (doc) {
        return doc.document_type === 'shift' && ((doc.type === 'shift' && doc.terminal_id === terminalId && doc.user_id === currentUser.id) || (doc.type === 'opening_balance' && doc.terminal_id === terminalId));
      },
    });

    changes.on('change', async (change) => {
      // Check if the change affects our shift
      if (change.doc.document_type === 'shift') {
        const shiftStatus = await checkShiftStatus(currentUser.id, terminalId);

        if (!shiftStatus.allowed) {
          toast.error(shiftStatus.message, {
            position: 'top-right',
            theme: 'colored',
          });
          cleanupOldDocs();
          performCompaction();
          logDatabaseInfo();
          // Use navigate directly instead of handleLogout to avoid potential circular dependencies
          localStorage.removeItem('currentUser');
          localStorage.removeItem('currentShift');
          navigate('/');
        }
      }
    });

    // Cleanup function
    return () => {
      changes.cancel();
    };
  }, [navigate]); // Only depend on navigate

  const clearRelatedProducts = () => {
    setRelatedProducts([]);
  };

  const handleNFCDetection = (nfcTag) => {
    if (isWaitingForNFC) {
      // Verify NFC tag for debit payment approval
      handleNFCApproval(nfcTag);
    } else if (Object.keys(pendingDeletions).length > 0) {
      // Handle deletion approvals
      handleNFCApprovalFromHook(nfcTag);
    } else if (Object.keys(pendingPriceChanges).length > 0) {
      // Handle price change approvals
      handlePriceChangeNFCApproval(nfcTag);
    }
  };

  // Add this function to handle price change NFC approvals
  const handlePriceChangeNFCApproval = async (nfcTag) => {
    try {
      const result = await db.find({
        selector: {
          document_type: 'user',
          nfc_tag: nfcTag,
        },
      });

      if (result.docs.length === 0) {
        toast.error('بطاقة NFC غير مصرح بها', {
          position: 'top-right',
          autoClose: 1000,
          theme: 'colored',
        });
        return;
      }

      // Process all pending price changes
      const pendingRequests = Object.values(pendingPriceChanges);

      for (const requestId of pendingRequests) {
        try {
          const request = await db.get(requestId);
          await db.put({
            ...request,
            status: 'approved',
            approved_by: result.docs[0].username,
            approved_at: new Date().toISOString(),
            approval_method: 'nfc',
          });
        } catch (error) {
          console.error(`Error approving price change request ${requestId}:`, error);
        }
      }

      toast.success('تم التفويض بنجاح', {
        position: 'top-right',
        autoClose: 1000,
        theme: 'colored',
      });
    } catch (error) {
      console.error('Error processing NFC approval:', error);
      toast.error('حدث خطأ أثناء معالجة التفويض', {
        position: 'top-right',
        autoClose: 1000,
        theme: 'colored',
      });
    }
  };

  const handleDiscountRequest = ({ type, value, originalTotal, reason }) => {
    requestDiscount({
      type,
      value,
      originalTotal,
      reason,
    });

    setShowDiscountPopup(false);
  };

  // Add cleanup effect for cart-related state
  useEffect(() => {
    return () => {
      // Clean up cart-related state when component unmounts
      setCart([]);
      setCurrentOrderId(null);
      setRelatedProducts([]);
      setAppliedDiscount(0);
    };
  }, []);

  const [showBarcodeInput, setShowBarcodeInput] = useState(false);

  const handleBarcodeSubmit = (product) => {
    addProductToCart(product);
  };

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-gray-100 font-sans text-sm">
      {BarcodeReader}
      <ToastContainer />
      <Sidebar showMainSidebar={showMainSidebar} toggleMainSidebar={toggleMainSidebar} />

      <div className="flex-grow flex flex-col overflow-hidden">
        <Header toggleMainSidebar={toggleMainSidebar} handleLogout={handleLogout} weight={weight} selectedTab={selectedTab} pendingScans={pendingScans} scanningState={scanningState} />

        <div className="flex-1 grid grid-cols-5 gap-2 p-2 overflow-hidden">
          {/* Left Column */}
          <div className="col-span-2 flex flex-col gap-2 overflow-hidden">
            <div className={`${selectedTab === 'supermarket' ? 'h-[25%]' : 'h-[100%]'} bg-white rounded-lg shadow-md p-2`}>
              <Tabs tabs={tabs} selectedTab={selectedTab} onTabSelect={handleTabSelect} />
              {selectedTab === 'supermarket' ? (
                <RelatedProducts relatedProducts={relatedProducts} addRelatedProductToCart={addRelatedProductToCart} cart={cart} />
              ) : (
                <div className="grid grid-cols-4 gap-1.5 overflow-y-auto min-h-0 max-h-[calc(100%-40px)]">
                  {scaledItems.map((item) => {
                    // Add safety checks and default values
                    const kiloPrice = new Decimal(item.kilo_price || item.price || 0);
                    const currentWeight = new Decimal(weight);
                    const calculatedPrice = kiloPrice;

                    return (
                      <button
                        key={item._id}
                        className="flex flex-col justify-between p-2 border rounded-lg hover:bg-gray-50 text-center disabled:opacity-50 disabled:cursor-not-allowed h-24"
                        onClick={() =>
                          addToCart({
                            ...item,
                            price: calculatedPrice.toNumber(),
                            quantity: currentWeight.toNumber(),
                            unit: 'kg',
                          })
                        }
                        disabled={!weight || weight <= 0}
                      >
                        <div className="overflow-hidden">
                          <div
                            className="font-bold text-gray-800 text-sm overflow-hidden text-ellipsis"
                            style={{
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                              overflow: 'hidden',
                            }}
                          >
                            {item.name_ar || item.name || 'Unnamed Product'}
                          </div>
                        </div>
                        <div>
                          <div className="text-blue-600 font-bold text-sm">{kiloPrice.toDP(2).toString()} د.أ</div>
                          {currentWeight.greaterThan(0) && (
                            <div className="text-xs">
                              <span className="text-gray-500">{calculatedPrice.toDP(2).toString()} د.أ</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedTab === 'supermarket' && (
              <>
                <div className="h-[20%] bg-white rounded-lg shadow-md p-2">
                  <OrdersSection orders={orders} currentOrderId={currentOrderId} selectOrder={selectOrder} addNewOrder={addNewOrder} clearRelatedProducts={clearRelatedProducts} setOrders={setOrders} />
                </div>
                <div className="flex-1 bg-white rounded-lg shadow-md p-2">
                  <CheckoutSummary
                    calculateTotals={calculateTotals}
                    selectedPaymentMethod={selectedPaymentMethod}
                    handlePaymentMethodSelect={setSelectedPaymentMethod}
                    handlePayButtonClick={handlePayment}
                    cashImg={cashImg}
                    cardImg={cardImg}
                    debtImg={debtImg}
                    cart={cart}
                    appliedDiscount={appliedDiscount}
                    isWaitingForNFC={isWaitingForNFC}
                    nfcPendingOrderId={nfcPendingOrderId}
                    currentOrderId={currentOrderId}
                    onDiscountClick={() => setShowDiscountPopup(true)}
                    onCancelNFC={cancelNFCWaiting}
                    pendingDiscountRequests={pendingDiscountRequests}
                    setShowCashPopup={setShowCashPopup}
                  />
                </div>
              </>
            )}
          </div>

          {/* Right Column */}
          <div className="col-span-3 flex flex-col gap-2 min-h-0">
            <div className="h-[100%] bg-white rounded-lg shadow-md p-2 flex flex-col min-h-0">
              <div className="flex-none">
                <SearchAndClearCart
                  clearCart={handleClearCart}
                  searchQuery={searchQuery}
                  searchProducts={searchProducts}
                  showSearchDropdown={showSearchDropdown}
                  filteredProducts={filteredProducts}
                  addProductToCart={addProductToCart}
                  onProductSelect={handleProductSelect}
                  onNFCApproval={handleNFCDetection}
                  setIsManualSearch={setIsManualSearch}
                  cart={cart}
                  orderId={currentOrderId}
                  orders={orders}
                />
              </div>

              <div className="flex-1 overflow-auto min-h-0">
                <CartTable
                  cart={cart}
                  handleQuantityChange={updateQuantity}
                  removeProductFromCart={removeProductFromCart}
                  pendingDeletions={pendingDeletions}
                  pendingDiscountRequest={pendingDiscountRequest}
                  appliedDiscount={appliedDiscount}
                  isWaitingForNFC={isWaitingForNFC}
                  setCart={setCart}
                  setOrders={setOrders}
                  currentOrderId={currentOrderId}
                  updateItemPrice={updateItemPrice}
                  pendingPriceChanges={pendingPriceChanges}
                />
              </div>
            </div>

            <div className="flex-1 grid grid-rows-1 gap-2">
              <CategoryButtons categories={categories} handleCategoryClick={handleCategoryClick} />
              <div className="bg-white rounded-lg shadow-md p-2">
                <ActionButtons onCashOpen={handleCashDrawerOpen} onPriceCheck={handlePriceCheckClick} onWithdraw={handleWithdrawClick} onDeposit={handleDepositClick} onReturnItems={handleReturnItemsClick} onBarcodeInput={() => setShowBarcodeInput(true)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ExpenseVoucherPopup isOpen={showExpenseVoucher} onClose={closeExpenseVoucher} />
      <ReceiptVoucherPopup isOpen={showReceiptVoucher} onClose={closeReceiptVoucher} />
      <PriceScannerPopup isOpen={showPriceCheck} onClose={closePriceCheck} />
      <ReturnItemsPopup isOpen={showReturnItems} onClose={closeReturnItems} />

      <CategorySidebar showCategorySidebar={showCategorySidebar} closeSidebar={closeSidebar} selectedCategory={selectedCategory} categoryProducts={categoryProducts} cart={cart} removeFromCart={removeFromCart} addToCart={addProductToCart} />

      <CashPopup
        showCashPopup={showCashPopup}
        setShowCashPopup={setShowCashPopup}
        amountReceived={amountReceived}
        handleNumberInput={handleNumberInput}
        handleBackspace={handleBackspace}
        handleClearInput={handleClearInput}
        handleCashPayment={(additionalData) => {
          const totals = calculateTotals();
          handleCashPayment({
            ...totals,
            pendingDiscountRequests,
            ...additionalData // Pass through the additionalData from CashPopup
          });
        }}
        subtotal={calculateTotals().total}
        pendingDiscountRequests={pendingDiscountRequests}
        currentOrderId={currentOrderId}
        selectedPaymentMethod={selectedPaymentMethod}
      />

      <DiscountRequestPopup isOpen={showDiscountPopup} onClose={() => setShowDiscountPopup(false)} onRequest={handleDiscountRequest} subtotal={calculateTotals().subtotal} />

      <ProductNotFoundPopup isOpen={showNotFoundPopup} onClose={closeNotFoundPopup} barcode={notFoundBarcode} />

      <BarcodeInputPopup isOpen={showBarcodeInput} onClose={() => setShowBarcodeInput(false)} onSubmit={handleBarcodeSubmit} />

      {/* {renderScaleControls()} */}
    </div>
  );
}

export default HomePage;
