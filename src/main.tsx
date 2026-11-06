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

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
