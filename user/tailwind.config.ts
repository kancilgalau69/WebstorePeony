import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f3f0ff',
          100: '#e9e4ff',
          200: '#d4ccff',
          300: '#b3a4ff',
          400: '#a29bfe',
          500: '#6c5ce7',
          600: '#5a4bd1',
          700: '#4c3fb3',
          800: '#3d3291',
          900: '#2d2566',
        },
        accent: {
          50: '#e6fffe',
          100: '#b3fff9',
          200: '#80fff4',
          300: '#4dfff0',
          400: '#00cec9',
          500: '#00b894',
          600: '#009e7f',
          700: '#007f66',
          800: '#00604d',
          900: '#004033',
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', maxHeight: '0' },
          '100%': { opacity: '1', maxHeight: '500px' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out',
        fadeInUp: 'fadeInUp 0.5s ease-out',
        slideDown: 'slideDown 0.3s ease-out',
      },
      boxShadow: {
        'card': '0 2px 16px -4px rgba(0,0,0,0.08)',
        'card-hover': '0 12px 40px -12px rgba(108,92,231,0.25)',
        'product': '0 4px 20px -4px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};
export default config;
