import { Minus, Plus, X } from 'lucide-react';
import React from 'react';

const CategorySidebar = ({ showCategorySidebar, closeSidebar, selectedCategory, categoryProducts, cart, removeFromCart, addToCart }) => {
  if (!showCategorySidebar) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={closeSidebar}>
      <div className="fixed inset-y-0 right-0 w-1/3 bg-white shadow-lg p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#2B3674]">{selectedCategory?.name}</h2>
          <button onClick={closeSidebar} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {categoryProducts.map((product) => (
            <div key={product._id} className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow border border-gray-100 aspect-square flex flex-col">
              <div className="flex-1 bg-gray-50 rounded-lg mb-3 flex items-center justify-center">
                {product.image ? (
                  <img src={`${process.env.REACT_APP_PUBLIC_IMAGE_URL}/${product.image}`} alt={product.name_ar} className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <svg className="w-16 h-16 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )}
              </div>
              <div className="font-semibold text-sm text-[#2B3674] text-right mb-2 line-clamp-2">{product.name_ar}</div>
              <div className="flex justify-between items-center mt-auto">
                <div className="text-lg text-[#2B3674] font-bold">{product.price}</div>
                {cart.find((item) => item._id === product._id) ? (
                  <div className="flex items-center bg-blue-50 rounded-lg">
                    <button className="p-1 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" onClick={() => removeFromCart(product)}>
                      <Minus size={14} />
                    </button>
                    <span className="px-2 text-blue-600 font-medium">{cart.find((item) => item._id === product._id).quantity}</span>
                    <button className="p-1 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" onClick={() => addToCart(product)}>
                      <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onClick={() => addToCart(product)}>
                    <Plus size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategorySidebar;
