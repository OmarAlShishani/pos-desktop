import React, { useEffect, useState } from 'react';
import { getDeleteRequests, getDiscountRequests, getReturnRequests, getPriceChangeRequests, handleNFCApproval, approveRequest, declineRequest } from '../../utils/requestsUtils';
import DeleteRequests from './deleteRequests';
import DiscountRequests from './DiscountRequests';
import ReturnRequests from './ReturnRequests';
import PriceChangeRequests from './PriceChangeRequests';
import NFCPopup from '../NFCPopup';

const RequestsList = ({ isOpen, onClose }) => {
  const [selectedRequest, setSelectedRequest] = useState('delete');
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNFCPopup, setShowNFCPopup] = useState(false);
  const [actionData, setActionData] = useState({});

  const handleRequestClick = async (requestType) => {
    let requestsData = [];
    setSelectedRequest(requestType);
    setRequests([]);
    setIsLoading(true);
    switch (requestType) {
      case 'delete':
        requestsData = await getDeleteRequests();
        break;
      case 'discount':
        requestsData = await getDiscountRequests();
        break;
      case 'return':
        requestsData = await getReturnRequests();
        break;
      case 'priceChange':
        requestsData = await getPriceChangeRequests();
        break;
      default:
        break;
    }
    setRequests(requestsData);
    setIsLoading(false);
  };

  const selectedRequestText = () => {
    switch (selectedRequest) {
      case 'delete':
        return 'طلبات الحذف';
      case 'discount':
        return 'طلبات الخصم';
      case 'return':
        return 'طلبات الارجاع';
      case 'priceChange':
        return 'طلبات تغير السعر';
      default:
        return '';
    }
  };

  const handleApproveRequest = async (request, requestType) => {
    switch (requestType) {
      case 'delete':
        await approveRequest(request._id, 'delete');
        break;
      case 'discount':
        await approveRequest(request._id, 'discount');
        break;
      case 'return':
        await approveRequest(request._id, 'return');
        break;
      case 'priceChange':
        await approveRequest(request._id, 'priceChange');
        break;
      default:
        break;
    }
    handleRequestClick(requestType);
  };

  const handleDeclineRequest = async (request, requestType) => {
    switch (requestType) {
      case 'delete':
        await declineRequest(request._id, 'delete');
        break;
      case 'discount':
        await declineRequest(request._id, 'discount');
        break;
      case 'return':
        await declineRequest(request._id, 'return');
        break;
      case 'priceChange':
        await declineRequest(request._id, 'priceChange');
        break;
      default:
        break;
    }
    handleRequestClick(requestType);
  };

  const handleRequest = async (request, requestType, action) => {
    setShowNFCPopup(true);
    setActionData({ request, requestType, action });
  };

  const onNFCDetected = async (nfcTag) => {
    const result = await handleNFCApproval(nfcTag);
    if (result) {
      switch (actionData.action) {
        case 'approve':
          await handleApproveRequest(actionData.request, actionData.requestType);
          break;
        case 'decline':
          await handleDeclineRequest(actionData.request, actionData.requestType);
          break;
        default:
          break;
      }
      setSelectedRequest('delete');
      setRequests([]);
      setIsLoading(false);
      setShowNFCPopup(false);
      setActionData({});
      onClose();
    }
  };

  useEffect(() => {
    handleRequestClick('delete');
  }, []);

  return isOpen ? (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {showNFCPopup && <NFCPopup isOpen={showNFCPopup} onClose={() => setShowNFCPopup(false)} onNFCDetected={onNFCDetected} />}
      <div className="relative bg-white rounded-xl p-6 max-w-[95%] h-[95%] w-full mx-4">
        <div className="absolute top-5 right-5 flex justify-center overflow-hidden">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-300 rounded-full hover:bg-gray-200">
            x
          </button>
        </div>
        <div>
          <div className="text-center text-2xl font-bold mb-4 overflow-hidden">الطلبات المعلقة</div>
          <div className="flex overflow-hidden">
            <div className="w-1/5 border">
              <button onClick={() => handleRequestClick('delete')} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 w-full">
                طلبات الحذف
              </button>
              <button onClick={() => handleRequestClick('discount')} className="px-4 py-2 my-2 text-sm font-medium text-gray-700 hover:bg-gray-200 w-full">
                طلبات الخصم
              </button>
              <button onClick={() => handleRequestClick('return')} className="px-4 py-2 my-2 text-sm font-medium text-gray-700 hover:bg-gray-200 w-full">
                طلبات الارجاع
              </button>
              <button onClick={() => handleRequestClick('priceChange')} className="px-4 py-2 my-2 text-sm font-medium text-gray-700 hover:bg-gray-200 w-full">
                طلبات تغير السعر
              </button>
            </div>
            <div className="w-4/5 border p-4 overflow-hidden">
              {isLoading ? (
                <div className="animate-spin h-3 w-3 border-2 border-yellow-500 rounded-full border-t-transparent" />
              ) : (
                <>
                  {selectedRequest && (
                    <div>
                      <p className="text-sm font-bold">{selectedRequestText()}</p>
                    </div>
                  )}
                  <div className="overflow-auto p-4" style={{ maxHeight: '80vh' }}>
                    {selectedRequest === 'delete' && <DeleteRequests requests={requests} handleRequest={handleRequest} />}
                    {selectedRequest === 'discount' && <DiscountRequests requests={requests} handleRequest={handleRequest} />}
                    {selectedRequest === 'return' && <ReturnRequests requests={requests} handleRequest={handleRequest} />}
                    {selectedRequest === 'priceChange' && <PriceChangeRequests requests={requests} handleRequest={handleRequest} />}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;
};

export default RequestsList;
