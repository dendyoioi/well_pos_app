import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Phone,
  MapPin,
  Clock,
  Package,
  CheckCircle2,
  AlertCircle,
  Truck,
  Wallet,
  Award,
  ChevronDown,
  ArrowRight,
  LogOut,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { publicLaundryPortalApi } from '../services/api';
import type {
  PublicPortalOutletInfo,
  PublicPortalMeResponse,
} from '../types/laundry_core3';

interface CustomerLaundryPortalPageProps {
  outletId: string;
}

export const CustomerLaundryPortalPage: React.FC<CustomerLaundryPortalPageProps> = ({ outletId }) => {
  const sessionKey = `wellpos_customer_portal_token_${outletId}`;

  const [portalToken, setPortalToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(sessionKey);
    }
    return null;
  });

  const [outletInfo, setOutletInfo] = useState<PublicPortalOutletInfo | null>(null);
  const [loadingOutlet, setLoadingOutlet] = useState<boolean>(true);
  const [outletError, setOutletError] = useState<string | null>(null);

  // Auth / Login state
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [isSubmittingSession, setIsSubmittingSession] = useState<boolean>(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Portal Account data
  const [portalData, setPortalData] = useState<PublicPortalMeResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'pickup' | 'services'>('overview');

  // Pickup Request Form State
  const [pickupForm, setPickupForm] = useState({
    customerName: '',
    customerPhone: '',
    pickupAddress: '',
    pickupNotes: '',
    preferredPickupAt: '',
    estimatedWeightKg: '',
    serviceCategory: 'KILOAN' as 'KILOAN' | 'SATUAN' | 'EXPRESS' | 'SEPATU_TAS',
  });
  const [submittingPickup, setSubmittingPickup] = useState<boolean>(false);
  const [pickupSuccessMsg, setPickupSuccessMsg] = useState<string | null>(null);
  const [pickupErrorMsg, setPickupErrorMsg] = useState<string | null>(null);

  // Load Outlet Info
  const loadOutletInfo = async () => {
    if (!outletId) {
      setOutletError('Outlet ID tidak ditemukan pada tautan.');
      setLoadingOutlet(false);
      return;
    }
    try {
      setLoadingOutlet(true);
      setOutletError(null);
      const res = await publicLaundryPortalApi.getOutletInfo(outletId);
      if (res.status === 'success' && res.data) {
        setOutletInfo(res.data);
      } else {
        setOutletError(res.message || 'Informasi outlet tidak dapat ditemukan.');
      }
    } catch {
      setOutletError('Gagal memuat informasi outlet. Periksa koneksi Anda.');
    } finally {
      setLoadingOutlet(false);
    }
  };

  // Load Me
  const loadMe = async (token: string) => {
    try {
      const res = await publicLaundryPortalApi.getMe(token);
      if (res.status === 'success' && res.data) {
        setPortalData(res.data);
        if (res.data.customer) {
          setPickupForm((prev) => ({
            ...prev,
            customerName: prev.customerName || res.data.customer?.name || '',
            customerPhone: prev.customerPhone || res.data.customer?.phone || '',
            pickupAddress: prev.pickupAddress || res.data.customer?.address || '',
          }));
        }
      } else {
        // Token invalid / expired
        handleLogout();
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadOutletInfo();
  }, [outletId]);

  useEffect(() => {
    if (portalToken) {
      loadMe(portalToken);
    }
  }, [portalToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim() || phoneInput.trim().length < 5) {
      setSessionError('Masukkan nomor WhatsApp / HP yang valid.');
      return;
    }
    try {
      setIsSubmittingSession(true);
      setSessionError(null);
      const res = await publicLaundryPortalApi.createSession({
        outletId,
        phone: phoneInput.trim(),
      });
      if (res.status === 'success' && res.data?.token) {
        sessionStorage.setItem(sessionKey, res.data.token);
        setPortalToken(res.data.token);
      } else {
        setSessionError(res.message || 'Gagal masuk ke portal.');
      }
    } catch {
      setSessionError('Terjadi kesalahan saat memproses login. Coba lagi.');
    } finally {
      setIsSubmittingSession(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(sessionKey);
    setPortalToken(null);
    setPortalData(null);
    setPhoneInput('');
  };

  const handleCreatePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalToken) return;
    if (!pickupForm.customerName.trim() || !pickupForm.pickupAddress.trim()) {
      setPickupErrorMsg('Nama dan alamat penjemputan wajib diisi.');
      return;
    }

    try {
      setSubmittingPickup(true);
      setPickupErrorMsg(null);
      setPickupSuccessMsg(null);

      const payload = {
        customerName: pickupForm.customerName.trim(),
        customerPhone: pickupForm.customerPhone.trim() || undefined,
        pickupAddress: pickupForm.pickupAddress.trim(),
        pickupNotes: pickupForm.pickupNotes.trim() || null,
        preferredPickupAt: pickupForm.preferredPickupAt ? new Date(pickupForm.preferredPickupAt).toISOString() : null,
        estimatedWeightKg: pickupForm.estimatedWeightKg ? parseFloat(pickupForm.estimatedWeightKg) : null,
        serviceCategory: pickupForm.serviceCategory,
      };

      const res = await publicLaundryPortalApi.createPickupRequest(portalToken, payload);
      if (res.status === 'success' && res.data) {
        setPickupSuccessMsg(`Permintaan jemput berhasil dibuat dengan kode #${res.data.requestCode}!`);
        // Reset form notes & berat
        setPickupForm((prev) => ({
          ...prev,
          pickupNotes: '',
          preferredPickupAt: '',
          estimatedWeightKg: '',
        }));
        // Reload data
        loadMe(portalToken);
      } else {
        setPickupErrorMsg(res.message || 'Gagal mengirim permintaan jemput.');
      }
    } catch {
      setPickupErrorMsg('Terjadi kesalahan sistem saat mengirim permintaan jemput.');
    } finally {
      setSubmittingPickup(false);
    }
  };

  const formatRupiah = (val?: number | null) => {
    return `Rp ${(val || 0).toLocaleString('id-ID')}`;
  };

  const renderStageLabel = (stage?: string) => {
    switch (stage) {
      case 'DROP_OFF':
        return 'Diterima';
      case 'WASHING':
        return 'Sedang Dicuci';
      case 'DRYING':
        return 'Pengeringan';
      case 'IRONING':
        return 'Sedang Disetrika';
      case 'QC_PACKING':
        return 'Quality Control / Packing';
      case 'READY':
        return 'Siap Diambil / Diantar';
      case 'HANDOVER':
      case 'COMPLETED':
        return 'Selesai / Diambil';
      default:
        return stage || 'Dalam Proses';
    }
  };

  const renderPickupStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Menunggu Konfirmasi</span>;
      case 'CONFIRMED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Dikonfirmasi</span>;
      case 'DRIVER_ASSIGNED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">Kurir Ditugaskan</span>;
      case 'PICKED_UP':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Sudah Dijemput</span>;
      case 'FAILED_ATTEMPT':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">Percobaan Gagal</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Dibatalkan</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  if (loadingOutlet) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 text-sm font-medium">Memuat portal pelanggan laundry...</p>
      </div>
    );
  }

  if (outletError || !outletInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-14 h-14 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Portal Outlet Tidak Ditemukan</h2>
        <p className="text-slate-600 max-w-md text-sm mb-6">{outletError || 'Tautan portal yang Anda tuju tidak valid.'}</p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 bg-blue-900 text-white rounded-xl text-sm font-semibold hover:bg-blue-800"
        >
          Kembali ke Beranda
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* HEADER UTAMA */}
      <header className="bg-blue-950 text-white border-b border-blue-900 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-800/80 border border-blue-700 flex items-center justify-center text-white shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg leading-tight">{outletInfo.outlet.name}</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-800/60 text-blue-200 border border-blue-700/50">
                  Portal Mandiri
                </span>
              </div>
              <p className="text-xs text-blue-200/80 flex items-center gap-1.5 mt-0.5 truncate max-w-xs sm:max-w-md">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-300" />
                <span className="truncate">{outletInfo.outlet.address}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {outletInfo.outlet.phone && (
              <a
                href={`https://wa.me/${outletInfo.outlet.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>WhatsApp Outlet</span>
              </a>
            )}
            {portalToken && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer"
                title="Keluar dari portal pelanggan"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* BODY KONTEN */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {!portalToken ? (
          /* ========================================================================= */
          /* KARTU LOGIN / MULAI SESI PORTAL PELANGGAN                                */
          /* ========================================================================= */
          <div className="max-w-md mx-auto mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="w-12 h-12 bg-blue-50 text-blue-900 rounded-2xl flex items-center justify-center mb-4 border border-blue-100">
              <Phone className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Masuk Portal Pelanggan</h2>
            <p className="text-sm text-slate-500 mb-6">
              Masukkan nomor WhatsApp Anda untuk melihat saldo deposit, kuota laundry, atau meminta kurir jemput pakaian ke rumah.
            </p>

            {sessionError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{sessionError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nomor WhatsApp / HP
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Contoh: 081234567890 atau +628..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 text-sm font-medium text-slate-900"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tanpa perlu sandi. Kami mencocokkan nomor HP dengan riwayat transaksi Anda.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingSession}
                className="w-full py-3 px-4 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmittingSession ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Mau lacak nota tanpa masuk?</span>
              <a
                href="/#track"
                className="font-semibold text-blue-900 hover:text-blue-800 flex items-center gap-1"
              >
                <span>Lacak Nota</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* DASHBOARD AKTIF PORTAL PELANGGAN                                         */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* USER GREETING BANNER */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-900 to-indigo-700 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-inner">
                  {(portalData?.customer?.name || 'P')[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                      {portalData?.customer?.name || 'Pelanggan Setia'}
                    </h2>
                    {portalData?.customer?.tier && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        {portalData.customer.tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {portalData?.customer?.phone || phoneInput}
                  </p>
                </div>
              </div>

              {outletInfo.outlet.deliveryConfig?.enabled && (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-900" />
                  <span>
                    Layanan Jemput Antar: <strong>{formatRupiah(outletInfo.outlet.deliveryConfig.fixedFee)}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* TAB NAVIGATOR */}
            <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-sm gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Ringkasan &amp; Saldo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pickup')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'pickup'
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Jemput Cucian</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('services')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'services'
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Tarif Layanan</span>
              </button>
            </div>

            {/* TAB 1: RINGKASAN & SALDO */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 3 KPI CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Card 1: Saldo Deposit */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">Saldo Deposit</span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <Wallet className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatRupiah(portalData?.wallet?.balanceAmount)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Dapat digunakan untuk bayar cucian</p>
                  </div>

                  {/* Card 2: Kuota Kiloan */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">Kuota Kiloan</span>
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center">
                        <Package className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-blue-900">
                      {portalData?.wallet?.quotaKg ? Number(portalData.wallet.quotaKg).toFixed(1) : '0.0'} <span className="text-sm font-medium text-slate-500">Kg</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {portalData?.wallet?.quotaExpiresAt
                        ? `Berlaku s.d ${new Date(portalData.wallet.quotaExpiresAt).toLocaleDateString('id-ID')}`
                        : 'Paket langganan aktif'}
                    </p>
                  </div>

                  {/* Card 3: Poin Loyalitas & Tier */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">Poin &amp; Status</span>
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                        <Award className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {portalData?.customer?.loyaltyPoints || 0} <span className="text-sm font-medium text-slate-500">Poin</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Tier: <strong className="text-slate-700">{portalData?.customer?.tier || 'MEMBER'}</strong>
                    </p>
                  </div>
                </div>

                {/* DAFTAR CUCIAN BERJALAN (AKTIF) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">Cucian Sedang Diproses</h3>
                    </div>
                    <span className="text-xs text-slate-400">
                      {portalData?.activeOrders?.length || 0} order aktif
                    </span>
                  </div>

                  {!portalData?.activeOrders || portalData.activeOrders.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Tidak ada pakaian yang sedang dicuci saat ini.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {portalData.activeOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-900 text-sm font-mono">
                                #{ord.invoiceNumber}
                              </span>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-900">
                                {renderStageLabel(ord.laundryDetail?.currentStage)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>Total: {formatRupiah(ord.totalAmount)}</span>
                              {ord.laundryDetail?.totalWeightKg && (
                                <span>Berat: {Number(ord.laundryDetail.totalWeightKg).toFixed(1)} Kg</span>
                              )}
                              {ord.laundryDetail?.estimatedReadyAt && (
                                <span className="flex items-center gap-1 text-amber-700 font-medium">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Siap: {new Date(ord.laundryDetail.estimatedReadyAt).toLocaleDateString('id-ID')}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <a
                            href={`/#track?invoice=${encodeURIComponent(ord.invoiceNumber)}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 transition shadow-sm shrink-0"
                          >
                            <span>Lacak Status</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* RIWAYAT CUCIAN SELESAI */}
                {portalData?.recentOrders && portalData.recentOrders.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <h3 className="font-bold text-slate-900 text-sm mb-3">Riwayat Cucian Terakhir</h3>
                    <div className="divide-y divide-slate-100">
                      {portalData.recentOrders.map((ord) => (
                        <div key={ord.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-slate-800 font-mono">#{ord.invoiceNumber}</span>
                            <span className="text-slate-400 ml-2">
                              {new Date(ord.createdAt).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-slate-700">{formatRupiah(ord.totalAmount)}</span>
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              SELESAI
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: JEMPUT CUCIAN (SELF-SERVICE) */}
            {activeTab === 'pickup' && (
              <div className="space-y-6">
                {/* FORM MINTA JEMPUT */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-5 h-5 text-blue-900" />
                    <h3 className="font-bold text-slate-900 text-base">Minta Jemput Cucian ke Rumah</h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-6">
                    Isi detail alamat dan estimasi pakaian. Kurir kami akan segera mengonfirmasi dan menjadwalkan penjemputan.
                  </p>

                  {pickupSuccessMsg && (
                    <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm">Permintaan Diterima!</p>
                        <p className="mt-0.5">{pickupSuccessMsg}</p>
                      </div>
                    </div>
                  )}

                  {pickupErrorMsg && (
                    <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{pickupErrorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleCreatePickup} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Nama Pemesan *
                        </label>
                        <input
                          type="text"
                          value={pickupForm.customerName}
                          onChange={(e) => setPickupForm({ ...pickupForm, customerName: e.target.value })}
                          placeholder="Nama lengkap Anda"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Nomor WhatsApp Konfirmasi
                        </label>
                        <input
                          type="tel"
                          value={pickupForm.customerPhone}
                          onChange={(e) => setPickupForm({ ...pickupForm, customerPhone: e.target.value })}
                          placeholder="+628..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Alamat Penjemputan Lengkap *
                      </label>
                      <textarea
                        rows={2}
                        value={pickupForm.pickupAddress}
                        onChange={(e) => setPickupForm({ ...pickupForm, pickupAddress: e.target.value })}
                        placeholder="Nama jalan, nomor rumah, RT/RW, blok, patokan lokasi..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Jenis Layanan
                        </label>
                        <div className="relative">
                          <select
                            value={pickupForm.serviceCategory}
                            onChange={(e) => setPickupForm({ ...pickupForm, serviceCategory: e.target.value as any })}
                            className="w-full appearance-none pr-10 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white"
                          >
                            <option value="KILOAN">Cuci Kiloan</option>
                            <option value="SATUAN">Cuci Satuan</option>
                            <option value="EXPRESS">Express Kilat</option>
                            <option value="SEPATU_TAS">Sepatu &amp; Tas</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Estimasi Berat (Kg)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          value={pickupForm.estimatedWeightKg}
                          onChange={(e) => setPickupForm({ ...pickupForm, estimatedWeightKg: e.target.value })}
                          placeholder="Misal: 5.0"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Waktu Penjemputan
                        </label>
                        <input
                          type="datetime-local"
                          value={pickupForm.preferredPickupAt}
                          onChange={(e) => setPickupForm({ ...pickupForm, preferredPickupAt: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Catatan Tambahan untuk Kurir (Opsional)
                      </label>
                      <input
                        type="text"
                        value={pickupForm.pickupNotes}
                        onChange={(e) => setPickupForm({ ...pickupForm, pickupNotes: e.target.value })}
                        placeholder="Contoh: Tolong titipkan di pos satpam bila tidak ada orang"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submittingPickup}
                        className="w-full sm:w-auto px-6 py-3 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {submittingPickup ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Mengirim Permintaan...</span>
                          </>
                        ) : (
                          <>
                            <Truck className="w-4 h-4" />
                            <span>Kirim Permintaan Jemput</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* RIWAYAT PERMINTAAN JEMPUT SAYA */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-4">Riwayat Permintaan Jemput</h3>

                  {!portalData?.pickupRequests || portalData.pickupRequests.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      Belum ada permintaan jemput yang dikirim.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {portalData.pickupRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex flex-col gap-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-blue-900">
                                #{req.requestCode}
                              </span>
                              {renderPickupStatusBadge(req.status)}
                            </div>
                            <span className="text-xs text-slate-400">
                              {new Date(req.createdAt).toLocaleString('id-ID')}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 space-y-1">
                            <p>
                              <strong className="text-slate-800">Alamat:</strong> {req.pickupAddress}
                            </p>
                            {req.pickupNotes && (
                              <p className="text-slate-500 italic">
                                "{req.pickupNotes}"
                              </p>
                            )}
                            {req.courierName && (
                              <p className="text-blue-900 font-medium flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5" />
                                <span>Kurir: <strong>{req.courierName}</strong> {req.courierPhone ? `(${req.courierPhone})` : ''}</span>
                              </p>
                            )}
                          </div>

                          {/* PERINGATAN GAGAL JEMPUT JIKA ADA */}
                          {req.status === 'FAILED_ATTEMPT' && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Percobaan Penjemputan Belum Berhasil (Percobaan ke-{req.attemptCount})</span>
                              </div>
                              <p>Alasan: {req.lastFailureReason || 'Penerima tidak berada di lokasi'}</p>
                              {req.rescheduledAt && (
                                <p className="font-medium mt-0.5 text-rose-900">
                                  Jadwal Ulang: {new Date(req.rescheduledAt).toLocaleString('id-ID')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: TARIF LAYANAN */}
            {activeTab === 'services' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-blue-900" />
                  <h3 className="font-bold text-slate-900 text-base">Katalog Layanan &amp; Tarif Outlet</h3>
                </div>

                {!outletInfo.services || outletInfo.services.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Belum ada daftar layanan yang dipublikasikan.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {outletInfo.services.map((svc) => (
                      <div
                        key={svc.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-blue-900/40 transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <h4 className="font-bold text-slate-900 text-sm">{svc.name}</h4>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                              {svc.category}
                            </span>
                          </div>
                          {svc.description && (
                            <p className="text-xs text-slate-500 mb-3">{svc.description}</p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{svc.durationHours} Jam Selesai</span>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-bold text-blue-900">
                              {formatRupiah(svc.price)}
                            </span>
                            <span className="text-slate-500 text-[11px]">/{svc.unit}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 mt-auto">
        <p>&copy; {new Date().getFullYear()} {outletInfo.outlet.name} • Didukung oleh Well POS</p>
      </footer>
    </div>
  );
};

export default CustomerLaundryPortalPage;
