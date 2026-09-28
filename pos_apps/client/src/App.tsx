import React, { useState, useEffect, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SaasLandingPage } from './pages/SaasLandingPage';
import { SuperadminDashboardPage } from './pages/SuperadminDashboardPage';
import { CustomerQrMenuView } from './pages/CustomerQrMenuView';
import { api, authStorage } from './services/api';
import type { User } from './types/auth';
import { DialogProvider } from './context/DialogContext';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h2 className="text-lg font-black text-blue-950">Terjadi Kesalahan Tampilan</h2>
            <p className="text-xs text-slate-500">
              {this.state.error?.message || 'Gagal memuat komponen antarmuka.'}
            </p>
            <div className="pt-2 flex gap-2 justify-center">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Muat Ulang Halaman
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    if (['#superadmin', '#admin', '#saas-admin', '#platform'].includes(hash)) return 'superadmin';
    return 'landing';
  });

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
      } else if (['#superadmin', '#admin', '#saas-admin', '#platform'].includes(lower)) {
        setViewMode('superadmin');
      } else if (lower === '#landing' || lower === '') {
        setViewMode('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
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
    else if (mode === 'superadmin') window.location.hash = 'superadmin';
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

  return (
    <ErrorBoundary>
      <DialogProvider>
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
          {/* JIKA MODE BUKU MENU QR, TAMPILKAN HALAMAN PELANGGAN */}
          {viewMode === 'menu' ? (
            <div className="flex-1 flex flex-col">
              <CustomerQrMenuView
                outletId={menuParams.outletId || user?.outletId || user?.outlet?.id || ''}
                tableCode={menuParams.table}
              />
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
              <SuperadminDashboardPage
                onBackToLanding={() => navigateTo('landing')}
                onOpenPos={() => navigateTo('pos-login')}
                onImpersonateSuccess={(impersonatedUser) => handleLoginSuccess(impersonatedUser)}
              />
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
              <SaasLandingPage
                onOpenPos={() => navigateTo('pos-login')}
                onOpenSuperadmin={() => navigateTo('superadmin')}
              />
            </div>
          )}
        </div>
      </DialogProvider>
    </ErrorBoundary>
  );
};

export default App;
