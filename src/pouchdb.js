import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

// Get the database name from environment variables with a fallback value
const DB_NAME = process.env.REACT_APP_DB_NAME;
const db = new PouchDB(DB_NAME, {
  auto_compaction: false, // Disable auto compaction to improve write performance
  cache: {
    max: 1000, // Increased cache size for better performance
  },
  ajax: {
    timeout: 30000, // Longer timeout for operations
  },
});

// In-memory document cache for frequently accessed items
const documentCache = new Map();
const MAX_CACHE_SIZE = 5000;

// Override get method to use cache
const originalGet = db.get.bind(db);
db.get = async function cachedGet(id, options = {}) {
  // Skip cache for options that would invalidate it or if we're forcing it
  if (options.rev || options.revs || options.revs_info || options.force_fetch) {
    return originalGet(id, options);
  }

  // Try to get from cache first
  if (documentCache.has(id)) {
    return documentCache.get(id);
  }

  // Get from database
  try {
    const doc = await originalGet(id, options);
    
    // Update cache if cache isn't too large
    if (documentCache.size < MAX_CACHE_SIZE) {
      documentCache.set(id, doc);
    } else {
      // Simple LRU implementation - delete 10% of oldest entries
      const entries = Array.from(documentCache.keys());
      const toDelete = Math.floor(entries.length * 0.1);
      for (let i = 0; i < toDelete; i++) {
        documentCache.delete(entries[i]);
      }
      documentCache.set(id, doc);
    }
    
    return doc;
  } catch (err) {
    throw err;
  }
};

// Create indexes for frequently accessed fields
db.createIndex({
  index: {
    fields: ['document_type', 'created_at'],
  },
});

db.createIndex({
  index: {
    fields: ['document_type', 'status'],
  },
});

// Additional indexes for optimized product lookups and barcode scans

db.createIndex({
  index: {
    fields: ['document_type', 'barcode'],
  },
});

db.createIndex({
  index: {
    fields: ['document_type', 'sku_code'],
  },
});

db.createIndex({
  index: {
    fields: ['document_type', 'other_barcodes'],
  },
});

// Variable to track if scanning is active
let isScanningActive = false;

// Function to temporarily pause sync during scanning operations
export function pauseSyncDuringScanning(isPaused) {
  isScanningActive = isPaused;
}

// Get the CouchDB URL from environment variables
const COUCHDB_URL = process.env.REACT_APP_COUCHDB_URL;
const doNotSyncThisIds = [];
// Function to clean up old documents from the local database.
// Note: Before deleting any document, check if it exists on CouchDB; if it doesn't, do not delete it.
// Also, add a "deletedByCleanup" property to documents that will be deleted to prevent them from syncing with CouchDB.
export async function cleanupOldDocs() {
  if (!COUCHDB_URL) {
    console.warn('CouchDB URL not found in environment variables. Running in local mode only.');
    return;
  }
  // Create a CouchDB instance to verify document existence.
  const remoteDB = new PouchDB(COUCHDB_URL);
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    // Get the date part in ISO format (YYYY-MM-DD)
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const result = await db.find({
      selector: {
        document_type: {
          $in: ['log', 'order', 'voucher', 'container', 'invoice', 'offer', 'bulk_deletion_request', 'discount_request', 'deletion_request', 'return_request', 'price_change_request'],
        },
        created_at: {
          $lt: yesterdayStr + 'T23:59:59.999Z',
        },
      },
    });

    const notSyncedIds = [];
    // Attempt to delete old documents from the local database, ensuring they exist on CouchDB.
    for (const doc of result.docs) {
      try {
        // Check if the document exists on CouchDB.
        const docFromCouchDB = await remoteDB.get(doc._id);
        if (!docFromCouchDB) {
          notSyncedIds.push(doc._id);
          continue;
        }
        // Mark the document as deleted by cleanup so that the deletion does not sync with CouchDB.
        doc.deletedByCleanup = true;
        doNotSyncThisIds.push(doc._id);
        await db.remove(doc);
      } catch (error) {
        console.error('Error verifying document on CouchDB:', error);
        // If the error indicates that the document is not found on CouchDB, skip deleting it.
        if (error.status === 404) {
          continue;
        }
      }
    }
  } catch (error) {
    console.error('Error executing document cleanup:', error);
  }
}

