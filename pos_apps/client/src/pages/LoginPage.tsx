import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  User,
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
    Array<{ id: string; name: string; role: string; email: string; userCode?: string }>
  >([]);
  const [selectedCashier, setSelectedCashier] = useState<{
    id: string;
    name: string;
    role: string;
    email: string;
    userCode?: string;
  } | null>(null);
  const [isCashierDropdownOpen, setIsCashierDropdownOpen] = useState(false);
  const cashierDropdownRef = useRef<HTMLDivElement>(null);

  // Device Pairing Form State
  const [tenantSlug, setTenantSlug] = useState('');          // ID Toko (slug) untuk pairing
  const [staffCode, setStaffCode] = useState('');            // ID Staff Owner/SPV untuk pairing
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
  const [pendingLoginAuth, setPendingLoginAuth] = useState<{ token: string; user: AuthUser } | null>(null);

  // Cashier PIN Numpad State
  const [pin, setPin] = useState('');
  const [cashierStaffCode, setCashierStaffCode] = useState(''); // ID Staff kasir saat login PIN
  const [isStaffCodeConfirmed, setIsStaffCodeConfirmed] = useState(false); // step 1 selesai?

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

  // Tutup dropdown kasir saat klik di luar komponen
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cashierDropdownRef.current && !cashierDropdownRef.current.contains(event.target as Node)) {
        setIsCashierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER': return 'Owner';
      case 'ADMIN': return 'Admin';
      case 'SUPERVISOR': return 'Supervisor';
      case 'CASHIER': return 'Kasir';
      case 'WAREHOUSE': return 'Gudang';
      default: return role;
    }
  };

  // Handle Pairing Step 1 (Validate Store Identifier + Owner/SPV PIN)
  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await api.pairDevice(tenantSlug.trim().toLowerCase(), staffCode, authPin);
      if (res.status === 'success' && res.data) {
        const { tenant, outlets } = res.data;

        if (!outlets || outlets.length === 0) {
          setError('Toko ini belum memiliki outlet toko aktif untuk kasir.');
          return;
        }

        // Jika login session otomatis disertakan (kasir atau staf langsung login)
        if (res.data.token && res.data.user) {
          const userOutletId = res.data.user.outletId;
          const assignedOutlet = outlets.find((o: any) => o.id === userOutletId);

          if (assignedOutlet || outlets.length === 1) {
            const chosenOutlet = assignedOutlet || outlets[0];
            const newContext: PairedDeviceContext = {
              tenantId: tenant.id,
              tenantName: tenant.businessName,
              tenantSlug: tenant.slug,
              outletId: chosenOutlet.id,
              outletName: chosenOutlet.name,
              pairedAt: new Date().toISOString(),
            };

            if (rememberDevice) {
              pairedDeviceStorage.set(newContext);
            }
            setPairedDevice(newContext);
            authStorage.saveSession(res.data.token, res.data.user);
            onLoginSuccess(res.data.user);
            return;
          }

          // Jika user multi-outlet tanpa outlet spesifik, simpan auth untuk setelah memilih outlet
          setPendingLoginAuth({ token: res.data.token, user: res.data.user });
        }

        // Jika hanya ada 1 outlet toko, langsung pairing otomatis
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
          // Jika memiliki multi-outlet, tampilkan pilihan toko
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

    if (pendingLoginAuth) {
      authStorage.saveSession(pendingLoginAuth.token, pendingLoginAuth.user);
      onLoginSuccess(pendingLoginAuth.user);
      return;
    }

    setSuccessMessage(`Perangkat berhasil terhubung ke ${newContext.tenantName} - ${newContext.outletName}`);
    loadCashiers(newContext.tenantId, newContext.outletId);
  };

  // Handle Unpair Device
  const handleUnpairDevice = () => {
    pairedDeviceStorage.clear();
    setPairedDevice(null);
    setActiveCashiers([]);
    setSelectedCashier(null);
    setIsCashierDropdownOpen(false);
    setPin('');
    setCashierStaffCode('');
    setIsStaffCodeConfirmed(false);
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
        cashierStaffCode && cashierStaffCode !== 'CHIP' ? cashierStaffCode.trim() : undefined,
        selectedCashier?.email,                 // Fallback: email (cara lama)
        pairedDevice?.outletId,
        pairedDevice?.tenantId
      );

      if (res.status === 'success' && res.data) {
        authStorage.saveSession(res.data.token, res.data.user);
        onLoginSuccess(res.data.user);
      } else {
        setError(res.message || 'ID Staff atau PIN kasir tidak sesuai');
        setPin('');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke server');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Konfirmasi ID Staff selesai diinput, pindah ke step PIN
  const handleConfirmStaffCode = () => {
    if (!cashierStaffCode || cashierStaffCode.length === 0) return;
    setIsStaffCodeConfirmed(true);
    setPin('');
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
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2.5 text-rose-700 text-xs sm:text-sm animate-shake">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-1 text-rose-400 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors shrink-0"
              aria-label="Tutup notifikasi error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-emerald-800 text-xs font-medium">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="p-1 text-emerald-500 hover:text-emerald-800 hover:bg-emerald-100 rounded-lg transition-colors shrink-0"
              aria-label="Tutup notifikasi sukses"
            >
              <X className="w-4 h-4" />
            </button>
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
                        Toko: <strong className="text-blue-900">{pairedDevice.outletName}</strong>
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

                {/* Cashier Selector Dropdown / Selected State */}
                {activeCashiers.length > 0 && (
                  <div className="relative" ref={cashierDropdownRef}>
                    {!selectedCashier ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-blue-900" />
                            Pilih Nama Kasir:
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            (Opsional / input ID di numpad)
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={() => setIsCashierDropdownOpen(!isCashierDropdownOpen)}
                          className="w-full bg-white border border-slate-300 hover:border-blue-900 focus:border-blue-900 text-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm flex items-center justify-between transition-all shadow-2xs group"
                        >
                          <div className="flex items-center gap-2.5 text-slate-500">
                            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-medium text-slate-600">-- Pilih Kasir yang Bertugas --</span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 group-hover:text-blue-900 transition-transform duration-200 ${
                              isCashierDropdownOpen ? 'rotate-180 text-blue-900' : ''
                            }`}
                          />
                        </button>

                        {/* Dropdown Popover List */}
                        {isCashierDropdownOpen && (
                          <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fadeIn">
                            {activeCashiers.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCashier(c);
                                  setCashierStaffCode(c.userCode || 'CHIP');
                                  setIsStaffCodeConfirmed(true);
                                  setPin('');
                                  setIsCashierDropdownOpen(false);
                                }}
                                className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50/70 flex items-center justify-between transition-colors group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-900 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                                    {c.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="truncate">
                                    <p className="text-xs font-bold text-slate-800 group-hover:text-blue-950 truncate">
                                      {c.name}
                                    </p>
                                    {c.userCode && (
                                      <p className="text-[10px] text-slate-400 font-mono">
                                        ID Staff: {c.userCode}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ml-2 ${
                                    c.role === 'OWNER'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : c.role === 'SUPERVISOR'
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}
                                >
                                  {getRoleLabel(c.role)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Elegant Selected Cashier Card */
                      <div className="p-3 bg-blue-50/90 border border-blue-200/90 rounded-2xl flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                            {selectedCashier.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-blue-950 truncate">
                                {selectedCashier.name}
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  selectedCashier.role === 'OWNER'
                                    ? 'bg-amber-100 text-amber-800'
                                    : selectedCashier.role === 'SUPERVISOR'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-200/80 text-blue-900'
                                }`}
                              >
                                {getRoleLabel(selectedCashier.role)}
                              </span>
                            </div>
                            <p className="text-[11px] text-blue-900/70 font-mono mt-0.5">
                              {selectedCashier.userCode ? `ID: ${selectedCashier.userCode} • ` : ''}Siap input PIN
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCashier(null);
                            setCashierStaffCode('');
                            setIsStaffCodeConfirmed(false);
                            setPin('');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 font-semibold transition-all shadow-2xs shrink-0 ml-2"
                          title="Ganti staf kasir"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Ganti Kasir</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Two-Step Numpad: ID Staff → PIN (tidak ada keyboard OS) */}
                <div className="pt-1">
                  <PinNumpad
                    pin={pin}
                    onPinChange={setPin}
                    onSubmit={handlePinSubmit}
                    loading={loading}
                    staffCode={selectedCashier ? undefined : cashierStaffCode}
                    onStaffCodeChange={selectedCashier ? undefined : (code) => {
                      setCashierStaffCode(code);
                    }}
                    onConfirmStaffCode={selectedCashier ? undefined : handleConfirmStaffCode}
                    isStaffConfirmed={selectedCashier ? true : isStaffCodeConfirmed}
                    maxStaffCodeLength={5}
                  />
                </div>
              </div>
            ) : pairingTenant ? (
              // KONDISI B: LANGKAH 2 MULTI-OUTLET (PILIH OUTLET TOKO)
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                  <h3 className="text-sm font-extrabold text-blue-950 mb-1">
                    Pilih Toko untuk Terminal Ini
                  </h3>
                  <p className="text-xs text-slate-600">
                    Toko <strong>{pairingTenant.businessName}</strong> memiliki beberapa outlet toko. Tentukan outlet toko mana yang menggunakan mesin kasir ini.
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
                    <p className="font-bold">Buka & Hubungkan Mesin Kasir ke Toko</p>
                    <p className="text-slate-600 mt-0.5 leading-relaxed text-[11px]">
                      Masukkan <strong>ID Toko</strong>, <strong>ID Staff</strong>, dan <strong>PIN Cepat</strong> Anda untuk langsung login & menghubungkan perangkat kasir ini ke toko.
                    </p>
                  </div>
                </div>

                {/* Field 1: ID Toko (slug) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ID Toko (Company Slug):
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={tenantSlug}
                      onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="Contoh: ura-coffee"
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-blue-900/10 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    ID Toko dapat dilihat di halaman Pengaturan Toko atau diberikan oleh Owner.
                  </p>
                </div>

                {/* Field 2: ID Staff */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ID Staff (5-Digit):
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={10}
                      value={staffCode}
                      onChange={(e) => setStaffCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Contoh: 42031"
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-blue-900/10 font-mono font-bold tracking-widest"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    ID Staff terdiri dari 5 digit angka (terdaftar di Kelola Staf).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PIN Cepat (6-Digit):
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
                    Kenali &amp; Ingat Perangkat Ini (Tidak perlu input ulang saat restart)
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
              Khusus Pemilik Toko, Supervisor, atau Administrator untuk akses Backoffice (Laporan Keuangan, Stok Gudang, Multi-Store &amp; Manajemen Staf).
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

            <div className="mt-4 text-center text-xs text-slate-500">
              Belum memiliki akun merchant?{' '}
              <button
                type="button"
                onClick={() => {
                  if (onGoToLanding) onGoToLanding();
                  window.location.hash = 'register';
                }}
                className="font-bold text-blue-900 hover:text-blue-950 underline transition-colors"
              >
                Daftar Gratis Sekarang
              </button>
            </div>
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
