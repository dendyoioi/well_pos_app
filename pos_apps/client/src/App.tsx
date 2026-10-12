import React, { useState, useEffect, Suspense, lazy } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { api, authStorage } from './services/api';
import type { User } from './types/auth';
import { DialogProvider } from './context/DialogContext';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { PullToRefresh } from './components/PullToRefresh';
import { AppErrorBoundary } from './components/ui/AppErrorBoundary';

// Code-splitting P1-1: Halaman publik, superadmin, dan QR menu dimuat secara dinamis saat rute diakses
const SuperadminDashboardPage = lazy(() =>
  import('./pages/SuperadminDashboardPage').then((m) => ({ default: m.SuperadminDashboardPage }))
);
const SaasLandingPage = lazy(() =>
  import('./pages/SaasLandingPage').then((m) => ({ default: m.SaasLandingPage }))
);
const CustomerQrMenuView = lazy(() =>
  import('./pages/CustomerQrMenuView').then((m) => ({ default: m.CustomerQrMenuView }))
);
const MaintenancePage = lazy(() =>
  import('./pages/MaintenancePage').then((m) => ({ default: m.MaintenancePage }))
);

const ViewLoadingFallback = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-bold text-blue-950 font-sans">Memuat halaman...</span>
    </div>
  </div>
);



