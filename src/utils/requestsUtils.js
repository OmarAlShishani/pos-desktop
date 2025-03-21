import db from '../pouchdb';
import moment from 'moment';
import { toast } from 'react-toastify';

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

export const getDeleteRequests = async () => {
  try {
    const [regularRequests, bulkRequests] = await Promise.all([
      db.query('pos_index/deletion_requests_by_date', {
        descending: true,
        include_docs: true,
      }),
      db.query('pos_index/bulk_deletion_request_by_date', {
        descending: true,
        include_docs: true,
      }),
    ]);

    const allRequests = [...regularRequests.rows.map((row) => row.doc), ...bulkRequests.rows.map((row) => row.doc)]
      .filter((doc) => doc.status === 'pending') // Only show non-declined requests
      .sort((a, b) => moment(b.timestamp).valueOf() - moment(a.timestamp).valueOf());

    const productIds = new Set();
    allRequests.forEach((req) => {
      if (req.document_type === 'deletion_request') {
        productIds.add(req.product_id);
      } else if (req.document_type === 'bulk_deletion_request') {
        req.products.forEach((pid) => productIds.add(pid));
      }
    });

    const products = await Promise.all(Array.from(productIds).map((id) => db.get(id).catch(() => null)));

    const productsMap = products.reduce((acc, product) => {
      if (product) {
        acc[product._id] = product;
      }
      return acc;
    }, {});

    const enhancedRequests = allRequests.map((req) => {
      if (req.document_type === 'deletion_request') {
        return {
          ...req,
          productNames: productsMap[req.product_id]?.name_ar || 'غير موجود',
        };
      } else {
        return {
          ...req,
          productNames: req.products.map((pid) => productsMap[pid]?.name_ar || 'غير موجود').join('، '),
        };
      }
    });

    return enhancedRequests || [];
  } catch (error) {
    console.error('Delete requests route error:', error);
    return [];
  }
};

export const getDiscountRequests = async () => {
  try {
    const result = await db.query('pos_index/discount_requests_by_date', {
      include_docs: true,
      descending: true,
    });

    return result.rows.map((row) => row.doc).filter((doc) => doc.status === 'pending');
  } catch (error) {
    console.error('Discount requests route error:', error);
    return [];
  }
};

export const getReturnRequests = async () => {
  try {
    const result = await db.query('pos_index/return_requests_by_date', {
      include_docs: true,
      descending: true,
    });

    return result.rows.map((row) => row.doc).filter((doc) => doc.status === 'pending');
  } catch (error) {
    console.error('Return requests route error:', error);
    return [];
  }
};

export const getPriceChangeRequests = async () => {
  try {
    const result = await db.query('pos_index/price_change_requests_by_date', {
      include_docs: true,
      descending: true,
    });

    return result.rows.map((row) => row.doc).filter((doc) => doc.status === 'pending');
  } catch (error) {
    console.error('Return requests route error:', error);
    return [];
  }
};

export const approveRequest = async (id, requestType) => {
  try {
    const doc = await db.get(id);
    switch (requestType) {
      case 'delete':
        {
          if (!['deletion_request', 'bulk_deletion_request'].includes(doc.document_type)) {
            toast.error('Invalid document type', toastConfig);
            return;
          }
          await db.remove(doc);
        }
        break;
      case 'discount':
        {
          if (doc.document_type !== 'discount_request') {
            toast.error('Invalid document type', toastConfig);
            return;
          }
          await db.remove(doc);
        }
        break;
      case 'return':
        {
          await returnRequest(id);
        }
        break;
      case 'priceChange':
        {
          if (doc.document_type !== 'price_change_request') {
            toast.error('Invalid document type', toastConfig);
            return;
          }
          await db.remove(doc);
        }
        break;
    }
  } catch (error) {
    console.error('Error approving request:', error);
    toast.error('حدث خطأ أثناء موافقة الطلب', toastConfig);
  }
};

export const declineRequest = async (id, requestType) => {
  const doc = await db.get(id);
  switch (requestType) {
    case 'delete':
      {
        if (!['deletion_request', 'bulk_deletion_request'].includes(doc.document_type)) {
          toast.error('Invalid document type', toastConfig);
          return;
        }
        doc.status = 'declined';
        await db.put(doc);
      }
      break;
    case 'discount':
      {
        if (doc.document_type !== 'discount_request') {
          toast.error('Invalid document type', toastConfig);
          return;
        }
        doc.status = 'declined';
        await db.put(doc);
      }
      break;
    case 'return':
      {
        if (doc.document_type !== 'return_request') {
          toast.error('Invalid document type', toastConfig);
          return;
        }
        doc.status = 'declined';
        await db.put(doc);
      }
      break;
    case 'priceChange':
      {
        if (doc.document_type !== 'price_change_request') {
          toast.error('Invalid document type', toastConfig);
          return;
        }
        doc.status = 'declined';
        await db.put(doc);
      }
      break;
  }
};

