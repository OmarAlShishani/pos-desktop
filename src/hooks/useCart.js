import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import db from '../pouchdb';
import { toast } from 'react-toastify';
import { useScale } from './useScale';
import { useState, useEffect, useRef } from 'react';
import EventEmitter from 'events';

EventEmitter.defaultMaxListeners = 20;

const toastConfig = {
  position: 'top-right',
  autoClose: 1000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: 'colored',
  className: 'font-bold text-xl p-4 min-w-[300px]',
  style: { textAlign: 'center' },
  rtl: true,
};

// Helper to get current user details
const getUserDetails = () => {
  const currentUser = localStorage.getItem('currentUser');
  return currentUser ? JSON.parse(currentUser) : { username: 'unknown' };
};

// Helper to build deletion keys uniformly
const buildDeletionKey = (orderId, productId, key) => (key ? `${orderId}-${productId}-${key}` : `${orderId}-${productId}`);

const applyOffers = (product, quantity, existingItem = null) => {
  const baseItem = existingItem || product;
  // Using slice to clone array and sort descending by quantity
  const sortedOffers = baseItem.offers.slice().sort((a, b) => b.quantity - a.quantity);
  const newItems = [];
  let remainingQuantity = quantity;
  // Cache the base timestamp to avoid repeated Date constructions
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
          // Adding a small offset based on the iteration index
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

export const useCart = () => {
  const [cart, setCart] = useState([]);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [pendingDeletions, setPendingDeletions] = useState({});
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedProductsListener, setRelatedProductsListener] = useState(null);
  const [appliedDiscounts, setAppliedDiscounts] = useState({});
  const [pendingDiscountRequests, setPendingDiscountRequests] = useState({});
  const { weight, getItemWeight } = useScale();
  const activeListenersRef = useRef([]);
  // Using a ref for updates that don't need to trigger re-renders
  const pendingUpdatesRef = useRef({});
  const [pendingPriceChanges, setPendingPriceChanges] = useState({});

  const ensureActiveOrder = async () => {
    if (!currentOrderId) {
      const newOrderId = uuidv4();
      setOrders((prev) => {
        if (!prev.some((order) => order.id === newOrderId)) {
          return [...prev, { id: newOrderId, items: [] }];
        }
        return prev;
      });
      setCurrentOrderId(newOrderId);
      return newOrderId;
    }
    return currentOrderId;
  };

  const fetchRelatedProducts = async (categoryId) => {
    try {
      const result = await db.find({
        selector: { document_type: 'product', category_id: categoryId },
        limit: 6,
      });
      const changes = db
        .changes({
          since: 'now',
          live: true,
          include_docs: true,
          filter: (doc) => doc.document_type === 'product' && doc.category_id === categoryId,
        })
        .on('change', (change) => {
          if (change.deleted) {
            setRelatedProducts((prev) => prev.filter((p) => p._id !== change.id));
          } else {
            const updatedDoc = change.doc;
            setRelatedProducts((prev) => {
              const index = prev.findIndex((p) => p._id === updatedDoc._id);
              if (index >= 0) {
                const newProducts = [...prev];
                newProducts[index] = updatedDoc;
                return newProducts;
              }
              return prev.length < 6 ? [...prev, updatedDoc] : prev;
            });
          }
        });
      setRelatedProductsListener(changes);
      setRelatedProducts(result.docs);
    } catch (error) {
      console.error('Error fetching related products:', error);
      setRelatedProducts([]);
    }
  };

  useEffect(() => {
    return () => {
      if (relatedProductsListener) {
        relatedProductsListener.cancel();
      }
    };
  }, [relatedProductsListener]);

  const addToCart = async (product) => {
    if (product.is_scalable_item) {
      handleScalableItem(product);
      return;
    }
    if (product.has_offer && product.offers) {
      handleItemWithOffer(product);
      return;
    }
    handleRegularItem(product);
    if (product.category_id) {
      fetchRelatedProducts(product.category_id).catch(console.error);
    }
  };

  const handleScalableItem = (product) => {
    ensureActiveOrder();
    const weightValue = getItemWeight(product);
    const existingItem = cart.find((item) => item._id === product._id && item.is_scalable_item);
    if (existingItem) {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item._id === product._id && item.is_scalable_item
            ? {
                ...item,
                quantity: new Decimal(item.quantity).plus(weightValue).toString(),
                price: new Decimal(item.original_price).times(new Decimal(item.quantity).plus(weightValue)).toString(),
                weight_locked: true,
              }
            : item,
        ),
      );
    } else {
      const newItem = {
        ...product,
        quantity: weightValue,
        original_price: product.kilo_price || product.price,
        price: new Decimal(product.kilo_price || product.price).times(weightValue).toString(),
        weight_locked: true,
        added_at: new Date().toISOString(),
      };
      setCart((prevCart) => [...prevCart, newItem]);
    }
    updateOrderItems();
  };

  const handleItemWithOffer = (product) => {
    const newItem = {
      ...createCartItem(product, 1),
      offer_group_id: uuidv4(), // Unique group id to prevent combining offers
    };
    setCart((prevCart) => [...prevCart, newItem]);
    updateOrderItems(newItem);
  };

  const handleRegularItem = (product) => {
    const existingItem = cart.find((item) => item._id === product._id && !item.is_offer_applied);
    if (existingItem) {
      setCart((prevCart) => prevCart.map((item) => (item._id === product._id && !item.is_offer_applied ? { ...item, quantity: item.quantity + 1 } : item)));
    } else {
      const newItem = createCartItem(product);
      setCart((prevCart) => [...prevCart, newItem]);
    }
    updateOrderItems();
  };

  const createCartItem = (product, quantity = 1) => ({
    ...product,
    quantity: product.is_scalable_item ? getItemWeight(product) : quantity,
    original_price: product.price,
    price: product.price,
    weight_locked: product.is_scalable_item,
    is_offer_applied: false,
    has_offer: product.has_offer,
    offers: product.offers,
    added_at: new Date().toISOString(),
  });

  const updateOrderItems = (newItem = null) => {
    setOrders((prevOrders) => prevOrders.map((order) => (order.id === currentOrderId ? { ...order, items: newItem ? [...cart, newItem] : cart } : order)));
  };

  const updateQuantity = async (productId, change, isDirectUpdate = false) => {
    const MAX_QUANTITY = 9999;
    if (isDirectUpdate) {
      if (change > MAX_QUANTITY) {
        toast.error('الكمية المدخلة كبيرة جداً', toastConfig);
        return;
      }
    } else {
      const targetItem = findTargetItem(productId);
      if (targetItem && targetItem.quantity + change > MAX_QUANTITY) {
        toast.error('لا يمكن زيادة الكمية أكثر من ذلك', toastConfig);
        return;
      }
    }
    if (shouldHandleRemoval(change, isDirectUpdate, productId)) {
      return;
    }
    const updateKey = `${productId}-${Date.now()}`;
    if (pendingUpdatesRef.current[updateKey]) return;
    pendingUpdatesRef.current[updateKey] = true;
    try {
      if (isDirectUpdate) {
        const allItems = cart.filter((item) => item._id === productId);
        if (!allItems.length) return;
        const baseItem = allItems.reduce((latest, current) => (new Date(current.added_at) > new Date(latest.added_at) ? current : latest), allItems[0]);
        const newQuantity = change;
        setCart((prevCart) => {
          const otherItems = prevCart.filter((item) => item._id !== productId || (item.offer_group_id && item.offer_group_id !== baseItem.offer_group_id) || (!item.offer_group_id && item.added_at !== baseItem.added_at) || item.is_offer_applied);
          if (baseItem.has_offer && baseItem.offers) {
            const newItems = applyOffers(baseItem, newQuantity, baseItem);
            return [...otherItems, ...newItems];
          }
          return [...otherItems, { ...baseItem, quantity: newQuantity, added_at: baseItem.added_at }];
        });
      } else {
        const targetItem = findTargetItem(productId);
        if (!targetItem) return;
        setCart((prevCart) =>
          prevCart.map((item) => {
            const isMatch = item._id === targetItem._id && ((item.offer_group_id && item.offer_group_id === targetItem.offer_group_id) || (!item.offer_group_id && item.added_at === targetItem.added_at));
            if (isMatch) {
              if (item.has_offer && item.offers) {
                const [newItem] = applyOffers(item, item.quantity + change, item);
                return { ...newItem, offer_group_id: item.offer_group_id };
              }
              return { ...item, quantity: item.quantity + change };
            }
            return item;
          }),
        );
      }
      setOrders((prevOrders) => prevOrders.map((order) => (order.id === currentOrderId ? { ...order, items: cart } : order)));
    } finally {
      delete pendingUpdatesRef.current[updateKey];
    }
  };

  const shouldHandleRemoval = (change, isDirectUpdate, productId) => {
    if (change < 0 && !isDirectUpdate) {
      const matchingItems = cart.filter((item) => item._id === productId);
      let targetItem = matchingItems.find((item) => !item.is_offer_applied);
      if (!targetItem && matchingItems.length > 0) {
        targetItem = matchingItems.reduce((latest, current) => (new Date(current.added_at) > new Date(latest.added_at) ? current : latest), matchingItems[0]);
      }
      if (!targetItem) return true;
      const itemPosition = cart.findIndex((item) => item._id === targetItem._id && item.added_at === targetItem.added_at);
      const itemKey = `${targetItem.added_at}-${itemPosition}`;
      const uniqueKey = buildDeletionKey(currentOrderId, productId, itemKey);
      if (targetItem.quantity + change <= 0) {
        removeFromCart(productId, itemKey);
        return true;
      }
      if (pendingDeletions[uniqueKey]) {
        toast.info('طلب حذف هذا المنتج قيد المعالجة', toastConfig);
        return true;
      }
      requestRemoveFromCart(productId, {
        quantityChange: change,
        itemKey: itemKey,
        timestamp: targetItem.added_at,
      });
      return true;
    }
    return false;
  };

  const findTargetItem = (productId) => {
    const items = cart.filter((item) => item._id === productId);
    if (!items.length) return null;
    return items.reduce((latest, current) => {
      if (!latest) return current;
      if (!current.is_offer_applied && latest.is_offer_applied) return current;
      if ((!current.is_offer_applied && !latest.is_offer_applied) || (current.is_offer_applied && latest.is_offer_applied)) {
        return new Date(current.added_at) > new Date(latest.added_at) ? current : latest;
      }
      return latest;
    }, null);
  };

  const removeFromCart = async (productId) => {
    try {
      const deletionKey = buildDeletionKey(currentOrderId, productId);
      if (pendingDeletions[deletionKey]) {
        toast.info('طلب حذف هذا المنتج قيد المعالجة', toastConfig);
        return;
      }
      const targetOrder = orders.find((order) => order.id === currentOrderId);
      const targetItem = targetOrder?.items.find((item) => item._id === productId);
      if (!targetItem) {
        console.error('Target item not found');
        return;
      }
      const requestId = uuidv4();
      const userDetails = getUserDetails();
      await db.put({
        _id: requestId,
        document_type: 'deletion_request',
        product_id: productId,
        status: 'pending',
        requestedBy: userDetails.username,
        timestamp: new Date().toISOString(),
        orderId: currentOrderId,
        quantityChange: 0,
        item_timestamp: targetItem.added_at,
      });
      setPendingDeletions((prev) => ({
        ...prev,
        [deletionKey]: requestId,
      }));
      toast.info('تم إرسال طلب حذف المنتج للإدارة', toastConfig);
      listenForApproval(requestId, productId, 0, currentOrderId);
    } catch (error) {
      console.error('Error requesting deletion:', error);
      toast.error('حدث خطأ أثناء طلب التعديل');
    }
  };

  const clearCart = async (targetOrderId) => {
    const targetOrder = orders.find((order) => order.id === targetOrderId);
    const targetItems = targetOrder ? targetOrder.items : [];
    const orderPendingDeletions = Object.entries(pendingDeletions).some(([key]) => key.startsWith(`${targetOrderId}-`));
    try {
      const result = await db.find({
        selector: {
          document_type: 'bulk_deletion_request',
          orderId: targetOrderId,
          status: 'pending',
        },
      });
      if (orderPendingDeletions && result.docs.length > 0) {
        toast.info('يرجى الانتظار حتى تتم معالجة طلبات الحذف الحالية', toastConfig);
        return;
      }
      if (!targetItems || targetItems.length === 0) return;
      const requestId = uuidv4();
      const userDetails = getUserDetails();
      await db.put({
        _id: requestId,
        document_type: 'bulk_deletion_request',
        products: targetItems.map((item) => item._id),
        status: 'pending',
        requestedBy: userDetails.username,
        timestamp: new Date().toISOString(),
        orderId: targetOrderId,
      });
      const newPendingDeletions = {};
      targetItems.forEach((item) => {
        const deletionKey = buildDeletionKey(targetOrderId, item._id);
        newPendingDeletions[deletionKey] = requestId;
      });
      setPendingDeletions((prev) => ({ ...prev, ...newPendingDeletions }));
      toast.info('تم إرسال طلب حذف جميع المنتجات للإدارة', toastConfig);
      listenForBulkApproval(requestId, targetOrderId);
    } catch (error) {
      console.error('Error requesting bulk deletion:', error);
      toast.error('حدث خطأ أثناء طلب حذف جميع المنتجات');
    }
  };

  const listenForBulkApproval = (requestId, targetOrderId) => {
    const changes = db.changes({
      since: 'now',
      live: true,
      include_docs: true,
    });
    changes.on('change', (change) => {
      if (change.id === requestId) {
        if (change.deleted || (change.doc && change.doc.status === 'approved')) {
          setOrders((prevOrders) =>
            prevOrders.map((order) => {
              if (order.id === targetOrderId) {
                if (order.id === currentOrderId) {
                  setCart([]);
                }
                return { ...order, items: [] };
              }
              return order;
            }),
          );
          setPendingDeletions((prev) => {
            const newPending = { ...prev };
            Object.keys(newPending).forEach((key) => {
              if (key.startsWith(`${targetOrderId}-`)) {
                delete newPending[key];
              }
            });
            return newPending;
          });
          toast.success('تم حذف جميع المنتجات', toastConfig);
          changes.cancel();
        } else if (change.doc && (change.doc.status === 'rejected' || change.doc.status === 'declined')) {
          setPendingDeletions((prev) => {
            const newPending = { ...prev };
            Object.keys(newPending).forEach((key) => {
              if (key.startsWith(`${targetOrderId}-`)) {
                delete newPending[key];
              }
            });
            return newPending;
          });
          toast.error('تم رفض طلبك', toastConfig);
          changes.cancel();
        }
      }
    });
    changes.on('error', (err) => {
      console.error('Error in changes feed:', err);
      toast.error('حدث خطأ في متابعة طلب الحذف', toastConfig);
    });
  };

  const calculateTotals = () => {
    const itemCount = cart.reduce((sum, item) => sum + (item.is_scalable_item ? 1 : item.quantity || 0), 0);
    const totals = cart.reduce(
      (acc, item) => {
        const quantity = new Decimal(item.quantity || 0);
        const price = new Decimal(item.is_scalable_item ? item.kilo_price || item.original_price || 0 : item.price || 0);
        const itemTotal = quantity.times(price);
        const taxPercentage = new Decimal(item.tax_percentage || 0);
        const itemTax = item.tax_type === 'taxable' ? itemTotal.times(taxPercentage).dividedBy(100) : new Decimal(0);
        return {
          subtotal: acc.subtotal.plus(itemTotal),
          tax: acc.tax.plus(itemTax),
        };
      },
      { subtotal: new Decimal(0), tax: new Decimal(0) },
    );
    const discountDecimal = new Decimal(appliedDiscounts[currentOrderId] || 0);
    const total = totals.subtotal.minus(discountDecimal);
    return {
      itemCount,
      tax: totals.tax.toFixed(4),
      subtotal: totals.subtotal.toFixed(4),
      discount: appliedDiscounts[currentOrderId] || 0,
      total: total.toFixed(4),
    };
  };

  const requestRemoveFromCart = async (productId, options = {}, orderId = currentOrderId) => {
    try {
      const deletionKey = buildDeletionKey(orderId, productId, options.itemKey);
      if (pendingDeletions[deletionKey]) {
        toast.info('طلب حذف هذا المنتج قيد المعالجة', toastConfig);
        return;
      }
      const targetOrder = orders.find((order) => order.id === orderId);
      const targetItem = targetOrder?.items.find((item) => (options.timestamp ? item._id === productId && item.added_at === options.timestamp : item._id === productId));
      if (!targetItem) {
        console.error('Target item not found with params:', { productId, options });
        return;
      }
      const requestId = uuidv4();
      const userDetails = getUserDetails();
      await db.put({
        _id: requestId,
        document_type: 'deletion_request',
        product_id: productId,
        status: 'pending',
        requestedBy: userDetails.username,
        timestamp: new Date().toISOString(),
        orderId,
        quantityChange: options.quantityChange,
        item_timestamp: targetItem.added_at,
        item_key: options.itemKey,
      });
      setPendingDeletions((prev) => ({ ...prev, [deletionKey]: requestId }));
      if (options.quantityChange) {
        toast.info('تم إرسال طلب إنقاص الكمية للإدارة', toastConfig);
      } else {
        toast.info('تم إرسال طلب حذف المنتج للإدارة', toastConfig);
      }
      listenForApproval(requestId, productId, options.quantityChange, orderId, options.itemKey);
    } catch (error) {
      console.error('Error requesting deletion:', error);
      toast.error('حدث خطأ أثناء طلب التعديل');
    }
  };

  const removeApprovedItem = async (productId, requestId, orderId) => {
    try {
      let itemKey = null;
      try {
        const deletionDoc = await db.get(requestId);
        itemKey = deletionDoc.item_key;
      } catch (docError) {
        console.log('Deletion document not found, using fallback data');
      }
      if (itemKey) {
        const [timestamp, positionStr] = itemKey.split('-');
        const targetPosition = parseInt(positionStr, 10);
        setOrders((prevOrders) =>
          prevOrders.map((order) => {
            if (order.id !== orderId) return order;
            const targetItem = order.items.find((item, index) => {
              const itemTimestamp = item.offer_group_id || item.added_at;
              return item._id === productId && itemTimestamp === timestamp && index === targetPosition;
            });
            if (targetItem) {
              return { ...order, items: order.items.filter((_, index) => index !== targetPosition) };
            }
            return order;
          }),
        );
        if (currentOrderId === orderId) {
          setCart((prevCart) => {
            const targetItem = prevCart.find((item, index) => {
              const itemTimestamp = item.offer_group_id || item.added_at;
              return item._id === productId && itemTimestamp === timestamp && index === targetPosition;
            });
            if (targetItem) {
              return prevCart.filter((_, index) => index !== targetPosition);
            }
            return prevCart;
          });
        }
      } else {
        setOrders((prevOrders) =>
          prevOrders.map((order) => {
            if (order.id !== orderId) return order;
            const itemsWithProduct = order.items.filter((item) => item._id === productId);
            if (!itemsWithProduct.length) return order;
            const mostRecentItem = itemsWithProduct.reduce((latest, current) => (new Date(current.added_at) > new Date(latest.added_at) ? current : latest), itemsWithProduct[0]);
            const itemIndex = order.items.findIndex((item) => item._id === productId && item.added_at === mostRecentItem.added_at && item.offer_group_id === mostRecentItem.offer_group_id);
            if (itemIndex !== -1) {
              return { ...order, items: order.items.filter((_, index) => index !== itemIndex) };
            }
            return order;
          }),
        );
        if (currentOrderId === orderId) {
          setCart((prevCart) => {
            const itemsWithProduct = prevCart.filter((item) => item._id === productId);
            if (!itemsWithProduct.length) return prevCart;
            const mostRecentItem = itemsWithProduct.reduce((latest, current) => (new Date(current.added_at) > new Date(latest.added_at) ? current : latest), itemsWithProduct[0]);
            const itemIndex = prevCart.findIndex((item) => item._id === productId && item.added_at === mostRecentItem.added_at && item.offer_group_id === mostRecentItem.offer_group_id);
            if (itemIndex !== -1) {
              return prevCart.filter((_, index) => index !== itemIndex);
            }
            return prevCart;
          });
        }
      }
      const deletionKey = itemKey ? buildDeletionKey(orderId, productId, itemKey) : buildDeletionKey(orderId, productId);
      setPendingDeletions((prev) => {
        const newState = { ...prev };
        delete newState[deletionKey];
        return newState;
      });
    } catch (error) {
      console.error('Error in removeApprovedItem:', error);
      toast.error('حدث خطأ أثناء حذف المنتج');
    }
  };

  const listenForApproval = (requestId, productId, quantityChange = null, orderId, itemKey = null) => {
    const changes = db.changes({
      since: 'now',
      live: true,
      include_docs: true,
    });
    activeListenersRef.current.push(changes);
    changes.on('change', (change) => {
      const deletionKey = itemKey ? buildDeletionKey(orderId, productId, itemKey) : buildDeletionKey(orderId, productId);
      if (change.id === requestId) {
        if (change.deleted || (change.doc && change.doc.status === 'approved')) {
          setPendingDeletions((prev) => {
            const newState = { ...prev };
            delete newState[deletionKey];
            return newState;
          });
          if (quantityChange) {
            if (currentOrderId === orderId) {
              setCart((prevCart) => prevCart.map((item) => (item._id === productId ? { ...item, quantity: item.quantity + quantityChange } : item)));
            }
            setOrders((prevOrders) =>
              prevOrders.map((order) => {
                if (order.id === orderId) {
                  return { ...order, items: order.items.map((item) => (item._id === productId ? { ...item, quantity: item.quantity + quantityChange } : item)) };
                }
                return order;
              }),
            );
            toast.success('تم إنقاص الكمية بنجاح', toastConfig);
          } else {
            removeApprovedItem(productId, requestId, orderId);
            toast.success('تم حذف المنتج', toastConfig);
          }
          changes.cancel();
        } else if (change.doc && (change.doc.status === 'rejected' || change.doc.status === 'declined')) {
          setPendingDeletions((prev) => {
            const newState = { ...prev };
            delete newState[deletionKey];
            return newState;
          });
          toast.error('تم رفض طلبك', toastConfig);
          changes.cancel();
        }
      }
    });
    changes.on('error', (err) => {
      console.error('Error in changes feed:', err);
      toast.error('حدث خطأ في متابعة طلب التعديل', toastConfig);
      activeListenersRef.current = activeListenersRef.current.filter((listener) => listener !== changes);
    });
    const originalCancel = changes.cancel.bind(changes);
    changes.cancel = () => {
      originalCancel();
      activeListenersRef.current = activeListenersRef.current.filter((listener) => listener !== changes);
    };
  };

  const setAppliedDiscount = (amount, orderId) => {
    if (!orderId) return;
    setAppliedDiscounts((prev) => ({ ...prev, [orderId]: amount }));
  };

  const requestDiscount = async (discountData) => {
    if (!currentOrderId) return;
    try {
      if (pendingDiscountRequests[currentOrderId]) {
        toast.info('طلب الخصم قيد المعالجة', toastConfig);
        return;
      }
      const requestId = uuidv4();
      const userDetails = getUserDetails();
      const calculatedDiscount = discountData.type === 'percentage' ? (discountData.originalTotal * discountData.value) / 100 : discountData.value;
      setAppliedDiscount(calculatedDiscount, currentOrderId);
      setPendingDiscountRequests((prev) => ({ ...prev, [currentOrderId]: requestId }));
      await db.put({
        _id: requestId,
        document_type: 'discount_request',
        status: 'pending',
        requestedBy: userDetails.username,
        timestamp: new Date().toISOString(),
        orderId: currentOrderId,
        discountType: discountData.type,
        discountValue: discountData.value,
        originalTotal: discountData.originalTotal,
        calculatedDiscount,
        reason: discountData.reason,
      });
      toast.info('تم إرسال طلب الخصم للإدارة', toastConfig);
      listenForDiscountApproval(requestId, calculatedDiscount, currentOrderId);
    } catch (error) {
      console.error('Error requesting discount:', error);
      toast.error('حدث خطأ أثناء طلب الخصم');
      if (currentOrderId) {
        setAppliedDiscount(0, currentOrderId);
        setPendingDiscountRequests((prev) => {
          const newState = { ...prev };
          delete newState[currentOrderId];
          return newState;
        });
      }
    }
  };

  const listenForDiscountApproval = (requestId, calculatedDiscount, orderId) => {
    const changes = db.changes({
      since: 'now',
      live: true,
      include_docs: true,
      filter: (doc) => doc._id === requestId,
    });
    changes.on('change', async (change) => {
      if (change.id === requestId) {
        if (change.deleted || (change.doc && change.doc.status === 'approved')) {
          setPendingDiscountRequests((prev) => {
            const newState = { ...prev };
            delete newState[orderId];
            return newState;
          });
          toast.success('تمت الموافقة على طلب الخصم', toastConfig);
          changes.cancel();
        } else if (change.doc && (change.doc.status === 'rejected' || change.doc.status === 'declined')) {
          setAppliedDiscount(0, orderId);
          setPendingDiscountRequests((prev) => {
            const newState = { ...prev };
            delete newState[orderId];
            return newState;
          });
          toast.error('تم رفض طلب الخصم', toastConfig);
          changes.cancel();
        }
      }
    });
    changes.on('error', (err) => {
      console.error('Error in changes feed:', err);
      toast.error('حدث خطأ في متابعة طلب الخصم', toastConfig);
      setAppliedDiscount(0, orderId);
      setPendingDiscountRequests((prev) => {
        const newState = { ...prev };
        delete newState[orderId];
        return newState;
      });
    });
    return () => changes.cancel();
  };

  const handleNFCApproval = async (nfcTag) => {
    try {
      const result = await db.find({
        selector: { document_type: 'user', nfc_tag: nfcTag },
      });
      if (result.docs.length === 0) {
        toast.error('بطاقة NFC غير مصرح بها', toastConfig);
        return;
      }
      const pendingRequests = Object.entries(pendingDeletions);
      for (const [productId, requestId] of pendingRequests) {
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
          console.error(`Error approving deletion for product ${productId}:`, error);
        }
      }
      toast.success('تم التفويض بنجاح', toastConfig);
    } catch (error) {
      console.error('Error processing NFC approval:', error);
      toast.error('حدث خطأ أثناء معالجة التفويض', toastConfig);
    }
  };

  const updateScaleItemWeights = (newWeight) => {
    if (newWeight > 0) {
      setCart((prevCart) =>
        prevCart.map((item) => {
          if (item.is_scalable_item && !item.weight_locked) {
            const isNewestScaleItem = !prevCart.some((otherItem) => otherItem.is_scalable_item && otherItem.added_at > item.added_at);
            if (isNewestScaleItem) {
              return {
                ...item,
                quantity: newWeight,
                price: new Decimal(item.original_price).times(newWeight).toString(),
              };
            }
          }
          return item;
        }),
      );
    }
  };

  useEffect(() => {
    updateScaleItemWeights(weight);
  }, [weight]);

  const updateItemPrice = async (productId, newPrice, itemKey) => {
    try {
      const priceChangeKey = `${currentOrderId}-${productId}-${itemKey}`;
      if (pendingPriceChanges[priceChangeKey]) {
        toast.info('طلب تغيير السعر قيد المعالجة', toastConfig);
        return;
      }
      const targetItem = cart.find((item) => item._id === productId && (item.offer_group_id || item.added_at) === itemKey);
      if (!targetItem) {
        console.error('Target item not found');
        return;
      }
      const requestId = uuidv4();
      const userDetails = getUserDetails();
      await db.put({
        _id: requestId,
        document_type: 'price_change_request',
        product_id: productId,
        status: 'pending',
        requestedBy: userDetails.username,
        timestamp: new Date().toISOString(),
        orderId: currentOrderId,
        itemKey: itemKey,
        oldPrice: targetItem.price,
        newPrice: newPrice,
      });
      setPendingPriceChanges((prev) => ({ ...prev, [priceChangeKey]: requestId }));
      toast.info('تم إرسال طلب تغيير السعر للإدارة', toastConfig);
      listenForPriceChangeApproval(requestId, productId, newPrice, itemKey);
    } catch (error) {
      console.error('Error requesting price change:', error);
      toast.error('حدث خطأ أثناء طلب تغيير السعر', toastConfig);
    }
  };

  const listenForPriceChangeApproval = (requestId, productId, newPrice, itemKey) => {
    const changes = db.changes({
      since: 'now',
      live: true,
      include_docs: true,
    });
    changes.on('change', (change) => {
      const priceChangeKey = `${currentOrderId}-${productId}-${itemKey}`;
      if (change.id === requestId) {
        if (change.deleted || (change.doc && change.doc.status === 'approved')) {
          setOrders((prevOrders) =>
            prevOrders.map((order) => {
              if (order.id === currentOrderId) {
                return {
                  ...order,
                  items: order.items.map((item) => {
                    if (item._id === productId && (item.offer_group_id || item.added_at) === itemKey) {
                      return { ...item, price: newPrice, original_price: newPrice };
                    }
                    return item;
                  }),
                };
              }
              return order;
            }),
          );
          setCart((prevCart) =>
            prevCart.map((item) => {
              if (item._id === productId && (item.offer_group_id || item.added_at) === itemKey) {
                return { ...item, price: newPrice, original_price: newPrice };
              }
              return item;
            }),
          );
          setPendingPriceChanges((prev) => {
            const newState = { ...prev };
            delete newState[priceChangeKey];
            return newState;
          });
          toast.success('تم تغيير السعر بنجاح', toastConfig);
          changes.cancel();
        } else if (change.doc && (change.doc.status === 'rejected' || change.doc.status === 'declined')) {
          setPendingPriceChanges((prev) => {
            const newState = { ...prev };
            delete newState[priceChangeKey];
            return newState;
          });
          toast.error('تم رفض طلب تغيير السعر', toastConfig);
          changes.cancel();
        }
      }
    });
    changes.on('error', (err) => {
      console.error('Error in changes feed:', err);
      toast.error('حدث خطأ في متابعة طلب تغيير السعر', toastConfig);
    });
  };

  useEffect(() => {
    return () => {
      activeListenersRef.current.forEach((listener) => {
        if (listener && typeof listener.cancel === 'function') {
          listener.cancel();
        }
      });
    };
  }, []);

  return {
    cart,
    orders,
    currentOrderId,
    appliedDiscount: currentOrderId ? appliedDiscounts[currentOrderId] || 0 : 0,
    setAppliedDiscount: (amount) => setAppliedDiscount(amount, currentOrderId),
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    calculateTotals,
    ensureActiveOrder,
    setCurrentOrderId,
    setOrders,
    setCart,
    requestRemoveFromCart,
    pendingDeletions,
    removeApprovedItem,
    relatedProducts,
    setRelatedProducts,
    relatedProductsListener,
    pendingDiscountRequests,
    requestDiscount,
    handleNFCApproval,
    updateItemPrice,
    pendingPriceChanges,
  };
};
