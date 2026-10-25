/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#276221',
          dark: '#1a4016',
          light: '#2f7227',
        },
        gold: '#f5c542',
      },
      boxShadow: {
        'glow-yellow': '0 0 12px 3px rgba(245,197,66,0.7)',
        'glow-white':  '0 0 10px 2px rgba(255,255,255,0.5)',
      },
    },
  },
  plugins: [],
};
