import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initTheme } from './design/theme'

initTheme()

// Identify the launched checkout in the startup log so a running instance
// can never be confused with a sibling checkout of the same product.
console.info(`Laura's UI — workspace ${__BUILD_WORKSPACE__} @ ${__BUILD_COMMIT__}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
