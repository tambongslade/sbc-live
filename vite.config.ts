import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Self-signed HTTPS: required so phones/laptops on the LAN get a secure
  // context (getUserMedia — camera & mic — is blocked on plain http except localhost).
  plugins: [react(), basicSsl()],
  server: {
    host: true, // listen on all interfaces → reachable from the whole network
    // Same-origin proxy to the SBC API: LAN-IP origins aren't in the backend's
    // CORS allowlist (only localhost/127.0.0.1), so the browser talks to /api
    // and Vite forwards server-side.
    proxy: {
      '/api': {
        target: 'https://api.live.sbcprecom.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
