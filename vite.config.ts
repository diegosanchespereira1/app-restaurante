import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/app-restaurante/',
  server: {
    // Configuração para garantir que o HashRouter funcione corretamente
    // Com HashRouter, o servidor não precisa servir rotas específicas
    // pois todas as rotas são gerenciadas pelo React Router via hash (#)
    fs: {
      strict: false
    }
  },
  preview: {
    // Configuração para o preview
  },
  build: {
    // Garantir que o build funcione corretamente com a base URL
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
