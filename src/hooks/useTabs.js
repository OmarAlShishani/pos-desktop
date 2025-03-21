import { useState, useEffect } from 'react';
import db from '../pouchdb';

export const useTabs = () => {
  const [tabs, setTabs] = useState([]);
  const [scaledItems, setScaledItems] = useState([]);
  const [selectedTab, setSelectedTab] = useState('supermarket');

  const fetchTabs = async () => {
    try {
      const result = await db.query('pos_index/tabs_by_all', {
        include_docs: true,
        reduce: false,
      });
      setTabs(result.rows.map((row) => row.doc));
    } catch (error) {
      console.error('Error fetching tabs:', error);
    }
  };

  const fetchScaledItems = async (tabId) => {
    try {
      const result = await db.query('pos_index/products_by_all', {
        include_docs: true,
        reduce: false,
      });
      const filteredItems = result.rows.map((row) => row.doc).filter((doc) => doc.is_scalable_item === true && doc.tab_id === tabId);
      setScaledItems(filteredItems);
      // console.log("Scaled items fetched:", filteredItems);
    } catch (error) {
      console.error('Error fetching scaled items:', error);
    }
  };

  useEffect(() => {
    fetchTabs();

    const changes = db
      .changes({
        since: 'now',
        live: true,
        include_docs: true,
      })
      .on('change', (change) => {
        if (change.doc.document_type === 'tab') {
          fetchTabs();
        } else if (change.doc.document_type === 'product' && change.doc.is_scalable_item === true) {
          fetchScaledItems(selectedTab);
        }
      });

    return () => changes.cancel();
  }, []);

  return { tabs, scaledItems, selectedTab, setSelectedTab, fetchScaledItems };
};
