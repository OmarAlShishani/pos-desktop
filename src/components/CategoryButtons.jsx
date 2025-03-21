import React, { useState, useEffect } from 'react';
import db from '../pouchdb';

const CategoryButtons = ({ handleCategoryClick }) => {
  const [specialCategories, setSpecialCategories] = useState([]);

  useEffect(() => {
    const fetchSpecialCategories = async () => {
      try {
        const result = await db.query('pos_index/special_categories_by_all', {
          include_docs: true,
          reduce: false,
        });
        setSpecialCategories(result.rows.map((row) => row.doc));
      } catch (error) {
        console.error('Error fetching special categories:', error);
      }
    };

    fetchSpecialCategories();

    const changes = db
      .changes({
        since: 'now',
        live: true,
        include_docs: true,
      })
      .on('change', (change) => {
        if (change.doc.document_type === 'special_category') {
          fetchSpecialCategories();
        }
      });

    return () => changes.cancel();
  }, []);

  return (
    <div className="flex overflow-x-auto bg-white rounded-lg shadow-md p-2 h-16">
      <div className="flex gap-2 min-w-max h-full">
        {specialCategories.map((category) => (
          <button
            key={category._id}
            className="flex items-center justify-center px-3 py-2 rounded-lg
              min-w-[120px] h-full
              bg-gradient-to-r from-blue-50 to-blue-100
              hover:from-blue-600 hover:to-blue-700
              text-blue-700 hover:text-white
              transition-all duration-200 
              shadow-sm hover:shadow-md
              border border-blue-200 hover:border-blue-600
              font-medium text-xs
              active:scale-95 active:shadow-inner
              whitespace-nowrap overflow-hidden text-ellipsis"
            onClick={() => handleCategoryClick(category)}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryButtons;
