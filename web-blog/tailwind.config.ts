import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f2f3ff',
          100: '#e5e7ff',
          200: '#c7caff',
          300: '#a5a9ff',
          400: '#7c80f5',
          500: '#5c63f2',
          600: '#4a4fd8',
          700: '#3d40b5',
          800: '#333691',
          900: '#2c2e75',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
export default config