// Memory-efficient sync configuration
if (COUCHDB_URL) {
  // Run cleanup periodically
  setInterval(cleanupOldDocs, 24 * 60 * 60 * 1000);

  const syncOptions = {
    live: true,
    retry: true,
    batch_size: 25, // Reduced batch size for less impact on performance
    batches_limit: 1, // Limit concurrent batches to just 1
    back_off_function: (delay) => {
      if (delay === 0) return 1000;
      return Math.min(delay * 1.5, 60000); // Cap at 1 minute
    },
    push: {
      filter: function (doc) {
        // Skip sync completely if scanning is active
        if (isScanningActive) {
          return false;
        }
        
        // If the document is deleted by cleanup, do not push this change to CouchDB.
        if (doc._deleted && doNotSyncThisIds.includes(doc._id)) {
          doNotSyncThisIds.splice(doNotSyncThisIds.indexOf(doc._id), 1);
          return false;
        }
        // List of document types that should not be pushed to CouchDB.
        const restrictedTypes = ['category', 'location', 'user', 'role', 'supplier', 'supplier_category', 'shift', 'pos_settings'];

        // Return false for restricted document types to prevent push
        return !restrictedTypes.includes(doc.document_type);
      },
    },
    pull: {
      filter: function (doc) {
        // Skip sync completely if scanning is active
        if (isScanningActive) {
          return false;
        }
        
        // Only pull today's transactions for specific document types
        if (['container', 'offer', 'bulk_deletion_request', 'discount_request', 'deletion_request', 'return_request', 'price_change_request'].includes(doc.document_type)) {
          const today = new Date().toISOString().split('T')[0];
          const docDate = doc.created_at.split('T')[0];
          return docDate === today;
        }

        if (['order', 'log', 'voucher', 'invoice', 'supplier', 'product_stock', 'supplier_category', 'item_movement_report'].includes(doc.document_type)) {
          return false;
        }

        // Pull all other document types normally
        return true;
      },
    },
  };

  // Set up sync with better error handling and logging
  const sync = db.sync(COUCHDB_URL, syncOptions)
    .on('change', (change) => {
      if (change.direction === 'pull') {
        // Initialize totalDocs if not already set
        if (!window.totalDocsToSync) {
          // Get total document count from CouchDB
          const remoteDB = new PouchDB(COUCHDB_URL);
          remoteDB.info().then(info => {
            window.totalDocsToSync = info.doc_count;
            window.processedDocs = 0;
            window.lastProgress = 0;
          }).catch(err => {
            console.error('Error getting total document count:', err);
            window.totalDocsToSync = 0;
            window.processedDocs = 0;
            window.lastProgress = 0;
          });
        }

        // Update processed docs count
        window.processedDocs = (window.processedDocs || 0) + change.change.docs_read;
        
        // Calculate progress but don't let it reach 100% until sync is complete
        const progress = window.totalDocsToSync > 0 ? 
          Math.min((window.processedDocs / window.totalDocsToSync) * 90, 90) : 0;
        
        // Only update progress if it has increased
        if (progress > window.lastProgress) {
          window.lastProgress = progress;
          console.log('Sync Progress:', {
            docs_read: change.change.docs_read,
            docs_written: change.change.docs_written,
            doc_write_failures: change.change.doc_write_failures,
            docs_total: window.totalDocsToSync,
            processed_total: window.processedDocs,
            progress: progress
          });
          window.dispatchEvent(new CustomEvent('syncProgress', { detail: progress }));
        }
      }
    })
    .on('complete', (info) => {
      // Set progress to 100% only when sync is actually complete
      window.dispatchEvent(new CustomEvent('syncProgress', { detail: 100 }));
      console.log('Sync complete:', info);
    })
    .on('paused', () => {
      window.dispatchEvent(new CustomEvent('syncStatus', { detail: false }));
    })
    .on('active', () => {
      window.dispatchEvent(new CustomEvent('syncStatus', { detail: true }));
    })
    .on('error', (err) => {
      // Silently handle sync errors during scanning operations
      if (!isScanningActive) {
        console.error('Sync error:', err);
      }
    });
} else {
  console.warn('CouchDB URL not found in environment variables. Running in local-only mode.');
}

// Database compaction function to remove old revisions
export function performCompaction() {
  // Fetch essential documents before compaction
  const essentialTypes = ['terminal', 'shift', 'product', 'user'];
  
  Promise.all(essentialTypes.map(type => 
    db.find({
      selector: { document_type: type },
      limit: 1000 // Adjust limit as needed
    })
  ))
  .then(() => {
    // Proceed with compaction after fetching essential documents
    db.compact()
      .then(() => {
        console.log('Database compaction completed successfully.');
        
        // Clear document cache after compaction
        documentCache.clear();
      })
      .catch((err) => {
        console.error('Error during database compaction:', err);
      });
  });
}

// Function to log database info for debugging
export function logDatabaseInfo() {
  return db.info()
    .then(info => {
      console.log('Database Info:', {
        doc_count: info.doc_count,
        update_seq: info.update_seq,
        disk_size: (info.disk_size / (1024 * 1024)).toFixed(2) + ' MB',
        data_size: (info.data_size / (1024 * 1024)).toFixed(2) + ' MB',
        cache_size: documentCache.size + ' docs',
      });
      return info;
    })
    .catch(err => {
      console.error('Error getting database info:', err);
      throw err;
    });
}

// Update database document in cache when changed
db.changes({
  since: 'now',
  live: true,
  include_docs: true,
})
.on('change', change => {
  if (change.deleted) {
    // Remove from cache if deleted
    documentCache.delete(change.id);
  } else {
    // Update cache with new document
    documentCache.set(change.id, change.doc);
  }
});

export default db;
