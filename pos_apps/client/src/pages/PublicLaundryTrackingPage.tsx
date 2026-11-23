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
                className="w-full pl-10 pr-3 py-2.5 text-xs font-bold rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-900 focus:outline-none transition-all shadow-2xs font-mono uppercase"
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs font-black text-blue-900 block">
                    {data.invoiceNumber}
                  </span>
                  <h2 className="text-base font-black text-slate-900">{data.customerName}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Toko: <strong>{data.outlet?.name || data.tenantName}</strong>
                  </p>
                </div>

                {/* Macro Status Badge */}
                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-black tracking-wide border ${
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
                    <div className="font-mono text-[11px] font-black text-purple-900 mt-1">
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
