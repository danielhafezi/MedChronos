import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Clinical color palette
        medical: {
          primary: '#0B3954',      // Medical blue
          'primary-light': '#1E5F7A',
          'primary-dark': '#083040',
          success: '#5CB85C',      // Soft green
          'success-light': '#8BC34A',
          'success-dark': '#4A9B4A',
          warning: '#F0AD4E',      // Amber
          'warning-light': '#FFD54F',
          'warning-dark': '#E65100',
          danger: '#D9534F',       // Clinical red
          'danger-light': '#FF6B6B',
          'danger-dark': '#C62828',
          // Neutral grays with better contrast
          neutral: {
            50: '#FAFAFA',
            100: '#F5F5F5',
            200: '#EEEEEE',
            300: '#E0E0E0',
            400: '#BDBDBD',
            500: '#9E9E9E',
            600: '#757575',
            700: '#616161',
            800: '#424242',
            900: '#212121',
          }
        }
      }
    },
  },
  plugins: [],
}
export default config
