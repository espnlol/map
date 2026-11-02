import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { networkInterfaces } from 'node:os'

// This computer's Wi-Fi/Ethernet addresses, so the app can show a QR code
// that opens it on a phone on the same network. Home-network ranges first.
function lanAddresses(): string[] {
  const out: string[] = []
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (/vEthernet|WSL|VirtualBox|VMware|Docker|Loopback|Tailscale|ZeroTier/i.test(name)) continue
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address)
    }
  }
  const rank = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3)
  return out.sort((a, b) => rank(a) - rank(b))
}

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
  define: { __LAN_ADDRESSES__: JSON.stringify(lanAddresses()) },
  server: { host: true, port: 5173, proxy },
  preview: { host: true, port: 4173, proxy },
})
