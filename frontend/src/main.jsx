import React from 'react'
import { createRoot } from 'react-dom/client'
import './design-system.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)

// PWA: регистрация service worker для офлайн-оболочки киоска
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
