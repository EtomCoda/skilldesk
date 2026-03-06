/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          light: 'rgb(37, 99, 235)',
          dark: 'rgb(17, 24, 39)',
        },
      },
    },
  },
  plugins: [],
};
