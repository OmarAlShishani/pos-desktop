import React, { useState, useRef, useEffect } from 'react';
import BarcodeReader from 'react-barcode-reader';
import { containsArabic, convertArabicNumeralsToEnglish } from '../utils/languageUtils';
import db, { pauseSyncDuringScanning } from '../pouchdb';

/**
 * Standalone barcode scanner component that doesn't depend on useBarcode hook
 * Optimized for fast barcode reading with minimal debounce and efficient queue processing
 * @param {Object} props Component props
 * @param {Function} props.onScan Callback function when barcode is successfully scanned and processed
 * @param {boolean} props.enabled Whether the scanner is enabled
 * @param {Function} props.onProcessingStart Optional callback when processing starts
 * @param {Function} props.onProcessingEnd Optional callback when processing ends
 * @param {Function} props.onNotFound Optional callback when product is not found
 * @returns {JSX.Element} BarcodeReader component
 */
const BarcodeScannerComponent = ({ onScan, enabled = true, onProcessingStart, onProcessingEnd, onNotFound }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const scanQueueRef = useRef([]);
  const lastScanTimeRef = useRef(Date.now());
  const debounceTimeoutRef = useRef(null);
  const processingTimeoutRef = useRef(null);
  const processingQueue = useRef(Promise.resolve()); // Queue for processing promises
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
      const nextBarcode = scanQueueRef.current.shift();
      processBarcodeData(nextBarcode);
    } else if (scanQueueRef.current.length === 0 && !isProcessing) {
      // If queue is empty and not processing, consider scanning complete
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
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
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

  const processBarcodeData = async (data) => {
    try {
      setIsProcessing(true);
      if (onProcessingStart) onProcessingStart();
      
      // Add to processing queue rather than executing directly
      enqueueBarcodeProcessing(data);
    } catch (error) {
      console.error('Error initiating barcode processing:', error);
      setIsProcessing(false);
      if (onProcessingEnd) onProcessingEnd();
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

      // Pass the processed barcode to the onScan callback
      await onScan(barcodeToUse);
      return true;
    } catch (error) {
      console.error('Error processing barcode:', error);
      if (onNotFound) onNotFound(data);
      return false;
    } finally {
      setIsProcessing(false);
      if (onProcessingEnd) onProcessingEnd();

      // Use a slightly longer timeout for more reliable processing of the next scan
      processingTimeoutRef.current = setTimeout(() => {
        processNextScan();
      }, 20); // Increased from 5ms to 20ms for more reliable processing
    }
  };

  const handleScan = (data) => {
    if (!enabled || !data) return;

    // Mark scanning as active to pause sync operations
    updateScanningState(true);

    const currentTime = Date.now();
    const timeSinceLastScan = currentTime - lastScanTimeRef.current;
    lastScanTimeRef.current = currentTime;

    // Add the barcode to the queue
    scanQueueRef.current.push(data);

    // If not currently processing and this is a "fast" scan (less than 300ms since last scan),
    // use a small debounce to group rapid scans
    if (!isProcessing && timeSinceLastScan < 300) {
      // Increased from 200ms to 300ms for better grouping of rapid scans
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        processNextScan();
      }, 50); // Increased from 15ms to 50ms for better reliability
    } else if (!isProcessing) {
      // Process immediately for slower scanning
      processNextScan();
    }
    // If already processing, the scan is already in the queue and will be processed later
  };

  const handleError = (err) => {
    console.error('Barcode scanning error:', err);
  };

  // Only render the BarcodeReader if enabled is true
  if (!enabled) return null;

  return <BarcodeReader onError={handleError} onScan={handleScan} />;
};

export default BarcodeScannerComponent;
