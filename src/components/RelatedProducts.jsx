import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import { Decimal } from 'decimal.js';

const RelatedProducts = ({ relatedProducts, addRelatedProductToCart, cart }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const productsPerPage = 3;

  const totalPages = Math.ceil(relatedProducts.length / productsPerPage);

  const currentProducts = relatedProducts.slice(currentPage * productsPerPage, (currentPage + 1) * productsPerPage);

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((prev) => prev + 1);
      document.getElementById('relatedProducts').scrollTo({
        left: (currentPage + 1) * document.getElementById('relatedProducts').offsetWidth,
        behavior: 'smooth',
      });
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
      document.getElementById('relatedProducts').scrollTo({
        left: (currentPage - 1) * document.getElementById('relatedProducts').offsetWidth,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-[#2B3674] text-xl font-bold">منتجات ذات صلة</h2>
        <div className="flex gap-1">
          <button className={`p-0.5 rounded hover:bg-gray-100 ${currentPage === 0 ? 'text-gray-300' : 'text-gray-600'}`} onClick={prevPage} disabled={currentPage === 0}>
            <ChevronRight size={20} />
          </button>
          <button className={`p-0.5 rounded hover:bg-gray-100 ${currentPage === totalPages - 1 ? 'text-gray-300' : 'text-gray-600'}`} onClick={nextPage} disabled={currentPage === totalPages - 1}>
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      {relatedProducts.length > 0 ? (
        <div id="relatedProducts" className="overflow-hidden">
          <div className="grid grid-cols-3 gap-1 h-full">
            {currentProducts.map((product) => (
              <div
                key={product._id}
                className="bg-white rounded-lg border border-gray-100 shadow-sm text-center cursor-pointer p-1.5
                  hover:shadow-md hover:scale-[1.02] transition-all duration-200 relative overflow-hidden
                  before:absolute before:inset-0 before:bg-gradient-to-b before:from-gray-50/50 before:to-transparent before:opacity-0 
                  hover:before:opacity-100 before:transition-opacity h-16"
                onClick={() => addRelatedProductToCart(product)}
              >
                <div className="font-bold text-[#2B3674] text-xs mb-0.5">
                  {product.name_ar.split(' ').slice(0, 4).join(' ')}
                  {product.name_ar.split(' ').length > 4 ? '...' : ''}
                </div>
                <div className="font-bold text-[#2B3674] text-sm">{new Decimal(product.price).toFixed(4)} د.أ</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded text-center p-2">
          <p className="text-[#4F5E83] text-sm">ستُعرض المنتجات ذات الصلة هنا</p>
        </div>
      )}
    </div>
  );
};

export default RelatedProducts;
