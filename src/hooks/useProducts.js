import { useState, useEffect } from 'react';
import db from '../pouchdb';

const fetchRelatedProducts = async (productId) => {
  try {
    const product = await db.get(productId);

    if (!product.similar_products || product.similar_products.length === 0) {
      return [];
    }

    const similarProducts = await Promise.all(
      product.similar_products.map(async (similarProductId) => {
        try {
          return await db.get(similarProductId);
        } catch (error) {
          console.error(`Error fetching similar product ${similarProductId}:`, error);
          return null;
        }
      }),
    );

    return similarProducts.filter((product) => product !== null);
  } catch (error) {
    console.error('Error fetching similar products:', error);
    return [];
  }
};

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const fetchProducts = async () => {
    try {
      const result = await db.query('pos_index/products_by_all', {
        include_docs: true,
        reduce: false,
      });
      const products = result.rows.map((row) => row.doc);
      setProducts(products);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const searchProducts = async (searchTerm) => {
    if (!searchTerm) return [];

    const searchTermLower = searchTerm.toLowerCase();

    try {
      // First, try exact barcode match
      const barcodeResult = await db.find({
        selector: {
          document_type: 'product',
          $or: [{ barcode: searchTerm }, { sku_code: searchTerm }, { other_barcodes: { $elemMatch: { $eq: searchTerm } } }],
        },
      });

      if (barcodeResult.docs.length > 0) {
        return barcodeResult.docs;
      }

      // If no barcode match, search by name (both Arabic and English)
      const result = await db.find({
        selector: {
          document_type: 'product',
          $or: [{ name_ar: { $regex: RegExp(searchTerm, 'i') } }, { name: { $regex: RegExp(searchTermLower, 'i') } }, { barcode: { $regex: RegExp(searchTermLower, 'i') } }, { sku_code: { $regex: RegExp(searchTermLower, 'i') } }],
        },
        limit: 10,
      });

      return result.docs;
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  };

  const fetchCategories = async () => {
    try {
      const result = await db.query('pos_index/categories_by_all', {
        include_docs: true,
        reduce: false,
      });
      const categories = result.rows.map((row) => row.doc).filter((doc) => doc.parent_category === null);
      setCategories(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();

    const setupChangeListeners = () => {
      const categoryChanges = db
        .changes({
          since: 'now',
          live: true,
          include_docs: true,
        })
        .on('change', (change) => {
          if (change.doc.document_type === 'category' && change.doc.parent_category === null) {
            fetchCategories();
          }
        });

      const productChanges = db
        .changes({
          since: 'now',
          live: true,
          include_docs: true,
        })
        .on('change', (change) => {
          if (change.doc.document_type === 'product') {
            fetchProducts();
          }
        });

      return () => {
        categoryChanges.cancel();
        productChanges.cancel();
      };
    };

    const cleanup = setupChangeListeners();
    return cleanup;
  }, []);

  return {
    products,
    categories,
    fetchRelatedProducts,
    searchProducts,
  };
};
