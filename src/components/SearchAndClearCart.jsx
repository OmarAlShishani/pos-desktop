import { Search, Trash, CreditCard } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import RequestsList from './RequestsList';
const SearchAndClearCart = ({ clearCart, searchQuery, searchProducts, showSearchDropdown, filteredProducts, addProductToCart, onProductSelect, onNFCApproval, setIsManualSearch, cart = [], orderId, orders = [] }) => {
  const [showRequestsList, setShowRequestsList] = useState(false);
  const searchRef = useRef(null);

  // Get the items for the specific order
  const orderItems = orders.find((order) => order.id === orderId)?.items || [];

  // Handle clicks outside the search component
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsManualSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setIsManualSearch]);

  const handleProductSelect = (product) => {
    addProductToCart(product);
    if (product.category_id) {
      onProductSelect(product.category_id);
    }
    searchRef.current.blur();
    setIsManualSearch(false);
  };

  const handleSearchInputFocus = () => {
    setIsManualSearch(true);
  };

  const handleClearCart = () => {
    clearCart(orderId);
  };

  // Filter out scalable items from the search results
  const searchableProducts = filteredProducts.filter((product) => !product.is_scalable_item);

  return (
    <div className="flex justify-between mb-4">
      <div className="flex items-center gap-2">
        <button className={`px-3 py-1 rounded-md flex items-center ${orderItems.length > 0 ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} onClick={handleClearCart} disabled={orderItems.length === 0}>
          <Trash size={16} className="ml-1" />
          إلغاء جميع المواد
        </button>
        <button className="bg-blue-100 text-blue-600 px-3 py-1 rounded-md flex items-center" onClick={() => setShowRequestsList(true)}>
          <CreditCard size={16} />
        </button>
      </div>
      <div className="relative" ref={searchRef}>
        <input type="text" placeholder="بحث عن مادة عبر الرمز، الباركود، أو الاسم" className="pl-10 pr-10 py-2 border rounded-md w-96 text-right" value={searchQuery} onChange={searchProducts} onFocus={handleSearchInputFocus} ref={searchRef} />
        <Search className="absolute left-3 top-2 text-gray-400" size={20} />
        {searchQuery && (
          <button
            onClick={() => {
              searchProducts({ target: { value: '' } });
              setIsManualSearch(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-1 w-6 h-6 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        )}

        {showSearchDropdown && searchQuery && searchableProducts.length > 0 && (
          <ul className="absolute bg-white border rounded-md w-96 mt-1 max-h-96 overflow-y-auto z-50 shadow-lg">
            {searchableProducts.map((product) => (
              <li key={product._id} className="px-4 py-2 cursor-pointer hover:bg-gray-200" onClick={() => handleProductSelect(product)}>
                {product.name_ar || product.name}
                {(product.sku_code || product.barcode) && (
                  <span className="text-gray-500 text-sm block">
                    {product.sku_code && `SKU: ${product.sku_code}`}
                    {product.sku_code && product.barcode && ' | '}
                    {product.barcode && `Barcode: ${product.barcode}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <RequestsList isOpen={showRequestsList} onClose={() => setShowRequestsList(false)} />
    </div>
  );
};

export default SearchAndClearCart;
