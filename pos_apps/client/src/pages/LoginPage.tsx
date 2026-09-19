import React, { useState, useEffect } from 'react';
import {
  Store,
  Mail,
  Lock,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Clock,
  CheckCircle2,
  X,
  Smartphone,
  Laptop,
  Check,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { PinNumpad } from '../components/PinNumpad';
import {
  api,
  authStorage,
  pairedDeviceStorage,
  type PairedDeviceContext,
} from '../services/api';
import type { User as AuthUser } from '../types/auth';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onGoToLanding?: () => void;
  onGoToSuperadmin?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onGoToLanding,
}) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'backoffice'>('pos');

  // Paired Device Context
  const [pairedDevice, setPairedDevice] = useState<PairedDeviceContext | null>(null);
  const [activeCashiers, setActiveCashiers] = useState<
    Array<{ id: string; name: string; role: string; email: string }>
  >([]);
  const [selectedCashier, setSelectedCashier] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  // Device Pairing Form State
  const [storeIdentifier, setStoreIdentifier] = useState('');
  const [authPin, setAuthPin] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [availableOutlets, setAvailableOutlets] = useState<
    Array<{ id: string; name: string; address?: string }>
  >([]);
  const [pairingTenant, setPairingTenant] = useState<{
    id: string;
    businessName: string;
    slug: string;
  } | null>(null);
  const [selectedOutletId, setSelectedOutletId] = useState('');

  // Cashier PIN Numpad State
  const [pin, setPin] = useState('');

  // Backoffice Email/Password State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [pendingApprovalData, setPendingApprovalData] = useState<{
    tenantName?: string;
    message?: string;
  } | null>(null);

  // Load existing paired device context on mount
  useEffect(() => {
    const saved = pairedDeviceStorage.get();
    if (saved) {
      setPairedDevice(saved);
      loadCashiers(saved.tenantId, saved.outletId);
    }
  }, []);

  const loadCashiers = async (tenantId: string, outletId: string) => {
    try {
      const res = await api.getPairedOutletCashiers(tenantId, outletId);
      if (res.status === 'success' && res.data) {
        setActiveCashiers(res.data);
      }
    } catch {
      // Non-blocking
    }
  };

  // Handle Pairing Step 1 (Validate Store Identifier + Owner/SPV PIN)
  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await api.pairDevice(storeIdentifier, authPin);
      if (res.status === 'success' && res.data) {
        const { tenant, outlets } = res.data;

        if (!outlets || outlets.length === 0) {
          setError('Toko ini belum memiliki cabang toko aktif untuk kasir.');
          return;
        }

        // Jika hanya ada 1 cabang toko, langsung pairing otomatis
        if (outlets.length === 1) {
          const singleOutlet = outlets[0];
          const newContext: PairedDeviceContext = {
            tenantId: tenant.id,
            tenantName: tenant.businessName,
            tenantSlug: tenant.slug,
            outletId: singleOutlet.id,
            outletName: singleOutlet.name,
            pairedAt: new Date().toISOString(),
          };

          if (rememberDevice) {
            pairedDeviceStorage.set(newContext);
          }
          setPairedDevice(newContext);
          setSuccessMessage(`Perangkat berhasil terhubung ke ${tenant.businessName} - ${singleOutlet.name}`);
          loadCashiers(newContext.tenantId, newContext.outletId);
        } else {
          // Jika memiliki multi-cabang, tampilkan pilihan cabang
          setPairingTenant(tenant);
          setAvailableOutlets(outlets);
          setSelectedOutletId(outlets[0].id);
        }
      } else {
        setError(res.message || 'Gagal menghubungkan perangkat');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  };

  // Handle Pairing Step 2 (Multi-Outlet Selection Confirmation)
  const handleConfirmOutletPairing = () => {
    if (!pairingTenant || !selectedOutletId) return;

    const chosenOutlet = availableOutlets.find((o) => o.id === selectedOutletId);
    if (!chosenOutlet) return;

    const newContext: PairedDeviceContext = {
      tenantId: pairingTenant.id,
      tenantName: pairingTenant.businessName,
      tenantSlug: pairingTenant.slug,
      outletId: chosenOutlet.id,
      outletName: chosenOutlet.name,
      pairedAt: new Date().toISOString(),
    };

    if (rememberDevice) {
      pairedDeviceStorage.set(newContext);
    }
    setPairedDevice(newContext);
    setPairingTenant(null);
    setAvailableOutlets([]);
    setSuccessMessage(`Perangkat berhasil terhubung ke ${newContext.tenantName} - ${newContext.outletName}`);
    loadCashiers(newContext.tenantId, newContext.outletId);
  };

  // Handle Unpair Device
  const handleUnpairDevice = () => {
    pairedDeviceStorage.clear();
    setPairedDevice(null);
    setActiveCashiers([]);
    setSelectedCashier(null);
    setPin('');
    setSuccessMessage(null);
    setError(null);
  };

  // Handle Cashier PIN Login on Paired Device
  const handlePinSubmit = async (overridePin?: string) => {
    const activePin = typeof overridePin === 'string' ? overridePin : pin;
    if (activePin.length !== 6) return;
    setError(null);
    setLoading(true);

    try {
      const res = await api.loginWithPin(
        activePin,
        selectedCashier?.email,
        pairedDevice?.outletId,
        pairedDevice?.tenantId
      );

      if (res.status === 'success' && res.data) {
        authStorage.saveSession(res.data.token, res.data.user);
        onLoginSuccess(res.data.user);
      } else {
        setError(res.message || 'PIN kasir tidak sesuai atau akun tidak aktif');
        setPin('');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke server');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Handle Email & Password Backoffice Login
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.loginWithPassword(email, password);
      if (res.status === 'success' && res.data) {
        authStorage.saveSession(res.data.token, res.data.user);
        onLoginSuccess(res.data.user);
      } else if (
        res.code === 'TENANT_PENDING_APPROVAL' ||
        res.message?.includes('Pending Approval') ||
        res.message?.includes('peninjauan')
      ) {
        setPendingApprovalData({
          tenantName: res.tenantName,
          message: res.message,
        });
      } else {
        setError(res.message || 'Email atau kata sandi tidak sesuai');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-4 relative overflow-hidden bg-slate-50 text-slate-900">
      {/* Background Accents */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-100/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-100/70 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar Navigation */}
      <header className="w-full max-w-lg flex items-center justify-start py-2 z-10">
        <button
          type="button"
          onClick={onGoToLanding}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-950 bg-white hover:bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 transition-all shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
          <span>Kembali ke Website</span>
        </button>
      </header>

      {/* Main Container Card */}
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/80 relative z-10 my-auto">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-13 h-13 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-lg shadow-blue-900/25 mb-3">
            <Store className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-blue-950">
            {activeTab === 'pos' ? 'Mesin Kasir Terminal' : 'Portal Pemilik Toko'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Well POS Multi-Tenant Retail &bull; v2.2
          </p>
        </div>

        {/* Tab Selector: Mesin Kasir (PIN) vs Portal Pemilik (Email) */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 border border-slate-200 rounded-2xl mb-5 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('pos');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'pos'
                ? 'bg-blue-900 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mesin Kasir (Terminal)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('backoffice');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'backoffice'
                ? 'bg-blue-900 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Portal Pemilik (Email)</span>
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs sm:text-sm animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 1: MESIN KASIR (DEVICE PAIRING & FAST PIN) */}
        {/* ==================================================== */}
        {activeTab === 'pos' && (
          <div>
            {pairedDevice ? (
              // KONDISI A: PERANGKAT SUDAH TER-PAIRING
              <div className="space-y-4">
                {/* Paired Device Store Identity Card */}
                <div className="p-3.5 bg-blue-50/80 border border-blue-200/90 rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shadow-xs">
                      <Store className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-blue-950">
                          {pairedDevice.tenantName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full font-bold">
                          Terhubung
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                        Cabang: <strong className="text-blue-900">{pairedDevice.outletName}</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleUnpairDevice}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600 hover:bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors font-semibold"
                    title="Putuskan sambungan perangkat dari toko ini"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Ganti Toko</span>
                  </button>
                </div>

                {/* Cashier Selector Chips (Optional Quick Pick) */}
                {activeCashiers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-blue-900" />
                        Pilih Petugas Kasir (Opsional):
                      </span>
                      {selectedCashier && (
                        <button
                          type="button"
                          onClick={() => setSelectedCashier(null)}
                          className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                        >
                          Hapus Pilihan
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {activeCashiers.map((c) => {
                        const isSelected = selectedCashier?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCashier(isSelected ? null : c)}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                              isSelected
                                ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {c.name}
                            <span className="text-[10px] opacity-70 ml-1">
                              ({c.role === 'ADMIN' ? 'Owner' : 'Kasir'})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Interactive Numpad */}
                <div className="pt-1">
                  <p className="text-center text-xs text-slate-500 mb-1 font-medium">
                    {selectedCashier
                      ? `Masukkan 6-digit PIN untuk ${selectedCashier.name}:`
                      : 'Masukkan 6-digit PIN Kasir Toko:'}
                  </p>
                  <PinNumpad
                    pin={pin}
                    onPinChange={setPin}
                    onSubmit={handlePinSubmit}
                    loading={loading}
                  />
                </div>
              </div>
            ) : pairingTenant ? (
              // KONDISI B: LANGKAH 2 MULTI-CABANG (PILIH CABANG TOKO)
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                  <h3 className="text-sm font-extrabold text-blue-950 mb-1">
                    Pilih Cabang untuk Terminal Ini
                  </h3>
                  <p className="text-xs text-slate-600">
                    Toko <strong>{pairingTenant.businessName}</strong> memiliki beberapa cabang ritel. Tentukan cabang mana yang menggunakan mesin kasir ini.
                  </p>
                </div>

                <div className="space-y-2">
                  {availableOutlets.map((outlet) => {
                    const isSelected = selectedOutletId === outlet.id;
                    return (
                      <button
                        key={outlet.id}
                        type="button"
                        onClick={() => setSelectedOutletId(outlet.id)}
                        className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-blue-900/5 border-blue-900 text-blue-950 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">{outlet.name}</p>
                          {outlet.address && (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {outlet.address}
                            </p>
                          )}
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-900 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPairingTenant(null);
                      setAvailableOutlets([]);
                    }}
                    className="w-1/3 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmOutletPairing}
                    className="w-2/3 py-2.5 px-3 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Simpan & Pasang Kasir</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              // KONDISI C: FORM PAIRING PERANGKAT AWAL
              <form onSubmit={handlePairDevice} className="space-y-4">
                <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-blue-950">
                  <Smartphone className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Hubungkan Mesin Kasir ke Toko</p>
                    <p className="text-slate-600 mt-0.5 leading-relaxed text-[11px]">
                      Masukkan ID Toko (Slug), Email Pemilik, atau No. WhatsApp terdaftar, beserta PIN Pemilik untuk mengenali perangkat ini.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ID Toko / Email Pemilik / No. WhatsApp:
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={storeIdentifier}
                      onChange={(e) => setStoreIdentifier(e.target.value)}
                      placeholder="Contoh: kopi-nusantara, nama@email.com, atau 0812..."
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-blue-900/10 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PIN Otorisasi Pemilik / SPV (6-Digit):
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      maxLength={6}
                      required
                      value={authPin}
                      onChange={(e) => setAuthPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-blue-900/10 tracking-widest font-mono text-base"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="rememberDevice"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 text-blue-900 rounded border-slate-300 focus:ring-blue-900 cursor-pointer"
                  />
                  <label
                    htmlFor="rememberDevice"
                    className="text-xs text-slate-700 font-medium cursor-pointer select-none"
                  >
                    Kenali & Ingat Perangkat Ini (Tidak perlu input ID Toko lagi)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 bg-blue-900 hover:bg-blue-950 active:scale-[0.98] disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  {loading ? (
                    'Menghubungkan Perangkat...'
                  ) : (
                    <>
                      <span>Hubungkan Mesin Kasir</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: PORTAL PEMILIK (EMAIL & PASSWORD BACKOFFICE) */}
        {/* ==================================================== */}
        {activeTab === 'backoffice' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 mb-1">
              Khusus Pemilik Toko, Supervisor, atau Administrator untuk akses Backoffice (Laporan Keuangan, Stok Gudang, Multi-Cabang & Manajemen Staf).
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Alamat Email Terdaftar:
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@toko.com"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-blue-900/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kata Sandi:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-blue-900/10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-blue-900 hover:bg-blue-950 active:scale-[0.98] disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
            >
              {loading ? (
                'Memverifikasi Akun...'
              ) : (
                <>
                  <span>Masuk ke Portal Pemilik</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer Info */}
      <footer className="mt-4 text-center text-xs text-slate-400 z-10">
        <p>&copy; 2026 Well POS Indonesia &bull; PT Well Digital Solusindo &bull; Sistem POS Multi-Tenant</p>
      </footer>

      {/* MODAL: PENDING APPROVAL SAAS STATUS */}
      {pendingApprovalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-amber-200 rounded-3xl p-6 max-w-md w-full shadow-2xl relative text-center">
            <button
              type="button"
              onClick={() => setPendingApprovalData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Clock className="w-8 h-8 stroke-[2.5] animate-pulse" />
            </div>

            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-block mb-2">
              Menunggu Persetujuan
            </span>

            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Akun Bisnis Sedang Ditinjau
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              Pendaftaran toko{' '}
              <strong className="text-slate-900">
                {pendingApprovalData.tenantName || 'Anda'}
              </strong>{' '}
              telah kami terima dan sedang dalam proses verifikasi tim aktivasi Super Admin Well POS.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2 mb-6">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Registrasi Berhasil Terkirim</span>
              </div>
              <div className="flex items-center gap-2 font-semibold text-amber-700">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Pemeriksaan Tim Super Admin</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPendingApprovalData(null)}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md"
            >
              Mengerti & Kembali
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
