/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 6px 24px rgba(16, 24, 40, 0.06)',
        soft: '0 1px 2px rgba(16, 24, 40, 0.06)',
      },
      colors: {
        // Pastel palette
        base: '#0B1220',
        peach: { 50: '#FFF4ED', 100: '#FFE6D6', 200: '#FFD2B8' },
        mint:  { 50: '#EFFFF4', 100: '#D6FFE6', 200: '#B8FFD2' },
        sky:   { 50: '#F1F7FF', 100: '#E2EFFF', 200: '#CFE4FF' },
        sand:  { 50: '#FAFAF7', 100: '#F3F4F1', 200: '#E9EBE6' },
        lilac: { 50: '#F8F6FF', 100: '#EEE9FF', 200: '#E1D8FF' },
      },
      backgroundImage: {
        'header-gradient':
          'radial-gradient(120% 120% at 10% -10%, #CFE4FF 0%, transparent 60%), radial-gradient(120% 120% at 100% 0%, #FFE6D6 0%, transparent 55%)',
      },
    },
  },
  plugins: [],
};
