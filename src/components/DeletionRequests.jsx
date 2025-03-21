import React, { useEffect, useState } from 'react';
import db from '../pouchdb';
import { toast } from 'react-toastify';

const DeletionRequests = () => {
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState({});

  useEffect(() => {
    // Create necessary views/indexes for CouchDB
    createViews();
    // Initial load of pending requests
    loadPendingRequests();

    // Listen for changes
    const changes = db.changes({
      since: 'now',
      live: true,
      include_docs: true,
      filter: function (doc) {
        return doc.document_type === 'deletion_request' && doc.status === 'pending';
      },
    });

    changes.on('change', () => {
      loadPendingRequests();
    });

    return () => changes.cancel();
  }, []);

  const createViews = async () => {
    try {
      const ddoc = {
        _id: '_design/deletion_requests',
        views: {
          pending_requests: {
            map: function (doc) {
              if (doc.document_type === 'deletion_request' && doc.status === 'pending') {
                emit(doc.timestamp, doc);
              }
            }.toString(),
          },
        },
      };

      try {
        await db.put(ddoc);
      } catch (err) {
        if (err.name !== 'conflict') {
          throw err;
        }
        // View already exists
      }
    } catch (error) {
      console.error('Error creating views:', error);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const result = await db.query('deletion_requests/pending_requests', {
        include_docs: true,
      });

      const requests = result.rows.map((row) => row.doc);
      setRequests(requests);

      // Load product details for each request
      const productIds = [...new Set(requests.map((req) => req.product_id))];
      const productDetails = {};

      for (const productId of productIds) {
        try {
          const product = await db.get(productId);
          productDetails[productId] = product;
        } catch (error) {
          console.error(`Error loading product ${productId}:`, error);
        }
      }

      setProducts(productDetails);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const handleRequest = async (request, approved) => {
    try {
      // Update the request document
      const updatedRequest = {
        ...request,
        status: approved ? 'approved' : 'rejected',
        resolvedAt: new Date().toISOString(),
      };

      await db.put(updatedRequest);

      toast.success(approved ? 'تمت الموافقة على طلب الحذف' : 'تم رفض طلب الحذف');
    } catch (error) {
      console.error('Error handling request:', error);
      toast.error('حدث خطأ أثناء معالجة الطلب');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">طلبات حذف المنتجات</h2>
      {requests.length === 0 ? (
        <p>لا توجد طلبات حذف معلقة</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const product = products[request.product_id];
            return (
              <div key={request._id} className="border p-4 rounded-lg bg-white shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{product?.name || 'المنتج غير موجود'}</p>
                    <p className="text-sm text-gray-600">المستخدم: {request.requestedBy}</p>
                    <p className="text-sm text-gray-600">التاريخ: {new Date(request.timestamp).toLocaleString('ar-JO')}</p>
                    <p className="text-sm text-gray-600">رقم الطلب: {request.orderId}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRequest(request, true)} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors">
                      موافقة
                    </button>
                    <button onClick={() => handleRequest(request, false)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors">
                      رفض
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeletionRequests;
