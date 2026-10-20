import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the browser talks to Vite (port 5173) and Vite forwards /api to Express.
// To the browser everything is ONE origin, so no CORS is needed anywhere.
// Do not set changeOrigin: the server's origin check compares Origin with the Host header.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
});
