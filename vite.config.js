import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,

    // Allow all hosts — required for ngrok tunnels
    // Must be boolean `true` in Vite 5 (string 'all' was removed)
    allowedHosts: true,

    // Required for ngrok: forward the Host header so the backend
    // doesn't reject requests coming through the tunnel
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },

    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // Pass ngrok bypass header to the backend as well
        headers: { 'ngrok-skip-browser-warning': 'true' },
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