export const handleNFCApproval = async (nfcTag) => {
  try {
    const result = await db.find({
      selector: {
        document_type: 'user',
        nfc_tag: nfcTag,
      },
    });

    if (result.docs.length === 0) {
      toast.error('بطاقة NFC غير مصرح بها', toastConfig);
      return false;
    }

    toast.success('تم التفويض بنجاح', toastConfig);
    return true;
  } catch (error) {
    console.error('Error processing NFC approval:', error);
    toast.error('حدث خطأ أثناء معالجة التفويض', toastConfig);
    return false;
  }
};

export const returnRequest = async (id) => {
  try {
    let returnRequest;
    try {
      returnRequest = await db.get(id);
    } catch (error) {
      console.error('Error fetching return request:', error);
      toast.error('حدث خطأ أثناء جلب طلب الإرجاع', toastConfig);
      return;
    }

    // Validate document type
    if (returnRequest.document_type !== 'return_request') {
      console.error('Invalid document type:', returnRequest.document_type);
      toast.error('نوع المستند غير صالح', toastConfig);
      return;
    }

    // Check if items array exists
    if (!returnRequest.items || !Array.isArray(returnRequest.items)) {
      console.error('No items array found:', returnRequest);
      toast.error('بيانات المنتج غير صالحة', toastConfig);
      return;
    }

    // Update stock for each returned item
    for (const item of returnRequest.items) {
      // Get the product ID (either from _id or product_id)
      const productId = item._id || item.product_id;

      if (!productId) {
        console.error('Missing product ID in item:', item);
        toast.error('بيانات المنتج غير صالحة', toastConfig);
        return;
      }

      if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
        console.error('Invalid quantity in item:', item);
        toast.error('بيانات المنتج غير صالحة', toastConfig);
        return;
      }
      try {
        // Get the latest version of the product
        const product = await db.get(productId);

        if (!product) {
          toast.error('المنتج غير موجود', toastConfig);
          return;
        }

        // Increase showroom stock for the current product
        const oldStock = product.showroom_stock || 0;
        product.showroom_stock = oldStock + item.quantity;
        product.updated_at = new Date().toISOString();

        await db.put(product);

        // Handle special cases for stock updates
        if (product.type === 'container' && product?.parent_product_id && product?.container_qty) {
          // For container types, update parent product stock based on container_qty
          try {
            const parentProduct = await db.get(product.parent_product_id);
            if (parentProduct) {
              const oldParentStock = parentProduct.showroom_stock || 0;
              // Multiply returned quantity by container_qty
              const stockIncrease = item.quantity * product.container_qty;
              parentProduct.showroom_stock = oldParentStock + stockIncrease;
              parentProduct.updated_at = new Date().toISOString();
              await db.put(parentProduct);
            }
          } catch (error) {
            console.error(`Error updating parent product ${product.parent_product_id} stock:`, error);
            toast.error('حدث خطأ أثناء تحديث مخزون المنتج الرئيسي', toastConfig);
            return;
          }
        } else if (product?.is_other_product && product?.main_product_id) {
          // For other products, update main product stock
          try {
            const mainProduct = await db.get(product.main_product_id);
            if (mainProduct) {
              const oldMainStock = mainProduct.showroom_stock || 0;
              mainProduct.showroom_stock = oldMainStock + item.quantity;
              mainProduct.updated_at = new Date().toISOString();
              await db.put(mainProduct);
            }
          } catch (error) {
            console.error(`Error updating main product ${product.main_product_id} stock:`, error);
            toast.error('حدث خطأ أثناء تحديث مخزون المنتج الرئيسي', toastConfig);
            return;
          }
        }
      } catch (error) {
        console.error(`Error updating stock for product ${productId}:`, error);
        toast.error('حدث خطأ أثناء تحديث مخزون المنتج', toastConfig);
        return;
      }
    }

    // Delete the return request
    try {
      await db.remove(returnRequest);
      return true;
    } catch (error) {
      console.error('Error deleting return request:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        returnRequest: returnRequest,
      });
      toast.error('حدث خطأ أثناء حذف الطلب', toastConfig);
      return;
    }
  } catch (error) {
    console.error('Return request approval error:', error);
    toast.error('حدث خطأ أثناء الموافقة على الطلب', toastConfig);
    return;
  }
};
