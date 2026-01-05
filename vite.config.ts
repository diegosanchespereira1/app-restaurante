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
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Split vendor chunks for better caching
          if (id.includes('node_modules')) {
            // React core libraries
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react'
            }
            // Supabase client
            if (id.includes('@supabase')) {
              return 'vendor-supabase'
            }
            // Radix UI components
            if (id.includes('@radix-ui')) {
              return 'vendor-radix'
            }
            // Chart library
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts'
            }
            // Icons
            if (id.includes('lucide-react')) {
              return 'vendor-icons'
            }
            // Framer Motion
            if (id.includes('framer-motion')) {
              return 'vendor-framer'
            }
          }
        }
      }
    }
  }
})
