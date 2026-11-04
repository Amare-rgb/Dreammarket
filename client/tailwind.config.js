/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        genesis: {
          950: '#20283a',
          900: '#30384f',
          800: '#3c465f',
          700: '#58627a',
          500: '#EB6D3D',
          lime: '#f28a63',
          cream: '#f7f8fa',
          'cream-dark': '#eceef2',
          ink: '#20283a',
          muted: '#667085',
        },
        green: {
          950: '#20283a',
          900: '#30384f',
          800: '#3c465f',
          700: '#58627a',
          600: '#cf5427',
          500: '#EB6D3D',
          400: '#f28a63',
          300: '#f6a487',
          200: '#fac7b5',
          100: '#ffe2d4',
          50: '#fff3ec',
        },
      },
      fontFamily: {
        serif: ['var(--serif)', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['var(--sans)', 'DM Sans', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}