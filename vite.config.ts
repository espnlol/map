import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { networkInterfaces } from 'node:os'
import { execSync } from 'node:child_process'

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
const upstream: Record<string, string> = {
  adsblol: 'https://api.adsb.lol',
  airplaneslive: 'https://api.airplanes.live',
  adsblolglobe: 'https://globe.adsb.lol',
  airplanesliveglobe: 'https://globe.airplanes.live',
  planespotters: 'https://api.planespotters.net',
  hexdb: 'https://hexdb.io',
  airportdata: 'https://airport-data.com',
  faa: 'https://nasstatus.faa.gov',
  tfr: 'https://tfr.faa.gov',
}

// Keys end in "/" so "/proxy/adsblol/" doesn't also catch "/proxy/adsblolglobe/".
const proxy = Object.fromEntries(
  Object.entries(upstream).map(([name, target]) => [
    `/proxy/${name}/`,
    {
      target,
      changeOrigin: true,
      headers: { Referer: `${target}/`, 'User-Agent': 'SkyWatch/1.0 (+https://espnlol.github.io/map/)' },
      rewrite: (p: string) => p.slice(`/proxy/${name}`.length),
    },
  ]),
)

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __LAN_ADDRESSES__: JSON.stringify(lanAddresses()),
    __BUILD__: JSON.stringify({ commit: gitCommit(), time: new Date().toISOString() }),
  },
  server: { host: true, port: 5173, proxy },
  preview: { host: true, port: 4173, proxy },
})
