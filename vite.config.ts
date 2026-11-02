import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy the public ADS-B APIs through the dev/preview server so the browser
// never has to worry about CORS.
const proxy = {
  '/proxy/adsblol': {
    target: 'https://api.adsb.lol',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/proxy\/adsblol/, ''),
  },
  '/proxy/airplaneslive': {
    target: 'https://api.airplanes.live',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/proxy\/airplaneslive/, ''),
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, proxy },
  preview: { host: true, port: 4173, proxy },
})
