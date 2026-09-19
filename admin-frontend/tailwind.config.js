/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        creator: {
          black: '#0a0a0a',
          ink: '#18181b',
          white: '#ffffff',
          surface: '#f5f5f5',
          border: '#e5e5e5',
          muted: '#737373',
          faint: '#a3a3a3',
        },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};
