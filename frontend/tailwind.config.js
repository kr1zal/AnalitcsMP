/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'wb-purple': '#8B3FFD',
        'ozon-blue': '#005BFF',
      },
    },
  },
  plugins: [],
}
