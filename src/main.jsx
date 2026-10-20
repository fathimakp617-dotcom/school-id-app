import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { Capacitor } from '@capacitor/core'
import { API_URL } from './data/apiConfig'
import { getAuthToken } from './data/authStore'
import './index.css'

const originalFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const requestUrl = new URL(typeof input === 'string' ? input : input.url, window.location.href)
  const apiOrigin = new URL(API_URL || window.location.origin).origin
  if (requestUrl.origin !== apiOrigin || !getAuthToken()) return originalFetch(input, init)
  const headers = new Headers(init.headers || (typeof input === 'string' ? undefined : input.headers))
  headers.set('Authorization', `Bearer ${getAuthToken()}`)
  return originalFetch(input, { ...init, headers })
}

if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

