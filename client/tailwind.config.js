/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0B132B', // Fundo principal da aplicação
          850: '#0F1A36', // Painel secundário
          800: '#131F37', // Cartões principais
          750: '#172643', // Hover e sub-elementos
          700: '#1D3054', // Bordas e destaques
          600: '#2A4374', // Linhas e separadores
          border: '#24375A' // Borda padrão sutil
        },
        accent: {
          blue: '#2F8CF0',
          blueHover: '#1B76DC',
          green: '#10B981',
          amber: '#F59E0B',
          red: '#EF4444',
          cyan: '#06B6D4'
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      }
    },
  },
  plugins: [],
}