// Path URL rahasia khusus akses portal Superadmin Platform (Mencegah brute force / scan bot)
export const SUPERADMIN_SECRET_HASH = '#hq-gate-99';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // View routing: 'landing' | 'pos-login' | 'superadmin' | 'menu'
  const [menuParams, setMenuParams] = useState<{ outletId: string; table: string }>(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#menu')) {
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) {
        const p = new URLSearchParams(hash.slice(qIdx));
        return { outletId: p.get('outletId') || '', table: p.get('table') || '01' };
      }
    }
    return { outletId: '', table: '01' };
  });

  const [viewMode, setViewMode] = useState<'landing' | 'pos-login' | 'superadmin' | 'menu'>(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.startsWith('#menu')) return 'menu';
    if (hash === '#pos' || hash === '#login') return 'pos-login';
    // Hanya izinkan akses jika URL hash tepat sesuai kode rahasia internal
    if (hash === SUPERADMIN_SECRET_HASH) return 'superadmin';
    // Honeypot: Jika ada yang menebak #superadmin, #admin, dll, alihkan diam-diam ke landing
    if (['#superadmin', '#admin', '#saas-admin', '#platform'].includes(hash)) {
      window.history.replaceState(null, '', window.location.pathname);
      return 'landing';
    }
    return 'landing';
  });

  const [systemStatus, setSystemStatus] = useState<{
    maintenanceMode: boolean;
    maintenanceMessage: string;
    estimatedEndTime: string | null;
  }>({
    maintenanceMode: false,
    maintenanceMessage: '',
    estimatedEndTime: null,
  });

  // Polling status mode pemeliharaan sistem
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        const res = await api.getSystemStatus();
        if (res.status === 'success' && res.data) {
          setSystemStatus({
            maintenanceMode: Boolean(res.data.maintenanceMode),
            maintenanceMessage: res.data.maintenanceMessage || '',
            estimatedEndTime: res.data.estimatedEndTime || null,
          });
        }
      } catch {
        // Abaikan kegagalan jaringan
      }
    };

    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 25000);
    return () => clearInterval(interval);
  }, []);

  // Listen to hash changes for deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const lower = hash.toLowerCase();
      if (lower.startsWith('#menu')) {
        const qIdx = hash.indexOf('?');
        if (qIdx !== -1) {
          const p = new URLSearchParams(hash.slice(qIdx));
          setMenuParams({ outletId: p.get('outletId') || '', table: p.get('table') || '01' });
        }
        setViewMode('menu');
      } else if (lower === '#pos' || lower === '#login') {
        setViewMode('pos-login');
      } else if (lower === SUPERADMIN_SECRET_HASH) {
        setViewMode('superadmin');
      } else if (['#superadmin', '#admin', '#saas-admin', '#platform'].includes(lower)) {
        // Honeypot: alihkan siapapun yang menebak path admin ke landing page & bersihkan hash
        window.history.replaceState(null, '', window.location.pathname);
        setViewMode('landing');
      } else if (lower === '#landing' || lower === '') {
        setViewMode('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Tangani pencabutan sesi perangkat secara instan (Force Logout oleh Owner/Admin)
  useEffect(() => {
    const handleSessionRevoked = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      const msg =
        customEvent.detail?.message ||
        'Sesi login perangkat Anda telah dicabut oleh pemilik toko. Silakan login kembali.';
      authStorage.clearSession();
      setUser(null);
      setViewMode('pos-login');
      window.location.hash = 'pos';
      alert(msg);
    };

    window.addEventListener('auth:session_revoked', handleSessionRevoked);
    return () => window.removeEventListener('auth:session_revoked', handleSessionRevoked);
  }, []);

  useEffect(() => {
    const savedUser = authStorage.getUser();
    const token = authStorage.getToken();

    if (savedUser && token) {
      setUser(savedUser);
      // Validasi token ke server di background
      api
        .getProfile()
        .then((res) => {
          if (res.status === 'success' && res.data) {
            setUser(res.data);
            authStorage.saveSession(token, res.data);
          } else {
            authStorage.clearSession();
            setUser(null);
          }
        })
        .catch(() => {
          // Tetap gunakan cached user jika offline
        })
        .finally(() => {
          setInitializing(false);
        });
    } else {
      setInitializing(false);
    }
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    window.location.hash = 'pos';
  };

  const handleLogout = () => {
    authStorage.clearSession();
    setUser(null);
    setViewMode('pos-login');
    window.location.hash = 'pos';
  };

  const navigateTo = (mode: 'landing' | 'pos-login' | 'superadmin') => {
    setViewMode(mode);
    if (mode === 'landing') window.location.hash = '';
    else if (mode === 'pos-login') window.location.hash = 'pos';
    else if (mode === 'superadmin') window.location.hash = SUPERADMIN_SECRET_HASH.slice(1);
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-blue-950">Memuat Well POS...</span>
        </div>
      </div>
    );
  }

  // JIKA MODE PEMELIHARAAN AKTIF DAN BUKAN HALAMAN SUPERADMIN, BLOKIR KE MAINTENANCE PAGE
  if (systemStatus.maintenanceMode && viewMode !== 'superadmin') {
    return (
      <AppErrorBoundary>
        <Suspense fallback={<ViewLoadingFallback />}>
          <MaintenancePage
            maintenanceInfo={systemStatus}
            onMaintenanceResolved={() =>
              setSystemStatus((prev) => ({ ...prev, maintenanceMode: false }))
            }
          />
        </Suspense>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <DialogProvider>
        <PullToRefresh>
          <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
          {/* JIKA MODE BUKU MENU QR, TAMPILKAN HALAMAN PELANGGAN */}
          {viewMode === 'menu' ? (
            <div className="flex-1 flex flex-col">
              <Suspense fallback={<ViewLoadingFallback />}>
                <CustomerQrMenuView
                  outletId={menuParams.outletId || user?.outletId || user?.outlet?.id || ''}
                  tableCode={menuParams.table}
                />
              </Suspense>
            </div>
          ) : user ? (
            /* JIKA USER MERCHANT LOGIN, TAMPILKAN DASHBOARD POS */
            <div className="flex-1 flex flex-col">
              {(user as any).isImpersonated && (
                <div className="bg-amber-400 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md sticky top-0 z-50 border-b border-amber-500">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>
                      Mode Inspeksi Superadmin: Anda sedang mengaudit toko{' '}
                      <strong>{(user as any).businessName || user.outlet?.name}</strong>. Seluruh data operasional ini nyata milik klien.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      authStorage.clearSession();
                      setUser(null);
                      navigateTo('superadmin');
                    }}
                    className="bg-slate-950 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    &larr; Keluar &amp; Kembali ke Superadmin
                  </button>
                </div>
              )}
              <DashboardPage
                user={user}
                onLogout={handleLogout}
                onUserChange={(updatedUser) => setUser(updatedUser)}
              />
            </div>
          ) : viewMode === 'superadmin' ? (
            /* LEVEL 1: SUPERADMIN PLATFORM DASHBOARD */
            <div className="flex-1 flex flex-col">
              <Suspense fallback={<ViewLoadingFallback />}>
                <SuperadminDashboardPage
                  onBackToLanding={() => navigateTo('landing')}
                  onOpenPos={() => navigateTo('pos-login')}
                  onImpersonateSuccess={(impersonatedUser) => handleLoginSuccess(impersonatedUser)}
                />
              </Suspense>
            </div>
          ) : viewMode === 'pos-login' ? (
            /* LEVEL 2: TERMINAL MESIN KASIR LOGIN */
            <div className="flex-1 flex flex-col">
              <LoginPage
                onLoginSuccess={handleLoginSuccess}
                onGoToLanding={() => navigateTo('landing')}
                onGoToSuperadmin={() => navigateTo('superadmin')}
              />
            </div>
          ) : (
            /* WEBSITE PUBLIK SAAS KOMPREHENSIF UNTUK CALON KLIEN */
            <div className="flex-1 flex flex-col">
              <Suspense fallback={<ViewLoadingFallback />}>
                <SaasLandingPage
                  onOpenPos={() => navigateTo('pos-login')}
                  onOpenSuperadmin={() => navigateTo('superadmin')}
                />
              </Suspense>
            </div>
          )}
          {/* Global Progressive Web App (PWA) Install Banner — Hanya tampil saat pengguna telah login */}
          {user && <PwaInstallBanner />}
        </div>
      </PullToRefresh>
    </DialogProvider>
  </AppErrorBoundary>
);
};

export default App;
