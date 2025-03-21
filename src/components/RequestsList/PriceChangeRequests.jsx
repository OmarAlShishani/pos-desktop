import moment from 'moment';

export default function PriceChangeRequests({ requests, handleRequest }) {
  return (
    <table className="w-full border-collapse bg-white shadow-lg rounded-lg">
      <thead>
        <tr className="bg-blue-100 text-right">
          <th className="px-6 py-3 text-center text-sm font-medium text-[#303573] uppercase">التاريخ والوقت</th>
          <th className="px-6 py-3 text-center text-sm font-medium text-[#303573] uppercase">رقم الطلب</th>
          <th className="px-6 py-3 text-center text-sm font-medium text-[#303573] uppercase">رقم المنتج</th>
          <th className="px-6 py-3 text-center text-sm font-medium text-[#303573] uppercase">مقدم الطلب</th>
          <th className="px-6 py-3 text-center text-sm font-medium text-[#303573] uppercase">السعر القديم</th>
          <th className="px-6 py-3 text-center text-sm font-medium text-[#303573] uppercase">السعر الجديد</th>
          <th className="px-6 py-3 text-center text-sm font-medium text-[#303573] uppercase">الحالة</th>
          <th className="px-6 py-3 text-center text-sm font-medium text-[#303573] uppercase">الإجراءات</th>
        </tr>
      </thead>
      <tbody>
        {requests.map((request, index) => (
          <tr key={index} className="border-b text-right">
            <td className="p-3">{moment(request.timestamp).format('MMM DD, YYYY hh:mm A')}</td>
            <td className="p-3">{request.orderId ? request.orderId.slice(-6) : 'N/A'}</td>
            <td className="p-3">{request.product_id}</td>
            <td className="p-3">{request.requestedBy}</td>
            <td className="p-3">{request.oldPrice}</td>
            <td className="p-3">{request.newPrice}</td>
            <td className="p-3">
              <span
                className={`px-2 py-1 text-xs rounded-full
                  ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : request.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
              >
                {request.status === 'pending' ? 'قيد الانتظار' : request.status === 'approved' ? 'تمت الموافقة' : 'مرفوض'}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
              <button onClick={() => handleRequest(request, 'priceChange', 'approve')} className="text-green-600 hover:text-green-900 font-medium ml-4">
                موافقة
              </button>
              <button onClick={() => handleRequest(request, 'priceChange', 'decline')} className="text-red-600 hover:text-red-900 font-medium mr-4">
                رفض
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
