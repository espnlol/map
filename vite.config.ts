import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleMenuRequest, writeJsonResult } from './api/_menuHandler'

/** Serves the same /api/menu route api/menu.ts serves on Vercel, but for
 * local `npm run dev` / `npm run preview` where there's no Vercel runtime
 * to deploy that serverless function into. Reuses the exact same handler
 * logic (via api/_menuHandler.ts) so local dev and a real deployment
 * behave identically rather than being two implementations that could
 * drift apart. Typed against Vite's own Connect.NextHandleFunction (its
 * dev/preview servers are Connect apps under the hood) rather than a
 * hand-rolled request/response shape, which is both more correct and
 * sidesteps a TS structural-typing false negative on a minimal type. */
function localMenuApiPlugin(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res) => {
    writeJsonResult(res, handleMenuRequest(req.url))
  }
  return {
    name: 'local-menu-api',
    configureServer(server) {
      server.middlewares.use('/api/menu', middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/menu', middleware)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localMenuApiPlugin()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
