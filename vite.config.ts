import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
        // 🚨 EXTENDED TIMEOUTS: Prevents proxy drops on long-running repository scanning tasks
        timeout: 60000, 
        proxyTimeout: 60000,
        /**
         * Intercepts proxy network layer lifecycle pipeline events.
         * Attaches fallback listeners to prevent Node socket abrupt drops (ECONNRESET).
         */
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.warn('[Vite Proxy Exception Interceptor]:', err.message);
          });
        }
      }
    }
  },
})