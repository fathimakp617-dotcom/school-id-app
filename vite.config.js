import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (mode === 'android') {
    const apiUrl = env.VITE_API_URL
    let parsed
    try { parsed = new URL(apiUrl) } catch { throw new Error('Android release needs VITE_API_URL in .env.android, e.g. https://your-school-api.example.com') }
    if (parsed.protocol !== 'https:' || /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)) {
      throw new Error('Android release VITE_API_URL must be a public HTTPS address, not a local/private-network address.')
    }
  }
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': 'http://127.0.0.1:3001',
        '/socket.io': { target: 'http://127.0.0.1:3001', ws: true }
      }
    }
  }
})

