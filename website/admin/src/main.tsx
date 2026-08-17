import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { auth } from './lib/firebase'
import { configureAuthPersistence, getRememberMePreference } from './lib/auth-session'

void configureAuthPersistence(auth, getRememberMePreference()).catch(() => {
  /* persistence applies before next sign-in */
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* install optional */
    })
  })
}
