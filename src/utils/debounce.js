function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// Usage example:
// import debounce from './debounce';
// const debouncedFunction = debounce(yourFunction, 300);
// element.addEventListener('input', e => debouncedFunction(e));

export default debounce;
