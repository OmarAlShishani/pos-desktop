import React, { useEffect, useRef } from 'react';

const NFCPopup = ({ isOpen, onClose, onNFCDetected }) => {
  const inputRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle clicks outside the popup
  const handleOutsideClick = (e) => {
    if (popupRef.current && !popupRef.current.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      // Refocus the input instead of closing
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleInput = async (e) => {
    const nfcTag = e.target.value;
    if (nfcTag.length >= 10) {
      e.target.value = '';
      onNFCDetected(nfcTag);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleOutsideClick}>
      <div ref={popupRef} className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
        <div className="flex justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-20 h-20 text-gray-600">
            <path d="M4 4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V6C22 4.89543 21.1046 4 20 4H4ZM4 6H20V18H4V6ZM7.5 9C7.22386 9 7 9.22386 7 9.5V14.5C7 14.7761 7.22386 15 7.5 15C7.77614 15 8 14.7761 8 14.5V9.5C8 9.22386 7.77614 9 7.5 9ZM10.5 9C10.2239 9 10 9.22386 10 9.5V14.5C10 14.7761 10.2239 15 10.5 15C10.7761 15 11 14.7761 11 14.5V9.5C11 9.22386 10.7761 9 10.5 9ZM13.5 9C13.2239 9 13 9.22386 13 9.5V14.5C13 14.7761 13.2239 15 13.5 15C13.7761 15 14 14.7761 14 14.5V9.5C14 9.22386 13.7761 9 13.5 9ZM16.5 9C16.2239 9 16 9.22386 16 9.5V14.5C16 14.7761 16.2239 15 16.5 15C16.7761 15 17 14.7761 17 14.5V9.5C17 9.22386 16.7761 9 16.5 9Z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">مرر بطاقة NFC للتفويض</h3>
        <input ref={inputRef} type="password" className="opacity-0 absolute" onChange={handleInput} autoFocus />
        <div className="flex justify-center">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default NFCPopup;
