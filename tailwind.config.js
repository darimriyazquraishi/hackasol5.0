/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lumi: {
          taupe: '#987654',
          taupeDark: '#765B43',
          concrete: '#9C9C9C',
          black: '#080808',
          offwhite: '#F5F4F1',
          mutedwhite: '#D5D2CC',
          charcoal: '#191919',
          border: '#303030'
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}
