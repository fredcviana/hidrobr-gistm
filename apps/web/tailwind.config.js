/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta HIDROBR
        brand: {
          50:  '#EDF8F8',
          100: '#D6F0F0',
          200: '#9FD8D8',
          300: '#3AACAE',
          400: '#0A9396',
          500: '#007B7E',
          600: '#005F73',
          700: '#005069',
          800: '#003D4F',
          900: '#002B3D',
        },
        accent: {
          400: '#4DD99E',
          500: '#2DC98C',
          600: '#1DAD78',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}
