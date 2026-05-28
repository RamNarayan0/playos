/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // enable class-based dark mode
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(210, 80%, 55%)',
        secondary: 'hsl(340, 70%, 55%)',
        accent: 'hsl(45, 90%, 55%)',
        background: {
          DEFAULT: 'hsl(210, 20%, 95%)',
          dark: 'hsl(210, 20%, 12%)',
        },
        surface: {
          DEFAULT: 'hsla(0, 0%, 100%, 0.8)',
          dark: 'hsla(0, 0%, 10%, 0.8)',
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.12)',
          dark: 'rgba(0,0,0,0.24)',
        },
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
