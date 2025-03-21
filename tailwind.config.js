module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
      },
      animation: {
        'marquee': 'marquee 5s linear infinite',
      },
      keyframes: {
        marquee: {
          // '0%': { transform: 'translateX(0%)' },
          // '50%': { transform: 'translateX(0%)' },
          // '100%': { transform: 'translateX(150%)' },
        },
      },
    },
  },
  plugins: [],
};
