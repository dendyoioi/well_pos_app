import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Scale,
  MapPin,
  Phone,
  AlertTriangle,
  Check,
  Search,
  Camera,
  Truck,
  ShieldCheck,
  Star,
  ExternalLink,
  Send,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { api } from '../services/api';

interface PublicLaundryTrackingPageProps {
  initialInvoiceNumber?: string;
}

export const PublicLaundryTrackingPage: React.FC<PublicLaundryTrackingPageProps> = ({
  initialInvoiceNumber = '',
}) => {
  const [invoiceInput, setInvoiceInput] = useState(initialInvoiceNumber);
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State Rating & Komplain (Fase A Retensi)
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedbackCategory, setFeedbackCategory] = useState<string>('CUCIAN_KURANG_BERSIH');
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackPhotoUrl, setFeedbackPhotoUrl] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState<string | null>(null);
  const [googleReviewClicked, setGoogleReviewClicked] = useState<boolean>(false);

  // Auto-detect invoice from URL (?track=INV-XXX or path)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const trackParam = params.get('track') || params.get('invoice');
      if (trackParam) {
        setInvoiceInput(trackParam);
        setInvoiceNumber(trackParam);
      }
    }
  }, []);

  const fetchTracking = async (inv: string) => {
    if (!inv.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPublicLaundryTracking(inv.trim());
      if (res.status === 'success' && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Nota pesanan laundry tidak ditemukan. Pastikan nomor nota benar.');
        setData(null);
      }
    } catch {
      setError('Gagal menghubungkan ke server pelacakan. Coba beberapa saat lagi.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceNumber) {
      fetchTracking(invoiceNumber);
    }
  }, [invoiceNumber]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invoiceInput.trim()) {
      setInvoiceNumber(invoiceInput.trim());
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.invoiceNumber || selectedRating === 0) return;
    try {
      setSubmittingFeedback(true);
      const isComplaint = selectedRating <= 3;
      const res = await api.submitPublicLaundryFeedback(data.invoiceNumber, {
        rating: selectedRating,
        category: isComplaint ? feedbackCategory : undefined,
        comment: feedbackComment.trim() || undefined,
        photoUrl: isComplaint && feedbackPhotoUrl.trim() ? feedbackPhotoUrl.trim() : undefined,
      });

      if (res.status === 'success') {
        setFeedbackSuccessMsg(
          isComplaint
            ? 'Komplain Anda berhasil dicatat. Tim supervisor kami akan segera menindaklanjuti.'
            : 'Terima kasih atas penilaian positif Anda!'
        );
        fetchTracking(data.invoiceNumber);
      } else {
        alert(res.message || 'Gagal mengirim ulasan');
      }
    } catch {
      alert('Terjadi kesalahan saat mengirim ulasan');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleOpenGoogleReview = async () => {
    if (!data?.googleReviewUrl || !data?.invoiceNumber) return;
    setGoogleReviewClicked(true);
    try {
      await api.trackGoogleReviewClick(data.invoiceNumber);
    } catch {
      // ignore
    }
    window.open(data.googleReviewUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black shadow-md shadow-blue-900/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-sm tracking-tight">Well POS Laundry Tracking</h1>
              <p className="text-[10px] text-slate-400 font-semibold">Pelacakan Transparan Cucian Anda</p>
            </div>
          </div>

          {data?.outlet?.phone && (
            <a
              href={`https://wa.me/${data.outlet.phone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-xs hover:bg-emerald-100 transition-colors shadow-2xs"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Hubungi Toko</span>
            </a>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl w-full mx-auto px-4 py-6 flex-1 space-y-5">
        {/* Search Bar Form */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Masukkan Nomor Nota (cth: INV-20261120-001)..."
                value={invoiceInput}
                onChange={(e) => setInvoiceInput(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 text-[13px] sm:text-sm font-bold rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-900 focus:outline-none transition-all shadow-2xs font-mono uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-2xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <span>{loading ? 'Mencari...' : 'Lacak'}</span>
            </button>
          </form>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
            <div className="inline-block w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="font-bold text-xs">Memuat status pengerjaan...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center space-y-2 text-xs">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="font-black text-rose-900 text-sm">Nota Tidak Ditemukan</h3>
            <p className="text-rose-700">{error}</p>
          </div>
        )}

        {/* Tracking Details View */}
        {data && !loading && (
          <div className="space-y-4 animate-fadeIn">
            {/* Status Hero Card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-black text-blue-900 block">
                    {data.invoiceNumber}
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">{data.customerName}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Toko: <strong>{data.outlet?.name || data.tenantName}</strong>
                  </p>
                </div>

                {/* Macro Status Badge */}
                <div className="self-start sm:text-right shrink-0">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-black tracking-wide border whitespace-nowrap shrink-0 ${
                      data.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : data.status === 'READY_FOR_PICKUP'
                        ? 'bg-purple-50 text-purple-900 border-purple-200'
                        : 'bg-blue-50 text-blue-900 border-blue-200'
                    }`}
                  >
                    {data.status === 'COMPLETED'
                      ? '✓ SELESAI DIAMBIL'
                      : data.status === 'READY_FOR_PICKUP'
                      ? '✨ SIAP DIAMBIL'
                      : data.status === 'IRONING_PACKING'
                      ? '🔥 SEDANG DISETRIKA'
                      : data.status === 'WASHING_DRYING'
                      ? '🌊 SEDANG DICUCI'
                      : '🧺 DITERIMA DI KASIR'}
                  </span>
                  {data.rackCode && data.status === 'READY_FOR_PICKUP' && (
                    <div className="font-mono text-[11px] font-black text-purple-900 mt-1 sm:text-right">
                      Lokasi Rak: {data.rackCode}
                    </div>
                  )}
                </div>
              </div>

              {/* Rincian Berat & Waktu */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-900 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Berat / Qty</span>
                    <span className="font-mono font-black text-slate-900">
                      {data.totalWeightKg ? `${data.totalWeightKg} Kg` : '-'}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-900 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Total Helai</span>
                    <span className="font-mono font-black text-slate-900">
                      {data.totalPieces || 0} Pcs
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2 col-span-2 sm:col-span-1">
                  <Clock className="w-4 h-4 text-blue-900 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Estimasi Selesai</span>
                    <span className="font-bold text-slate-900 text-[11px]">
                      {data.estimatedReadyAt
                        ? new Date(data.estimatedReadyAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Banner Akses Portal Pelanggan */}
            {(data.outlet?.id || (data as any).outletId) && (
              <a
                href={`/#portal?outletId=${data.outlet?.id || (data as any).outletId}`}
                className="block bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 rounded-2xl shadow-sm hover:from-blue-800 hover:to-indigo-800 transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs sm:text-sm text-white">
                        Cek Saldo &amp; Minta Jemput di Portal Pelanggan
                      </p>
                      <p className="text-[11px] text-blue-200">
                        Lihat sisa kuota kiloan, saldo deposit, atau minta kurir jemput pakaian ke rumah
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-blue-200 group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
              </a>
            )}

            {/* Multi-Layanan / Rincian Layanan Cucian */}
            {Array.isArray(data.items) && data.items.length > 0 && (
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-900" />
                    <span>Layanan Cucian ({data.itemsCount || data.items.length} Item)</span>
                  </h3>
                  {data.perfumeVariant && (
                    <span className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Aroma: {data.perfumeVariant}
                    </span>
                  )}
                </div>

                <div className="divide-y divide-slate-100">
                  {data.items.map((it: any, idx: number) => (
                    <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900">{it.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span>
                            {it.quantity} {it.unit || 'Kg'}
                          </span>
                          {it.perfumeVariant && it.perfumeVariant !== data.perfumeVariant && (
                            <span className="text-blue-700 font-semibold">• Aroma: {it.perfumeVariant}</span>
                          )}
                          {it.pricingBasis && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              {it.pricingBasis}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-slate-800 shrink-0 text-right">
                        Rp {Number(it.totalPrice ?? it.subtotal ?? (it.unitPrice * it.quantity)).toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery Status Card */}
            {data.deliveryType && data.deliveryType !== 'NONE' && (
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-900" />
                    <span>Layanan Antar-Jemput (Delivery)</span>
                  </h3>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                      data.deliveryStatus === 'DELIVERED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : data.deliveryStatus === 'OUT_FOR_DELIVERY'
                        ? 'bg-indigo-100 text-indigo-900 animate-pulse'
                        : 'bg-blue-100 text-blue-900'
                    }`}
                  >
                    {data.deliveryStatus === 'PENDING_PICKUP'
                      ? 'Menunggu Penjemputan'
                      : data.deliveryStatus === 'PICKED_UP'
                      ? 'Sudah Dijemput Kurir'
                      : data.deliveryStatus === 'READY_TO_DELIVER'
                      ? 'Siap Diantar'
                      : data.deliveryStatus === 'OUT_FOR_DELIVERY'
                      ? '🛵 Kurir Menuju Alamat Anda'
                      : data.deliveryStatus === 'DELIVERED'
                      ? '✓ Selesai Diantar'
                      : 'Dalam Proses'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Alamat Tujuan</span>
                      <p className="font-semibold text-slate-800">{data.deliveryAddress || '-'}</p>
                    </div>
                  </div>

                  {data.courierName && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                      <span className="text-slate-500">Kurir Bertugas:</span>
                      <span className="font-black text-slate-900">{data.courierName}</span>
                    </div>
                  )}

                  {data.deliveryFee > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Biaya Delivery:</span>
                      <span className="font-bold text-blue-900">
                        Rp {Number(data.deliveryFee).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stepper Timeline Pengerjaan */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-900" />
                <span>Tahapan Alur Pengerjaan Cucian</span>
              </h3>

              <div className="space-y-2">
                {Array.isArray(data.stages) &&
                  data.stages.map((stage: any, idx: number) => {
                    const isDone = data.stageLogs?.some((l: any) => l.stage === stage.key);
                    const isCurrent = data.currentStage === stage.key;

                    return (
                      <div
                        key={stage.key}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                          isCurrent
                            ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-300 shadow-2xs'
                            : isDone
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-slate-50/50 border-slate-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                              isDone
                                ? 'bg-emerald-600 text-white'
                                : isCurrent
                                ? 'bg-blue-900 text-white animate-pulse'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-slate-900">
                              {stage.name}
                            </div>
                            <div className="text-[10px] text-slate-500">{stage.description}</div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-800'
                              : isCurrent
                              ? 'bg-blue-100 text-blue-900 font-extrabold'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isDone ? 'Selesai' : isCurrent ? 'Sedang Dikerjakan' : 'Menunggu'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Hasil Sortir Helai Pakaian */}
            {data.isSorted && Array.isArray(data.garmentCounts) && data.garmentCounts.length > 0 && (
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Rincian Helai Pakaian (Hasil Sortir)</span>
                  </h3>
                  <span className="font-mono text-xs font-black text-slate-700">
                    Total: {data.totalPieces} Pcs
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {data.garmentCounts.map((gc: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-700">{gc.type}</span>
                      <span className="font-mono font-black text-blue-900">{gc.qty} pcs</span>
                    </div>
                  ))}
                </div>

                {/* Catatan Kendala QC jika ada */}
                {(data.defects?.length > 0 || data.defectNotes) && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-1 text-xs">
                    <div className="font-black text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Catatan Khusus / Kendala Fisik Pakaian:</span>
                    </div>
                    {data.defectNotes && (
                      <p className="text-[11px] text-amber-950 font-medium italic">
                        "{data.defectNotes}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bukti Foto Kondisi Pakaian Anti-Komplain */}
            {Array.isArray(data.conditionPhotos) && data.conditionPhotos.length > 0 && (
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-blue-900" />
                    <span>Bukti Foto Kondisi Pakaian (Anti-Komplain)</span>
                  </h3>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {data.conditionPhotos.length} Foto
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Foto dokumentasi kondisi fisik pakaian yang diambil staf saat penyortiran awal
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {data.conditionPhotos.map((photo: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col shadow-2xs group"
                    >
                      <a
                        href={photo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-square w-full bg-slate-200 overflow-hidden block"
                        title="Klik untuk memperbesar foto"
                      >
                        <img
                          src={photo.url}
                          alt={photo.caption || `Kondisi pakaian ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      </a>
                      {photo.caption && (
                        <div className="p-2 bg-white border-t border-slate-100 text-[10px] font-medium text-slate-700 truncate">
                          {photo.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback, Rating & Google Review Card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Kepuasan Pelanggan &amp; Ulasan Layanan</span>
                </h3>
                {data.hasFeedback && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    data.feedback?.status === 'RESOLVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : data.feedback?.status === 'IN_REVIEW'
                      ? 'bg-indigo-100 text-indigo-900'
                      : data.feedback?.isComplaint
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {data.feedback?.isComplaint
                      ? data.feedback?.status === 'RESOLVED'
                        ? '✓ Komplain Selesai Ditangani'
                        : data.feedback?.status === 'IN_REVIEW'
                        ? 'Sedang Ditinjau Tim'
                        : 'Komplain Tercatat'
                      : '✓ Ulasan Diterima'}
                  </span>
                )}
              </div>

              {/* JIKA SUDAH ADA FEEDBACK */}
              {data.hasFeedback ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700">Penilaian Anda:</span>
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= (data.feedbackRating || data.feedback?.rating || 0)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {data.feedback?.comment && (
                    <p className="text-[11.5px] text-slate-700 italic bg-white p-3 rounded-xl border border-slate-200">
                      "{data.feedback.comment}"
                    </p>
                  )}

                  {data.feedback?.resolutionNotes && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-[11px] space-y-1">
                      <div className="font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tanggapan / Solusi Toko:</span>
                      </div>
                      <p>{data.feedback.resolutionNotes}</p>
                    </div>
                  )}

                  {/* Jika Rating 4/5 dan ada Google Review URL */}
                  {(data.feedbackRating >= 4 || data.feedback?.rating >= 4) && data.googleReviewUrl && (
                    <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="text-[11px] text-slate-600">
                        Bantu toko kami semakin berkembang dengan memberi bintang 5 di Google Maps:
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenGoogleReview}
                        className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0 transition-transform active:scale-95"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{googleReviewClicked ? 'Buka Kembali Google Review' : 'Beri Bintang 5 di Google'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* FORM RATING BARU */
                <form onSubmit={handleSubmitFeedback} className="space-y-3">
                  <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 text-center space-y-2">
                    <p className="font-extrabold text-slate-900 text-xs">
                      Bagaimana kualitas hasil cucian dan pelayanan kami?
                    </p>
                    <div className="flex items-center justify-center gap-2 py-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setSelectedRating(star)}
                          className="p-1 hover:scale-125 transition-transform cursor-pointer focus:outline-none"
                        >
                          <Star
                            className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                              (hoverRating || selectedRating) >= star
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      {selectedRating === 5
                        ? '⭐⭐⭐⭐⭐ Sangat Puas & Bersih!'
                        : selectedRating === 4
                        ? '⭐⭐⭐⭐ Puas & Rapi'
                        : selectedRating === 3
                        ? '⭐⭐⭐ Cukup / Ada Catatan'
                        : selectedRating === 2
                        ? '⭐⭐ Kurang Puas'
                        : selectedRating === 1
                        ? '⭐ Sangat Kecewa / Ada Kendala'
                        : 'Pilih bintang 1 s/d 5'}
                    </span>
                  </div>

                  {feedbackSuccessMsg && (
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{feedbackSuccessMsg}</span>
                    </div>
                  )}

                  {/* JIKA BINTANG 4 ATAU 5: PUAS -> TESTIMONI & REDIRECT GOOGLE REVIEW */}
                  {selectedRating >= 4 && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 animate-fadeIn">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Komentar atau kesan Anda (opsional):
                      </label>
                      <textarea
                        rows={2}
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="Contoh: Wanginya enak, lipatan rapi, kasir sangat ramah..."
                        className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-900"
                      />

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={submittingFeedback}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{submittingFeedback ? 'Mengirim...' : 'Kirim Ulasan'}</span>
                        </button>

                        {data.googleReviewUrl && (
                          <button
                            type="button"
                            onClick={handleOpenGoogleReview}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white border border-blue-200 text-blue-900 hover:bg-blue-50 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-blue-700" />
                            <span>Beri Bintang 5 di Google Maps</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* JIKA BINTANG 1, 2, ATAU 3: INTERNAL KOMPLAIN KE SUPERVISOR */}
                  {selectedRating >= 1 && selectedRating <= 3 && (
                    <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3 animate-fadeIn">
                      <div className="flex items-center gap-1.5 text-rose-900 font-extrabold text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Sampaikan kendala cucian Anda agar kami segera tangani:</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Kategori Kendala:
                        </label>
                        <div className="relative">
                          <select
                            value={feedbackCategory}
                            onChange={(e) => setFeedbackCategory(e.target.value)}
                            className="w-full p-2.5 appearance-none pr-10 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-rose-700 font-semibold"
                          >
                            <option value="CUCIAN_KURANG_BERSIH">Cucian Kurang Bersih / Noda Masih Ada</option>
                            <option value="AROMA_TIDAK_WANGI">Aroma Kurang Wangi / Tidak Sesuai Pilihan</option>
                            <option value="PAKAIAN_RUSAK_HILANG">Pakaian Tertukar / Rusak / Hilang</option>
                            <option value="KETERLAMBATAN">Pengerjaan Terlambat dari Estimasi</option>
                            <option value="PELAYANAN_STAF">Pelayanan Kasir / Staf Kurang Ramah</option>
                            <option value="LAINNYA">Lainnya</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Ceritakan detail kendala yang dialami:
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          placeholder="Jelaskan pakaian mana yang bermasalah agar supervisor segera cek CCTV & log mesin..."
                          className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-rose-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Tautan Foto Kendala Pakaian (Opsional):
                        </label>
                        <input
                          type="url"
                          value={feedbackPhotoUrl}
                          onChange={(e) => setFeedbackPhotoUrl(e.target.value)}
                          placeholder="Contoh: https://..."
                          className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-rose-700 font-mono"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingFeedback || !feedbackComment.trim()}
                        className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{submittingFeedback ? 'Mengirim Komplain...' : 'Kirim Komplain ke Supervisor Toko'}</span>
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Info Pembayaran & Kontak Toko */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-600">Status Pembayaran:</span>
                <span
                  className={`font-black px-2.5 py-0.5 rounded-full text-[11px] ${
                    data.paymentStatus === 'PAID'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {data.paymentStatus === 'PAID' ? '✓ LUNAS' : 'BELUM LUNAS / BAYAR SAAT AMBIL'}
                </span>
              </div>

              {data.outlet?.address && (
                <div className="flex items-start gap-2 text-slate-600 text-[11px]">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{data.outlet.address}</span>
                </div>
              )}
            </div>

            {/* Kebijakan Garansi & Syarat Layanan */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2.5 text-xs">
              <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-900" />
                <span>Ketentuan Layanan &amp; Klausa Garansi</span>
              </h3>
              {data.laundryTerms ? (
                <div className="text-[11.5px] text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  {data.laundryTerms}
                </div>
              ) : (
                <ol className="list-decimal pl-4 space-y-1 text-[11.5px] text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <li>Pengambilan cucian wajib membawa struk / bukti WhatsApp resmi.</li>
                  <li>Komplain maksimal 1x24 jam setelah cucian diambil dengan membawa nota dan pakaian belum dicuci ulang.</li>
                  <li>Pakaian yang tidak diambil dalam tempo 30 hari di luar tanggung jawab pihak laundry.</li>
                  <li>Ganti rugi maksimal 5x biaya cuci untuk pakaian rusak/hilang sesuai investigasi tim laundry.</li>
                </ol>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[10px] text-slate-400 border-t border-slate-200 bg-white">
        Powered by Well POS Laundry Platform &bull; Aman &amp; Terpercaya
      </footer>
    </div>
  );
};
