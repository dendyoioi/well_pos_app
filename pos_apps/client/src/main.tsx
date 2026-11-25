import './services/apiBase'
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

// Inisialisasi Global 401 Session Lifetime Interceptor (Mencegah layar blank saat token expired 7 hari)
initSessionInterceptor();

// Auto-recovery untuk Vite dynamic import chunk error pasca-deploy baru di Vercel/PWA
window.addEventListener('vite:preloadError', (event) => {
  const RELOAD_KEY = 'wellpos_chunk_reload_at';
  const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
  const now = Date.now();
  if (now - lastReload > 15000) {
    sessionStorage.setItem(RELOAD_KEY, String(now));
    event.preventDefault();
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)

