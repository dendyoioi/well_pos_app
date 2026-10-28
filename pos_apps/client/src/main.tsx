import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { pwaService } from './services/pwa.service'
import { initGlobalErrorMonitor } from './services/errorMonitor'
import { AppErrorBoundary } from './components/ui/AppErrorBoundary'
import { initSessionInterceptor } from './services/sessionInterceptor'

// Inisialisasi Error Monitoring & Crash Reporter (P0-1)
initGlobalErrorMonitor();

// Registrasi Service Worker PWA (Offline shell caching & install)
pwaService.registerServiceWorker();

// Prefiks global /api bila VITE_API_URL diatur di environment cloud (Vercel)
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
if (apiBase) {
  const originalFetch = window.fetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api')) {
      input = `${apiBase}${input}`;
    }
    return originalFetch(input, init);
  };
}

// Inisialisasi Global 401 Session Lifetime Interceptor (Mencegah layar blank saat token expired 7 hari)
initSessionInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)

