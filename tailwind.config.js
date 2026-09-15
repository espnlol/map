/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        leaf: {
          50: '#f1faf3',
          100: '#dcf2e2',
          200: '#bbe4c8',
          300: '#8ccea6',
          400: '#5bb17f',
          500: '#399462',
          600: '#29774e',
          700: '#225f40',
          800: '#1e4c35',
          900: '#193f2c',
          950: '#0c2318',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
