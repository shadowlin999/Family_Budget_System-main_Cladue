/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        info:    '#0ea5e9',
        success: '#10b981',
        warning: '#f59e0b',
        error:   '#ef4444',
        muted:   '#64748b',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        DEFAULT: '20px',
      },
    },
  },
  plugins: [],
}
