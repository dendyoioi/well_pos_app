import React, { useState, useEffect } from 'react';
import {
  Zap,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Printer,
  X,
  Store,
  Tag,
  Receipt,
  RotateCw,
  Sparkles,
  Info,
} from 'lucide-react';
import type { User } from '../types/auth';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import { TablePagination } from '../components/TablePagination';
import { PakasirDirectQrisModal } from '../components/saas/PakasirDirectQrisModal';

interface BillingTokensViewProps {
  user: User;
  activeOutlet: Outlet | null;
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
};

export const BillingTokensView: React.FC<BillingTokensViewProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState<any | null>(null);

  // Pagination state for Invoices
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Auto-reset page when invoices change
  useEffect(() => {
    setCurrentPage(1);
  }, [invoices.length]);

  const invoiceTotalPages = Math.max(1, Math.ceil(invoices.length / pageSize));
  const safeInvoicePage = Math.min(Math.max(1, currentPage), invoiceTotalPages);
  const paginatedInvoices = invoices.slice(
    (safeInvoicePage - 1) * pageSize,
    safeInvoicePage * pageSize
  );

  // Top-Up Modal State
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpPreset, setTopUpPreset] = useState<number>(1000);
  const [customTokenAmount, setCustomTokenAmount] = useState<number>(250);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any | null>(null);
  const [promoError, setPromoError] = useState('');
  const [paymentMethod] = useState<'QRIS'>('QRIS');
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [platformPaymentConfig, setPlatformPaymentConfig] = useState<any>(null);

  // Dynamic token config from platform HQ
  const tokenPrice = platformPaymentConfig?.tokenPrice ?? 69;
  const minTokenPurchase = platformPaymentConfig?.minTokenPurchase ?? 250;
  const qrisEnabled = platformPaymentConfig?.qrisEnabled ?? (platformPaymentConfig?.qris?.enabled ?? true);
  const presetPackages: Array<{
    id?: string;
    tokens: number;
    label?: string;
    name?: string;
    price?: number;
    badge?: string;
    isPopular?: boolean;
    description?: string;
  }> = platformPaymentConfig?.packages || [
    { tokens: 250, name: 'Starter 250', label: 'Starter 250', badge: 'Trial Ramah', isPopular: false },
    { tokens: 1000, name: 'Basic 1.000', label: 'Basic 1.000', badge: 'Paling Fleksibel', isPopular: false },
    { tokens: 2500, name: 'Pro 2.500', label: 'Pro 2.500', badge: '⭐ Paling Diminati', isPopular: true },
    { tokens: 5000, name: 'Enterprise 5.000', label: 'Enterprise 5.000', badge: 'Kapasitas Besar', isPopular: false },
  ];

  // State Direct QRIS Pakasir untuk Top-Up
  const [qrisModalData, setQrisModalData] = useState<{
    invoiceNumber: string;
    amount: number;
    tokenAmount: number;
    qrString: string;
  } | null>(null);
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);

  const fetchSubscriptionAndInvoices = async () => {
    setLoading(true);
    try {
      const [subRes, invRes, payCfgRes] = await Promise.all([
        api.getMySubscription(),
        api.getMyInvoices(),
        api.getPlatformPaymentConfigForOwner(),
      ]);

      if (subRes.status === 'success' && subRes.data) {
        setSubscriptionData(subRes.data);
      }
      if (invRes.status === 'success' && Array.isArray(invRes.data)) {
        setInvoices(invRes.data);
      }
      if (payCfgRes.status === 'success' && payCfgRes.data) {
        setPlatformPaymentConfig(payCfgRes.data);
      }
    } catch (err) {
      console.error('Error fetching subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionAndInvoices();
  }, []);

  const tokenAmount = isCustomMode ? customTokenAmount : topUpPreset;
  const baseCost = tokenAmount * tokenPrice;
  const discountCost = appliedPromo ? appliedPromo.discountAmount || 0 : 0;
  const bonusTokens = appliedPromo ? appliedPromo.bonusTokens || 0 : 0;
  const finalCost = Math.max(0, baseCost - discountCost);
  const totalTokensReceived = tokenAmount + bonusTokens;

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setPromoError('');
    try {
      const res = await api.validateTenantPromo({
        code: promoCodeInput.trim(),
        tokenAmount,
      });

      if (res.status === 'success' && res.data) {
        setAppliedPromo(res.data);
      } else {
        setPromoError(res.message || 'Kupon promo tidak dapat digunakan');
        setAppliedPromo(null);
      }
    } catch (err) {
      setPromoError('Gagal memeriksa kupon promo');
      setAppliedPromo(null);
    }
  };

  const handleExecuteTopUp = async () => {
    if (tokenAmount <= 0) return;
    setIsSubmittingTopUp(true);
    try {
      const res = await api.topUpTokens({
        tokenAmount,
        promoCode: appliedPromo?.code || undefined,
        paymentMethod,
      });

      if (res.status === 'success') {
        setIsTopUpModalOpen(false);
        setAppliedPromo(null);
        setPromoCodeInput('');
        await fetchSubscriptionAndInvoices();

        // Jika metode QRIS dan invoice memiliki qrString dari Pakasir, buka Direct QRIS Modal
        if (paymentMethod === 'QRIS' && res.data?.invoice?.qrString) {
          setQrisModalData({
            invoiceNumber: res.data.invoice.invoiceNumber,
            amount: res.data.invoice.amount || finalCost,
            tokenAmount: res.data.invoice.tokenAmount || tokenAmount,
            qrString: res.data.invoice.qrString,
          });
          setIsQrisModalOpen(true);
        } else {
          setActionFeedback({
            message: res.message || 'Top-up kuota token berhasil diproses!',
            type: 'success',
          });
          if (res.data?.invoice) {
            setSelectedInvoiceModal(res.data.invoice);
          }
        }
      } else {
        setActionFeedback({
          message: res.message || 'Gagal memproses top-up kuota',
          type: 'error',
        });
      }
    } catch (err) {
      setActionFeedback({
        message: 'Terjadi kesalahan sistem saat memproses top-up',
        type: 'error',
      });
    } finally {
      setIsSubmittingTopUp(false);
    }
  };

  const quota = subscriptionData?.quota || {
    totalQuota: 2000,
    usedOrders: 0,
    remainingQuota: 2000,
    percentUsed: 0,
    quotaStatus: 'SAFE',
    outletUsage: [],
  };

  const tenant = subscriptionData?.tenant || {
    businessName: 'Toko Saya',
    ownerName: user.name,
    ownerEmail: user.email,
  };

  const currentPlan = subscriptionData?.subscription || {
    planName: 'Enterprise-Lite F&B',
    planCode: 'PRO',
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
              <Zap className="w-5 h-5 fill-amber-500 text-amber-600" />
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Paket &amp; Kuota Token Transaksi
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Monitoring saldo pesanan toko, top-up kuota Pay-As-You-Go tanpa batas waktu hangus, dan akses faktur resmi.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={fetchSubscriptionAndInvoices}
            disabled={loading}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Perbarui Data"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
          <button
            onClick={() => setIsTopUpModalOpen(true)}
            className="flex-1 sm:flex-initial justify-center px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white text-white" />
            <span>+ Top-Up Kuota Token</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Grid: Quota Meter & Business Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Live Quota Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Saldo Kuota Aktif (Pay-As-You-Go)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-black text-slate-900 tracking-tight">
                    {Number(quota.remainingQuota).toLocaleString('id-ID')}
                  </span>
                  <span className="text-sm font-bold text-slate-500">Order Tersisa</span>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                  quota.quotaStatus === 'SAFE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : quota.quotaStatus === 'LOW'
                    ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                    : 'bg-rose-50 text-rose-700 border-rose-200 animate-bounce'
                }`}
              >
                {quota.quotaStatus === 'SAFE' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {quota.quotaStatus === 'LOW' && <AlertTriangle className="w-3.5 h-3.5" />}
                {quota.quotaStatus === 'EMPTY' && <X className="w-3.5 h-3.5" />}
                <span>
                  {quota.quotaStatus === 'SAFE'
                    ? 'Saldo Kuota Prima'
                    : quota.quotaStatus === 'LOW'
                    ? 'Kuota Menipis'
                    : 'Kuota Habis'}
                </span>
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-5 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Terpakai: {Number(quota.usedOrders).toLocaleString('id-ID')} order ({quota.percentUsed}%)</span>
                <span>Total Kuota Terbit: {Number(quota.totalQuota).toLocaleString('id-ID')} order</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    quota.quotaStatus === 'SAFE'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      : quota.quotaStatus === 'LOW'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                      : 'bg-rose-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(3, quota.percentUsed))}%` }}
                />
              </div>
            </div>

            {/* Model Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Masa Berlaku</span>
                </div>
                <p className="text-xs font-black text-slate-900 mt-1">Tanpa Batas Hangus</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Sisa saldo aman dibawa ke bulan berikutnya</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Efisiensi Biaya</span>
                </div>
                <p className="text-xs font-black text-slate-900 mt-1">Rp {tokenPrice} / Transaksi</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Termasuk sinkronisasi cloud real-time</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Fitur Terbuka</span>
                </div>
                <p className="text-xs font-black text-slate-900 mt-1">Full Backoffice &amp; POS</p>
                <p className="text-[10px] text-slate-400 mt-0.5">QR Menu Meja, Resep BOM &amp; Multi-Outlet</p>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>1 token terpotong otomatis setiap transaksi kasir atau pesanan QR berhasil diselesaikan.</span>
            </span>
            <button
              onClick={() => setIsTopUpModalOpen(true)}
              className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 shrink-0"
            >
              <span>Isi Ulang</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Store & Subscription Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Profil Lisensi Merchant
            </span>
            <div className="p-4 bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl shadow-md mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-300">
                  Paket Langganan
                </span>
                <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[10px] font-extrabold rounded-full">
                  Verified Active
                </span>
              </div>
              <h3 className="text-lg font-black tracking-tight">{currentPlan.planName}</h3>
              <p className="text-xs text-slate-300 mt-0.5">{tenant.businessName}</p>
              <div className="mt-4 pt-3 border-t border-blue-900/60 flex items-center justify-between text-[11px] text-slate-300">
                <span>Pemilik: {tenant.ownerName || user.name}</span>
                <span className="font-mono text-blue-300">{user.role}</span>
              </div>
            </div>

            {/* Outlet Consumption Breakdown (Hanya Gerai Kasir Penjualan, Gudang Dikecualikan) */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Penggunaan Token per Gerai
              </span>
              {(() => {
                const storeOutlets = (quota.outletUsage || []).filter(
                  (out: any) =>
                    !out.isWarehouse &&
                    out.type !== 'WAREHOUSE' &&
                    !out.outletName?.toLowerCase().includes('gudang') &&
                    !out.outletName?.toLowerCase().includes('warehouse')
                );
                return storeOutlets.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {storeOutlets.map((out: any) => (
                      <div
                        key={out.outletId}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-800 truncate">{out.outletName}</span>
                        </div>
                        <span className="font-black text-slate-900">
                          {Number(out.ordersCount).toLocaleString('id-ID')} order
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                    Belum ada transaksi gerai
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsTopUpModalOpen(true)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Beli Token Pesanan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Invoice & Billing History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-600" />
              <span>Riwayat Faktur Digital SaaS</span>
            </h2>
            <p className="text-xs text-slate-400">
              Daftar bukti pembayaran resmi, aktivasi paket, dan penambahan kuota token toko.
            </p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
            <p>Belum ada riwayat faktur tagihan.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Nomor Faktur</th>
                    <th className="py-3 px-3">Tanggal</th>
                    <th className="py-3 px-3">Item Layanan / Kuota</th>
                    <th className="py-3 px-3 text-right">Nominal</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {paginatedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-blue-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(inv.paidAt || inv.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{inv.notes || inv.planName}</div>
                        {inv.tokenAmount > 0 && (
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            +{Number(inv.tokenAmount).toLocaleString('id-ID')} Token Order
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        {formatRupiah(Number(inv.amount))}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {inv.status === 'PAID' ? '✔ LUNAS' : '⏳ MENUNGGU'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setSelectedInvoiceModal(inv)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Lihat Faktur
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (Ergonomis Layar 6,8" Portrait) */}
            <div className="block md:hidden space-y-3">
              {paginatedInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-blue-900">
                      {inv.invoiceNumber}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                        inv.status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {inv.status === 'PAID' ? '✔ LUNAS' : '⏳ MENUNGGU'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{inv.notes || inv.planName}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(inv.paidAt || inv.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                    {inv.tokenAmount > 0 && (
                      <span className="shrink-0 text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                        +{Number(inv.tokenAmount).toLocaleString('id-ID')} Token
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Tagihan</span>
                      <span className="font-black text-sm text-slate-900">{formatRupiah(Number(inv.amount))}</span>
                    </div>
                    <button
                      onClick={() => setSelectedInvoiceModal(inv)}
                      className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Lihat Faktur</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!loading && invoices.length > 0 && (
              <TablePagination
                currentPage={safeInvoicePage}
                pageSize={pageSize}
                totalItems={invoices.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="faktur"
              />
            )}
          </>
        )}
      </div>

      {/* =========================================================================
          MODAL TOP-UP KUOTA TOKEN MANDIRI BAGI PEMILIK TOKO
          ========================================================================= */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full text-slate-900 animate-scaleUp max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black shadow-xs">
                  <Zap className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-blue-950">
                    Isi Ulang Saldo Token Pesanan
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Model Pay-As-You-Go tanpa batas waktu hangus bulanan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTopUpModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
              {/* Paket Pilihan */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Pilih Jumlah Kuota Token:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {presetPackages.map((item, idx) => {
                    const price = (typeof item.price === 'number' && item.price > 0) ? item.price : item.tokens * tokenPrice;
                    const isSelected = !isCustomMode && topUpPreset === item.tokens;
                    const packageName = item.name || item.label || `Paket ${item.tokens.toLocaleString('id-ID')} Token`;
                    const badgeText = item.badge || (item.isPopular ? 'Populer' : null);
                    return (
                      <button
                        key={item.id || `${item.tokens}-${idx}`}
                        type="button"
                        onClick={() => {
                          setIsCustomMode(false);
                          setTopUpPreset(item.tokens);
                        }}
                        className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-blue-700 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {badgeText && (
                          <span className={`absolute -top-2 right-2 px-1.5 py-0.5 rounded-full text-white text-[8px] font-black uppercase tracking-wider shadow-xs ${
                            item.isPopular ? 'bg-blue-900' : 'bg-slate-700'
                          }`}>
                            {badgeText}
                          </span>
                        )}
                        <span className="text-[10px] font-black text-blue-900 block uppercase truncate pr-6" title={packageName}>
                          {packageName}
                        </span>
                        <span className="text-sm font-black text-slate-900 block mt-0.5">
                          +{item.tokens.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 block mt-0.5">
                          {formatRupiah(price)}
                        </span>
                        {item.description && (
                          <span className="text-[9px] text-slate-400 block mt-1 truncate" title={item.description}>
                            {item.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Opsi Kustom Kuota */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className="text-xs font-bold text-blue-900 hover:text-blue-950 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isCustomMode ? 'Gunakan Paket Pilihan Di Atas' : '+ Butuh kuota kustom lainnya?'}</span>
                  </button>
                  {isCustomMode && (
                    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-slate-600">Jumlah Token Kustom:</label>
                        <span className="text-[10px] text-slate-500">Min. {minTokenPurchase.toLocaleString('id-ID')} token</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={minTokenPurchase}
                          step="50"
                          value={customTokenAmount}
                          onChange={(e) => setCustomTokenAmount(Math.max(minTokenPurchase, Number(e.target.value)))}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white text-slate-900"
                        />
                        <span className="text-xs font-black text-slate-700">Token</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Input Kupon Promo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-blue-700" />
                  <span>Punya Kupon Diskon B2B?</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Contoh: HEMAT20 atau LAUNCHWELL"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase bg-white text-slate-900 placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-blue-700"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    Terapkan
                  </button>
                </div>
                {appliedPromo && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                    <span className="font-bold">
                      Kupon &quot;{appliedPromo.code}&quot; aktif: {appliedPromo.name || 'Diskon diterapkan'}
                    </span>
                    <button
                      onClick={() => {
                        setAppliedPromo(null);
                        setPromoCodeInput('');
                      }}
                      className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}
                {promoError && (
                  <p className="text-[11px] text-rose-600 font-semibold">{promoError}</p>
                )}
              </div>

              {/* Metode Pembayaran: HANYA QRIS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">Metode Pembayaran:</label>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Hanya QRIS (Otomatis)
                  </span>
                </div>

                {!qrisEnabled ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-amber-900">
                      <span>⚠️</span>
                      <span>Pembayaran QRIS Sedang Dalam Pemeliharaan</span>
                    </p>
                    <p className="text-[11px] text-amber-700">
                      Metode pembayaran QRIS sedang dinonaktifkan sementara oleh platform HQ. Silakan hubungi admin platform.
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-blue-900 text-white text-[10px] font-black tracking-wider uppercase">
                          QRIS RESMI
                        </span>
                        <span className="text-xs font-black text-blue-950">
                          {platformPaymentConfig?.qris?.merchantName || 'WELL POS PLATFORM HQ'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        NMID: {platformPaymentConfig?.qris?.nmid || 'ID1020030040050'}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3.5">
                      {/* QR Code Container */}
                      <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-xs shrink-0 flex flex-col items-center">
                        <img
                          src={platformPaymentConfig?.qris?.imageUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=00020101021126600016ID.CO.QRIS.WWW011893600002010200300400500215ID10200300400500303UME51440014ID.CO.QRIS.WWW0215ID10200300400500303UME5204581253033605802ID5919WELL+POS+PLATFORM+HQ6007JAKARTA61051219062070703A016304E85C'}
                          alt="QRIS Statis Well POS Platform HQ"
                          className="w-24 h-24 object-contain"
                        />
                        <span className="text-[9px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">
                          Scan QRIS
                        </span>
                      </div>

                      {/* Instructions */}
                      <div className="space-y-1.5 text-xs flex-1">
                        <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-950 text-[11px] leading-relaxed">
                          <p className="font-bold mb-0.5 text-blue-950">Panduan Pembayaran QRIS:</p>
                          <p className="text-slate-600">
                            {platformPaymentConfig?.qris?.notes || 'Buka aplikasi e-Wallet (GoPay, OVO, Dana, ShopeePay) atau m-Banking (BCA, Livin Mandiri, BRImo, BNI) lalu scan QRIS di samping.'}
                          </p>
                        </div>
                        <div className="flex justify-between items-center text-[11px] pt-1 text-slate-600">
                          <span>Nominal Pas:</span>
                          <span className="font-mono font-black text-blue-900 text-sm">{formatRupiah(finalCost)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Rincian Total */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Kuota Tambahan:</span>
                  <span className="font-bold text-slate-800">
                    +{totalTokensReceived.toLocaleString('id-ID')} Token
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal (Rp {tokenPrice} / token):</span>
                  <span>{formatRupiah(baseCost)}</span>
                </div>
                {discountCost > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Potongan Promo:</span>
                    <span>- {formatRupiah(discountCost)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
                  <span>Total Tagihan:</span>
                  <span className="text-blue-900 text-base">{formatRupiah(finalCost)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer Action (Fixed & Never Cut Off) */}
            <div className="p-4 border-t border-slate-100 shrink-0 bg-slate-50/80 rounded-b-3xl flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsTopUpModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteTopUp}
                disabled={isSubmittingTopUp || !qrisEnabled}
                className="flex-2 py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap text-center"
              >
                {isSubmittingTopUp ? 'Memproses...' : !qrisEnabled ? 'QRIS Dinonaktifkan' : 'Beli Kuota Sekarang'}
              </button>
            </div>
        </div>
      </div>
    )}

      {/* =========================================================================
          MODAL FAKTUR DIGITAL RESMI (OFFICIAL TAX INVOICE WITH NITKU) - CLEAN WHITE-BLUE
          ========================================================================= */}
      {selectedInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 max-w-xl w-full shadow-2xl relative text-slate-800 animate-scaleUp max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <button
              type="button"
              onClick={() => setSelectedInvoiceModal(null)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scrollable Invoice Content */}
            <div className="overflow-y-auto overscroll-contain flex-1 pr-1 space-y-4">
              {/* Invoice Top Header */}
              <div className="border-b border-slate-200 pb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-900 flex items-center justify-center font-black text-white text-xs">
                      W
                    </div>
                    <span className="font-black text-base text-slate-900 tracking-tight">Well POS Platform</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Cloud POS &amp; Inventory Operating System</p>
                  <p className="text-[10px] text-slate-500 font-mono font-semibold tracking-wider">
                    NITKU: 3313122505910002000000 &bull; Indonesia
                  </p>
                </div>

                <div className="text-right pr-7 sm:pr-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Official Tax Invoice</span>
                  <span className="font-mono font-black text-xs sm:text-sm text-blue-900">{selectedInvoiceModal.invoiceNumber}</span>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                      selectedInvoiceModal.status === 'PAID'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {selectedInvoiceModal.status === 'PAID' ? '✔ PAID' : '⏳ PENDING'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Client & Date Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Ditagihkan Kepada:</span>
                  <p className="font-bold text-slate-900 text-sm">
                    {selectedInvoiceModal.tenant?.name || selectedInvoiceModal.tenant?.businessName || selectedInvoiceModal.tenantName || tenant.businessName}
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Pemilik: {selectedInvoiceModal.tenant?.owner?.name || tenant.ownerName || user.name}
                  </p>
                  <p className="text-slate-600 truncate">
                    {selectedInvoiceModal.tenant?.owner?.email || tenant.ownerEmail || user.email}
                  </p>
                </div>

                <div className="sm:text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Detail Penerbitan:</span>
                  <p className="text-slate-600">
                    Tanggal:{' '}
                    <strong className="text-slate-900">
                      {new Date(selectedInvoiceModal.paidAt || selectedInvoiceModal.createdAt || Date.now()).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </strong>
                  </p>
                  <p className="text-slate-600 mt-0.5">Metode: {selectedInvoiceModal.paymentMethod || 'Transfer Manual'}</p>
                  {selectedInvoiceModal.paidAt && (
                    <p className="text-emerald-700 text-[11px] font-semibold mt-0.5">
                      Dibayar: {new Date(selectedInvoiceModal.paidAt).toLocaleDateString('id-ID')}
                    </p>
                  )}
                </div>
              </div>

              {/* Line Item Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs text-slate-700">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] text-slate-600 uppercase font-black tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">Deskripsi Layanan / Item</th>
                      <th className="py-2.5 px-3 text-center">Token</th>
                      <th className="py-2.5 px-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium bg-white">
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{selectedInvoiceModal.notes || 'Top-Up Kuota Token Pesanan Kasir'}</span>
                        <span className="text-[10px] text-slate-500">Model Pay-As-You-Go &bull; Tanpa Batas Waktu Hangus</span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-blue-900">
                        {selectedInvoiceModal.tokenAmount > 0 ? `+${Number(selectedInvoiceModal.tokenAmount).toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        {formatRupiah(Number(selectedInvoiceModal.amount) + Number(selectedInvoiceModal.discountAmount || 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary Breakdown */}
              <div className="space-y-1.5 text-xs border-b border-slate-200 pb-3">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Layanan:</span>
                  <span className="text-slate-800 font-semibold">
                    {formatRupiah(Number(selectedInvoiceModal.amount) + Number(selectedInvoiceModal.discountAmount || 0))}
                  </span>
                </div>
                {selectedInvoiceModal.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Diskon Kupon Promo ({selectedInvoiceModal.promoCode || 'PROMO'}):</span>
                    <span className="font-bold">- {formatRupiah(Number(selectedInvoiceModal.discountAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-black text-base pt-2 border-t border-slate-200">
                  <span>Total Tagihan:</span>
                  <span className="text-blue-900">{formatRupiah(Number(selectedInvoiceModal.amount))}</span>
                </div>
              </div>

              {/* Digital Stamp & Footer Notes */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-[11px] text-slate-600">
                <div>
                  <p className="font-bold text-blue-950">Electronic Receipt &amp; Tax Verification</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Secured by Well POS Platform HQ.</p>
                </div>
                <div className="text-right">
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-black tracking-wider uppercase text-[9px]">
                    [VERIFIED]
                  </span>
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="pt-3.5 border-t border-slate-100 shrink-0 flex items-center gap-3 bg-white">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoiceModal(null)}
                className="py-2.5 px-6 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Direct QRIS Pakasir untuk Top-Up Kuota Token */}
      <PakasirDirectQrisModal
        isOpen={isQrisModalOpen}
        onClose={() => {
          setIsQrisModalOpen(false);
          fetchSubscriptionAndInvoices();
        }}
        title="Top-Up Kuota Token Transaksi"
        subtitle="Pindai QRIS dinamis di bawah untuk menyelesaikan pembayaran top-up kuota token pesanan toko Anda."
        invoiceNumber={qrisModalData?.invoiceNumber || ''}
        amount={qrisModalData?.amount || 0}
        tokenAmount={qrisModalData?.tokenAmount || 0}
        qrString={qrisModalData?.qrString || ''}
        successButtonText="Selesai & Cek Kuota Baru"
        onSuccess={() => {
          fetchSubscriptionAndInvoices();
        }}
        onSuccessButtonClick={() => {
          setIsQrisModalOpen(false);
          fetchSubscriptionAndInvoices();
        }}
      />
    </div>
  );
};
