function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

export default debounce;

// Usage example:
// const debounce = require('./utils/debounce');
// const debouncedFunction = debounce(yourFunction, 300);
// element.addEventListener('input', e => debouncedFunction(e)); 