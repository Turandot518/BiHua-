/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dunhuang: {
          text: '#e0d8cf',
          fresco: '#1a1815',
          gold: '#c5a059',
          sand: '#b5a796',
          stone: '#8b7e6a',
          silk: '#f5f2ed',
          paper: '#e0d8cf'
        }
      },
      fontFamily: {
        serif: ["Noto Serif SC", "Cinzel", "Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      }
    },
  },
  plugins: [],
}
