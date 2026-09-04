import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import * as serviceWorker from './serviceWorker'

Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    enabled: import.meta.env.MODE !== 'development' ? true : false,
})

// Stale-deploy recovery: when a tab loaded before a deploy lazy-imports a chunk
// (e.g. the board chunk + its CSS), the old fingerprinted asset 404s and Vite
// fires `vite:preloadError`. Reload once to fetch the fresh index.html + current
// asset hashes. The sessionStorage flag prevents an infinite reload loop if the
// asset is genuinely missing rather than just stale; it's cleared on a clean
// load below so future stale deploys can recover again.
const PRELOAD_RELOAD_KEY = 'vite-preload-reloaded'

window.addEventListener('vite:preloadError', (event) => {
    if (sessionStorage.getItem(PRELOAD_RELOAD_KEY)) return
    // Suppress the throw so it doesn't surface to the ErrorBoundary/Sentry —
    // we're recovering by reloading.
    event.preventDefault()
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, '1')
    window.location.reload()
})

window.addEventListener('load', () => {
    sessionStorage.removeItem(PRELOAD_RELOAD_KEY)
})

const rootEl = document.getElementById('root')
if (rootEl) {
    ReactDOM.createRoot(rootEl).render(<App />)
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()
