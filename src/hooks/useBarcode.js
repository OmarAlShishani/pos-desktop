import { useState, useRef, useEffect } from 'react';
import BarcodeReader from 'react-barcode-reader';
import db, { pauseSyncDuringScanning } from '../pouchdb';
import itemCartSuccessSound from '../assets/sounds/item-cart-success.mp3';
import { containsArabic, convertArabicNumeralsToEnglish } from '../utils/languageUtils';

// Cache for product lookups
const productCache = new Map();
// Audio instance to reuse
const successAudio = new Audio(itemCartSuccessSound);

export const useBarcode = (onScan, enabled = true, ensureActiveOrder, cart, updateQuantity) => {
  const [showNotFoundPopup, setShowNotFoundPopup] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');
  const [isManualSearch, setIsManualSearch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanningState, setScanningState] = useState('ready'); // 'ready', 'scanning', 'processing'
  const scanQueueRef = useRef([]);
  const processingTimeoutRef = useRef(null);
  const lastScanTimeRef = useRef(Date.now());
  const debounceTimeoutRef = useRef(null);
  const scanningAnimationTimeoutRef = useRef(null);
  const processingQueue = useRef(Promise.resolve()); // Queue for processing promises
  const batchSize = useRef(5); // Process barcodes in batches when scanning is rapid
  const scanActivityTimeoutRef = useRef(null);
  const isScanningActiveRef = useRef(false);

  // Pause sync when starting to scan, resume when done
  const updateScanningState = (isActive) => {
    if (isActive !== isScanningActiveRef.current) {
      isScanningActiveRef.current = isActive;
      pauseSyncDuringScanning(isActive);
      
      // If we're marking scanning as active, set a timeout to automatically
      // mark it inactive after a period of inactivity
      if (isActive) {
        if (scanActivityTimeoutRef.current) {
          clearTimeout(scanActivityTimeoutRef.current);
        }
        scanActivityTimeoutRef.current = setTimeout(() => {
          updateScanningState(false);
        }, 10000); // 10 seconds of inactivity before resuming sync
      }
    }
  };

  // Process the next item in the scan queue
  const processNextScan = () => {
    if (scanQueueRef.current.length > 0 && !isProcessing) {
      // If there are multiple items in the queue, process a batch
      if (scanQueueRef.current.length > 1) {
        const batch = scanQueueRef.current.splice(0, Math.min(batchSize.current, scanQueueRef.current.length));
        processBarcodeDataBatch(batch);
      } else {
        const nextBarcode = scanQueueRef.current.shift();
        processBarcodeData(nextBarcode);
      }
    } else if (scanQueueRef.current.length === 0 && !isProcessing) {
      // If queue is empty and not processing, consider scanning complete after a delay
      setTimeout(() => {
        updateScanningState(false);
      }, 2000); // Delay to ensure we don't flip back and forth
    }
  };

  // Effect to process the queue when it changes or processing state changes
  useEffect(() => {
    if (!isProcessing && scanQueueRef.current.length > 0) {
      processNextScan();
    }

    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (scanningAnimationTimeoutRef.current) {
        clearTimeout(scanningAnimationTimeoutRef.current);
      }
      if (scanActivityTimeoutRef.current) {
        clearTimeout(scanActivityTimeoutRef.current);
      }
      // Ensure sync is resumed when component unmounts
      updateScanningState(false);
    };
  }, [isProcessing]);

  // Process barcode data in a queue to prevent race conditions
  const enqueueBarcodeProcessing = (barcode) => {
    // Chain each processing operation to ensure they complete in order
    processingQueue.current = processingQueue.current
      .then(() => processBarcodeDataInternal(barcode))
      .catch(error => {
        console.error('Error in barcode processing queue:', error);
        return Promise.resolve(); // Continue with next item even if there's an error
      });
  };

  // Process a batch of barcodes for more efficient handling
  const processBarcodeDataBatch = async (barcodes) => {
    try {
      setIsProcessing(true);
      setScanningState('processing');

      for (const barcode of barcodes) {
        enqueueBarcodeProcessing(barcode);
      }
    } catch (error) {
      console.error('Error initiating batch barcode processing:', error);
      setIsProcessing(false);
      setScanningState('ready');
    }
  };

  const findProductByBarcode = async (barcode) => {
    try {
      // Check cache first
      if (productCache.has(barcode)) {
        return productCache.get(barcode);
      }
      
      const product = await db.get(barcode);
      
      // Add to cache (limit cache size to avoid memory issues)
      if (productCache.size > 1000) {
        // Clear the oldest 20% of cache when it gets too large
        const keysToDelete = [...productCache.keys()].slice(0, Math.floor(productCache.size * 0.2));
        keysToDelete.forEach(key => productCache.delete(key));
      }
      productCache.set(barcode, product);
      
      return product;
    } catch (error) {
      setNotFoundBarcode(barcode);
      setShowNotFoundPopup(true);
      return null;
    }
  };

  const processBarcodeData = async (data) => {
    try {
      setIsProcessing(true);
      setScanningState('processing');
      
      // Process via queue
      enqueueBarcodeProcessing(data);
    } catch (error) {
      console.error('Error initiating barcode processing:', error);
      setIsProcessing(false);
      setScanningState('ready');
    }
  };

  const processBarcodeDataInternal = async (data) => {
    try {
      // Check if the barcode contains Arabic characters
      if (containsArabic(data)) {
        // Convert Arabic numerals to English if present
        data = convertArabicNumeralsToEnglish(data);
      }

      // Clean up barcode data - replace Arabic keyboard mappings with correct Latin characters
      let cleanedData = data
        .replace('ٍ×/', 'SOL') // Replace Arabic mapping for SOL
        .replace('}آلإ', 'CNT') // Replace Arabic mapping for CNT
        .replace('×[ٌ', 'OFR') // Replace Arabic mapping for OFR
        .replace(/[^\w\d]/g, ''); // Remove any other non-alphanumeric characters

      // Check for duplicated barcode string
      const halfLength = Math.floor(cleanedData.length / 2);
      const firstHalf = cleanedData.slice(0, halfLength);
      const secondHalf = cleanedData.slice(halfLength);
      const barcodeToUse = firstHalf === secondHalf ? firstHalf : cleanedData;

      // Ensure we have an active order before proceeding
      await ensureActiveOrder();

      const product = await findProductByBarcode(barcodeToUse);
      if (product) {
        // Play success sound when product is found but only if not in a rapid scan sequence
        // to prevent sound pileup
        if (Date.now() - lastScanTimeRef.current > 500) {
          try {
            // Reuse the audio object to avoid creating multiple instances
            successAudio.currentTime = 0;
            successAudio.play().catch(err => {
              // Silence errors about play() interruptions
              if (!err.message.includes('interrupted')) {
                console.error('Error playing success sound:', err);
              }
            });
          } catch (err) {
            console.error('Error playing success sound:', err);
          }
        }

        // Check if product already exists in cart
        const existingItems = cart.filter((item) => item._id === product._id);

        if (existingItems.length > 0) {
          // Product exists, increment quantity
          const nonOfferItem = existingItems.find((item) => !item.is_offer_applied);
          if (nonOfferItem) {
            updateQuantity(product._id, 1);
          } else {
            // If all existing items are offer items, add as new item
            await onScan(product);
          }
        } else {
          // Product doesn't exist, add new item
          await onScan(product);
        }
        
        processingTimeoutRef.current = setTimeout(() => {
          setIsProcessing(false);
          setScanningState('ready');
          processNextScan();
        }, 20); // Slightly longer timeout for more reliable processing
        
        return true;
      }
      
      processingTimeoutRef.current = setTimeout(() => {
        setIsProcessing(false);
        setScanningState('ready');
        processNextScan();
      }, 20);
      
      return false;
    } catch (error) {
      console.error('Error processing barcode:', error);
      
      processingTimeoutRef.current = setTimeout(() => {
        setIsProcessing(false);
        setScanningState('ready');
        processNextScan();
      }, 20);
      
      return false;
    }
  };

  const handleScan = (data) => {
    if (!enabled || !data || showNotFoundPopup || isManualSearch) return;

    // Mark scanning as active to pause sync operations
    updateScanningState(true);

    const currentTime = Date.now();
    const timeSinceLastScan = currentTime - lastScanTimeRef.current;
    lastScanTimeRef.current = currentTime;

    // Show scanning animation
    setScanningState('scanning');

    // Clear any existing animation timeout
    if (scanningAnimationTimeoutRef.current) {
      clearTimeout(scanningAnimationTimeoutRef.current);
    }

    // Clear any existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Add the barcode to the queue
    scanQueueRef.current.push(data);

    // If not currently processing and this is a "fast" scan (less than 400ms since last scan),
    // use a small debounce to group rapid scans
    if (!isProcessing && timeSinceLastScan < 400) {
      debounceTimeoutRef.current = setTimeout(() => {
        processNextScan();
      }, 50); // Increased debounce time for better reliability
    } else if (!isProcessing) {
      // Process immediately for slower scanning
      processNextScan();
    }
    // If already processing, the scan is already in the queue and will be processed later

    // If no more scanning happens within 1000ms, reset to ready state
    scanningAnimationTimeoutRef.current = setTimeout(() => {
      if (!isProcessing && scanQueueRef.current.length === 0) {
        setScanningState('ready');
      }
    }, 1000); // Increased from 800ms to 1000ms
  };

  const handleError = (err) => {
    // console.error('Barcode scanning error:', err);
    setScanningState('ready');
  };

  const closeNotFoundPopup = () => {
    setShowNotFoundPopup(false);
    setNotFoundBarcode('');
    setScanningState('ready');
  };

  return {
    BarcodeReader: enabled ? <BarcodeReader onError={handleError} onScan={handleScan} /> : null,
    showNotFoundPopup,
    notFoundBarcode,
    closeNotFoundPopup,
    setIsManualSearch,
    pendingScans: scanQueueRef.current.length,
    scanningState,
  };
};
