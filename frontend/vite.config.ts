import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'config-js-plugin',
      configureServer(server) {
        server.middlewares.use('/config.js', (_req, res) => {
          res.setHeader('Content-Type', 'application/javascript');
          res.end(`
// Runtime configuration for development
window.__ENV__ = {
  VITE_API_URL: "${process.env.VITE_API_URL || 'http://localhost:3000/api/v1'}",
  VITE_SOCKET_URL: "${process.env.VITE_SOCKET_URL || 'http://localhost:3000'}",
  VITE_SOCKET_FORCE_POLLING: "${process.env.VITE_SOCKET_FORCE_POLLING || 'false'}"
};
          `);
        });
      },
    },
  ],
  base: '/',
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 3000,
    host: true,
    hmr: {
      // Enable better error handling for HMR WebSocket connection  
      overlay: true,
      // In Docker E2E environment, browser accesses app on port 8001
      // so HMR WebSocket must connect to the same port
      clientPort: process.env.VITE_HMR_CLIENT_PORT ? parseInt(process.env.VITE_HMR_CLIENT_PORT) : 3000,
    },
    // Allow external hosts to access the dev server
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'revillard.freeboxos.fr',
      // Allow all hosts (alternative: set to 'all')
    ],
    // Use proxy only for local development when VITE_API_URL is not set
    // Production and containerized environments use VITE_API_URL for direct calls
    proxy: !process.env.VITE_API_URL ? {
      '/api': {
        target: process.env.VITE_BACKEND_TARGET || 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    } : undefined
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
})
