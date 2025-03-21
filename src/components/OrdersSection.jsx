import { Plus, X } from 'lucide-react';
import React from 'react';
import { OrderButton } from './OrderButton';
import Decimal from 'decimal.js';

const OrdersSection = ({ orders, currentOrderId, selectOrder, addNewOrder, clearRelatedProducts, setOrders }) => {
  // Helper function to calculate order total
  const calculateOrderTotal = (items = []) => {
    return items.reduce((total, item) => {
      const itemPrice = new Decimal(item?.is_scalable_item ? item.kilo_price || item.original_price || 0 : item.price || 0);
      const quantity = new Decimal(item.quantity || 0);
      return total.plus(itemPrice.times(quantity));
    }, new Decimal(0));
  };

  const handleDeleteOrder = (orderId) => {
    // Find the order to check if it has items
    const order = orders.find((o) => o.id === orderId);
    if (!order || (order.items && order.items.length > 0)) {
      return; // Don't delete orders with items
    }

    // If this is the current order, clear it first
    if (currentOrderId === orderId) {
      selectOrder(null);
    }

    // Remove the order from the orders array
    const updatedOrders = orders.filter((o) => o.id !== orderId);
    setOrders(updatedOrders);
  };

  return (
    <div className="mb-4 bg-white pt-2 pr-4 pb-2 rounded">
      <div className="flex gap-2 mb-2">
        <h3 className="text-[#2B3674] text-xl mb-1">الطلبات</h3>
        <button
          className="border border-blue-500 text-blue-500 px-2 py-1 rounded"
          onClick={() => {
            addNewOrder();
            clearRelatedProducts();
          }}
        >
          <Plus size={16} className="inline" /> إضافة طلب
        </button>
      </div>
      <div className="overflow-x-auto pt-2">
        <div className="inline-flex flex-nowrap gap-2 pb-2">
          {orders.map((order, index) => {
            const orderTotal = calculateOrderTotal(order.items);
            const displayText = `#${index + 1} (${orderTotal.toFixed(2)}د)`;

            return (
              <div key={order.id} className="relative">
                <OrderButton order={{ ...order, displayText }} isSelected={currentOrderId === order.id} onSelect={() => selectOrder(order.id)} />
                {(!order.items || order.items.length === 0) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteOrder(order.id);
                    }}
                    className="absolute -top-1 -left-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrdersSection;
