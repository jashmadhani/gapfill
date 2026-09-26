import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API = process.env.VITE_API_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // maplibre-gl v6 loads its own web worker from dist/; pre-bundling breaks that path.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/ws': { target: API.replace(/^http/, 'ws'), ws: true },
    },
  },
})
