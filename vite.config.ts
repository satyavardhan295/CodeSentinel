import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Where `npm run dev` forwards API calls (the FastAPI backend)
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:8000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separate, long-cached vendor chunks (charts are the bulk of the bundle)
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  // Only the app's own index.html is an entry; never crawl repos the backend clones
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      // The backend clones/extracts scanned code here; changes in it must not
      // reload the browser or clear Vite's cache mid-scan
      ignored: ['**/secdebt-backend/**'],
    },
    proxy: {
      '/api': API_TARGET,
      '/health': API_TARGET,
    },
  },
})
