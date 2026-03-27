import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://192.168.1.2:8002',
      '/ws':  { target: 'ws://192.168.1.2:8002', ws: true },
    },
  },
})