import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api and /uploads are proxied to the Node backend on :4000,
// so the browser only ever talks to the Vite origin (no CORS headaches).
// api.js still respects VITE_API_URL if you prefer to hit the backend directly.
export default defineConfig({
  plugins: [react()],
  base: '/trooper/',
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
