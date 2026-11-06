import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import App from './App'
import './styles/index.css'

// iOS can leave the page scrolled after the keyboard closes; snap it back.
document.addEventListener('focusout', () => setTimeout(() => window.scrollTo(0, 0), 50))
window.visualViewport?.addEventListener('resize', () => {
  if (!document.activeElement || document.activeElement === document.body) window.scrollTo(0, 0)
})

// From the Home Screen, some iOS versions report a window shorter than the
// screen, leaving a strip at the bottom. Use the real screen size instead.
function fitStandalone() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  // iPhone only: an iPad app can share the screen, so its window really is smaller
  if (!standalone || !/iPhone/.test(navigator.userAgent)) return
  const landscape = window.matchMedia('(orientation: landscape)').matches
  const screenH = landscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height)
  const h = Math.max(window.innerHeight, screenH)
  document.documentElement.style.setProperty('--app-h', `${h}px`)
}
fitStandalone()
window.addEventListener('resize', fitStandalone)
window.addEventListener('orientationchange', () => setTimeout(fitStandalone, 300))

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
