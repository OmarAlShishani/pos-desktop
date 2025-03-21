/**
 * Utility functions for language detection and conversion
 */

/**
 * Checks if a string contains Arabic characters
 * @param {string} text - The text to check
 * @returns {boolean} - True if the text contains Arabic characters
 */
export const containsArabic = (text) => {
  if (!text) return false;

  // Arabic Unicode range (basic Arabic letters)
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(text);
};

/**
 * Converts Arabic numerals to English numerals
 * @param {string} text - The text containing Arabic numerals
 * @returns {string} - Text with Arabic numerals converted to English
 */
export const convertArabicNumeralsToEnglish = (text) => {
  if (!text) return text;

  // Arabic numerals to English numerals mapping
  const arabicNumeralsMap = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  };

  // Replace all Arabic numerals with English equivalents
  return text.replace(/[٠-٩]/g, (match) => arabicNumeralsMap[match]);
};
