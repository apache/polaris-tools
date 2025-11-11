import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_POLARIS_API_URL || 'http://localhost:8181',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          // Only log in development mode
          if (process.env.NODE_ENV === 'development') {
            proxy.on('error', (err) => {
              console.error('Proxy error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req) => {
              const target = process.env.VITE_POLARIS_API_URL || 'http://localhost:8181';
              console.log('📤 Proxying:', req.method, req.url, '→', target + proxyReq.path);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          }
        },
      },
    },
  },
})
