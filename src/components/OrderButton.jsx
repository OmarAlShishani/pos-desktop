import React from 'react';

export const OrderButton = ({ order, isSelected, onSelect }) => {
  return (
    <button onClick={onSelect} className={`px-4 py-2 rounded-lg text-xs ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
      {order.displayText}
    </button>
  );
};
