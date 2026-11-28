import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Landmark,
  Loader2,
  Lock,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  Store,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { api } from '../services/api';
import { WhatsAppInput } from '../components/ui/WhatsAppInput';
import { buildWhatsAppUrl } from '../utils/phone';
import type { LaundryIncidentType, PublicOrderComplaintData } from '../types/laundry';

interface PublicOrderComplaintPageProps {
  invoiceNumber: string;
}

const INCIDENT_TYPE_OPTIONS: Array<{ value: LaundryIncidentType; label: string; hint: string }> = [
  {
    value: 'STAIN_REMAINING',
    label: 'Noda Masih Tertinggal / Kurang Bersih',
    hint: 'Masih ada noda, bau apek, atau hasil setrika kurang rapi',
  },
  {
    value: 'DAMAGED',
    label: 'Pakaian Rusak / Luntur / Robek',
    hint: 'Kerusakan kain, sobek, menyusut, atau kelunturan warna',
  },
  {
    value: 'MIXED_UP',
    label: 'Pakaian Tertukar dengan Pelanggan Lain',
    hint: 'Ada pakaian asing di dalam paket atau pakaian Anda tertukar',
  },
  {
    value: 'LOST',
    label: 'Pakaian Hilang / Jumlah Kurang',
    hint: 'Ada item pakaian yang tidak ikut kembali saat serah terima',
  },
];

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  DAMAGED: 'Pakaian Rusak / Luntur',
  LOST: 'Pakaian Hilang / Kurang',
  STAIN_REMAINING: 'Noda Tertinggal / Kurang Bersih',
  MIXED_UP: 'Pakaian Tertukar',
};

const INCIDENT_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'Menunggu Peninjauan Outlet', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  INVESTIGATING: { label: 'Sedang Diinvestigasi', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  RESOLVED: { label: 'Selesai Ditangani', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  COMPENSATED: { label: 'Kompensasi Dicairkan', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
};

const LAUNDRY_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Diterima Kasir',
  WASHING_DRYING: 'Sedang Dicuci & Dikeringkan',
  IRONING_PACKING: 'Sedang Disetrika & Dikemas',
  READY_FOR_PICKUP: 'Siap Diambil / Diantar',
  COMPLETED: 'Selesai & Diserahkan',
};

function compressImageToDataUrl(file: File, maxDimension = 1280, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal menginisialisasi pemrosesan gambar'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function formatDateTimeId(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCountdown(ms: number): { hours: string; minutes: string; seconds: string } {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
  };
}

export const PublicOrderComplaintPage: React.FC<PublicOrderComplaintPageProps> = ({ invoiceNumber }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<PublicOrderComplaintData | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);

  // Form states
  const [incidentType, setIncidentType] = useState<LaundryIncidentType>('STAIN_REMAINING');
  const [itemDescription, setItemDescription] = useState('');
  const [claimantName, setClaimantName] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [includeBankInfo, setIncludeBankInfo] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedToken, setSubmittedToken] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    const loadComplaintStatus = async () => {
      if (!invoiceNumber) {
        setLoadError('Nomor nota laundry tidak ditemukan pada tautan.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const res = await api.getPublicOrderComplaint(invoiceNumber);
        if (!active) return;
        if (res.status !== 'success' || !res.data) {
          setLoadError(res.message || 'Nota laundry tidak ditemukan.');
        } else {
          setData(res.data);
          setRemainingMs(Math.max(0, Number(res.data.remainingMs || 0)));
        }
      } catch {
        if (!active) return;
        setLoadError('Tidak dapat terhubung ke server. Silakan coba beberapa saat lagi.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadComplaintStatus();
    return () => {
      active = false;
    };
  }, [invoiceNumber]);

  // Hitung mundur real-time 1x24 jam
  useEffect(() => {
    if (!data || data.windowStatus !== 'OPEN' || !data.expiresAt) return;
    const expiryTime = new Date(data.expiresAt).getTime();
    if (Number.isNaN(expiryTime)) return;

    const updateTick = () => {
      const diff = expiryTime - Date.now();
      setRemainingMs(diff > 0 ? diff : 0);
    };
    updateTick();

    const timer = window.setInterval(updateTick, 1000);
    return () => window.clearInterval(timer);
  }, [data]);

  const effectiveWindowStatus = useMemo(() => {
    if (!data) return 'NOT_COMPLETED';
    if (data.windowStatus === 'OPEN' && remainingMs <= 0) return 'EXPIRED';
    return data.windowStatus;
  }, [data, remainingMs]);

  const countdown = useMemo(() => formatCountdown(remainingMs), [remainingMs]);

  const trackingUrl = `/track/${encodeURIComponent(data?.invoiceNumber || invoiceNumber)}`;
  const activeClaimToken = submittedToken || data?.existingIncident?.customerClaimToken || null;
  const outletWhatsappUrl = buildWhatsAppUrl(
    data?.outlet?.phone,
    `Halo ${data?.outlet?.name || 'Admin Laundry'}, saya ingin menanyakan perihal nota *${data?.invoiceNumber || invoiceNumber}*.`
  );

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (photoUrls.length >= 3) {
      setPhotoError('Maksimal 3 foto bukti yang dapat dilampirkan.');
      e.target.value = '';
      return;
    }

    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const remainingSlots = 3 - photoUrls.length;
      const selectedFiles = Array.from(files).slice(0, remainingSlots);
      const uploadedUrls: string[] = [];

      for (const file of selectedFiles) {
        const compressed = await compressImageToDataUrl(file);
        const res = await api.uploadPublicOrderComplaintPhoto(
          data?.invoiceNumber || invoiceNumber,
          compressed
        );
        if (res.httpStatus === 410) {
          setRemainingMs(0);
          throw new Error(res.message || 'Masa pengajuan keluhan 1x24 jam telah berakhir.');
        }
        if (res.status !== 'success' || !res.data?.url) {
          throw new Error(res.message || 'Gagal mengunggah foto bukti');
        }
        uploadedUrls.push(res.data.url);
      }

      setPhotoUrls((prev) => [...prev, ...uploadedUrls].slice(0, 3));
    } catch (err: any) {
      setPhotoError(err?.message || 'Gagal memproses atau mengunggah foto');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (effectiveWindowStatus !== 'OPEN') {
      setSubmitError('Batas waktu pengajuan keluhan sudah tidak aktif.');
      return;
    }
    if (itemDescription.trim().length < 3) {
      setSubmitError('Mohon isi deskripsi pakaian / item yang bermasalah (minimal 3 karakter).');
      return;
    }
    if (claimantName.trim().length < 2) {
      setSubmitError('Nama lengkap pelapor wajib diisi (minimal 2 karakter).');
      return;
    }
    if (claimantPhone.replace(/\D/g, '').length < 8) {
      setSubmitError('Nomor WhatsApp wajib diisi untuk verifikasi nota (minimal 8 digit).');
      return;
    }
    if (evidenceNotes.trim().length < 10) {
      setSubmitError('Mohon jelaskan kronologi kendala minimal 10 karakter agar tim outlet cepat menangani.');
      return;
    }
    if (photoUrls.length < 1) {
      setSubmitError('Minimal 1 foto bukti kondisi cucian wajib dilampirkan.');
      return;
    }
    if (includeBankInfo) {
      if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
        setSubmitError('Jika opsi rekening dicentang, nama bank, nomor rekening, dan pemilik rekening wajib diisi.');
        return;
      }
    }
    if (!agreedToTerms) {
      setSubmitError('Silakan centang pernyataan kebenaran bukti keluhan terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitPublicOrderComplaint(data?.invoiceNumber || invoiceNumber, {
        incidentType,
        itemDescription: itemDescription.trim(),
        claimantName: claimantName.trim(),
        claimantPhone: claimantPhone.trim(),
        evidenceNotes: evidenceNotes.trim(),
        photoUrls,
        bankInfo: includeBankInfo
          ? {
              bankName: bankName.trim(),
              accountNumber: accountNumber.trim(),
              accountHolder: accountHolder.trim(),
            }
          : null,
        agreedToTerms: true,
      });

      if (res.httpStatus === 410) {
        setRemainingMs(0);
        setSubmitError(res.message || 'Batas waktu keluhan 1x24 jam telah berakhir.');
        return;
      }
      if (res.httpStatus === 409 && res.data?.customerClaimToken) {
        setSubmittedToken(res.data.customerClaimToken);
        return;
      }
      if (res.status !== 'success' || !res.data?.customerClaimToken) {
        const firstFieldErr = res.errors ? Object.values(res.errors).flat()[0] : null;
        setSubmitError(firstFieldErr || res.message || 'Gagal mengirim pengajuan keluhan.');
        return;
      }

      setSubmittedToken(res.data.customerClaimToken);
    } catch {
      setSubmitError('Terjadi gangguan jaringan saat mengirim keluhan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-900 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Memeriksa masa garansi & data nota...</p>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-5">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-6 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 mb-1.5">Portal Keluhan Tidak Tersedia</h1>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            {loadError || 'Nota laundry tidak ditemukan di sistem kami.'}
          </p>
          <a
            href={trackingUrl}
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold transition-colors"
          >
            <span>Lihat Halaman Tracking Nota</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Header Brand Outlet */}
      <header className="bg-blue-950 text-white px-4 pt-5 pb-7 shadow-sm">
        <div className="max-w-xl mx-auto flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {data.outlet.logoUrl ? (
              <img
                src={data.outlet.logoUrl}
                alt={data.outlet.name}
                className="w-11 h-11 rounded-2xl object-cover bg-white shrink-0 border border-white/20"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-blue-900/80 border border-white/15 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-blue-200" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">
                Pusat Garansi & Layanan Pelanggan
              </p>
              <h1 className="text-base sm:text-lg font-extrabold truncate">{data.outlet.name}</h1>
              {data.outlet.address && (
                <p className="text-xs text-blue-200/85 truncate">{data.outlet.address}</p>
              )}
            </div>
          </div>
          {data.outlet.phone && (
            <a
              href={outletWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat Outlet</span>
            </a>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 -mt-4 space-y-4">
        {/* Ringkasan Nota */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nomor Nota</span>
              <h2 className="text-lg font-extrabold text-slate-900 font-mono">{data.invoiceNumber}</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Pelanggan: <span className="font-semibold text-slate-800">{data.customerNameMasked}</span>
              </p>
            </div>
            <a
              href={trackingUrl}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors shrink-0"
            >
              <span>Status Nota</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          {data.completedAt && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>Diselesaikan: <strong className="text-slate-800">{formatDateTimeId(data.completedAt)}</strong></span>
              {data.expiresAt && (
                <span>Batas Garansi: <strong className="text-slate-800">{formatDateTimeId(data.expiresAt)}</strong></span>
              )}
            </div>
          )}
        </section>

        {/* STATE 1: KELUHAN SUDAH PERNAH DIAJUKAN (ATAU BARU SAJA TERKIRIM) */}
        {activeClaimToken ? (
          <section className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-extrabold text-slate-900">
                  {submittedToken ? 'Keluhan & Bukti Berhasil Dikirim!' : 'Keluhan Nota Ini Sudah Tercatat'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  Laporan Anda telah diteruskan langsung ke dashboard Penanganan Insiden{' '}
                  <strong className="text-slate-800">{data.outlet.name}</strong> untuk segera diverifikasi.
                </p>
              </div>
            </div>

            {data.existingIncident && (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-slate-700">
                    {INCIDENT_TYPE_LABELS[data.existingIncident.incidentType] || data.existingIncident.incidentType}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold border text-[11px] ${
                      (INCIDENT_STATUS_BADGE[data.existingIncident.status] || INCIDENT_STATUS_BADGE.OPEN).cls
                    }`}
                  >
                    {(INCIDENT_STATUS_BADGE[data.existingIncident.status] || INCIDENT_STATUS_BADGE.OPEN).label}
                  </span>
                </div>
                <p className="text-slate-700">
                  Item: <strong>{data.existingIncident.itemDescription}</strong>
                </p>
                <p className="text-slate-500">Dilaporkan pada {formatDateTimeId(data.existingIncident.createdAt)}</p>
                {data.existingIncident.settledAt && (
                  <div className="pt-2 border-t border-slate-200 text-emerald-800 font-semibold space-y-1">
                    {data.existingIncident.rewashTriggered && <p>• Garansi Cuci Ulang (Rewash Rp 0) diaktifkan</p>}
                    {(data.existingIncident.refundAmount || 0) > 0 && (
                      <p>• Refund Biaya Cuci: Rp {Number(data.existingIncident.refundAmount).toLocaleString('id-ID')}</p>
                    )}
                    {(data.existingIncident.approvedCompensation || 0) > 0 && (
                      <p>
                        • Kompensasi Ganti Rugi: Rp{' '}
                        {Number(data.existingIncident.approvedCompensation).toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <a
                href={`/incident-claim/${encodeURIComponent(activeClaimToken)}`}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Pantau Progres & Penyelesaian Klaim</span>
              </a>
              <a
                href={trackingUrl}
                className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
              >
                <span>Kembali ke Tracking</span>
              </a>
            </div>
          </section>
        ) : effectiveWindowStatus === 'NOT_COMPLETED' ? (
          /* STATE 2: CUCIAN BELUM SELESAI */
          <section className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 mb-1.5">
                  Belum Aktif
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Cucian Anda Masih Dalam Proses ({LAUNDRY_STATUS_LABELS[data.laundryStatus] || data.laundryStatus})
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Form pengajuan keluhan & garansi otomatis terbuka selama <strong>1x24 jam</strong> setelah cucian
                  berstatus <strong>Selesai & Diserahkan</strong> kepada pelanggan.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <a
                href={trackingUrl}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold transition-colors"
              >
                <span>Pantau Progres Cucian Live</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              {data.outlet.phone && (
                <a
                  href={outletWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Hubungi Outlet</span>
                </a>
              )}
            </div>
          </section>
        ) : effectiveWindowStatus === 'EXPIRED' ? (
          /* STATE 3: MASA GARANSI 1x24 JAM TELAH BERAKHIR */
          <section className="bg-white rounded-2xl border border-rose-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 mb-1.5">
                  Garansi 1x24 Jam Berakhir
                </span>
                <h3 className="text-base font-extrabold text-slate-900">Batas Waktu Pengajuan Keluhan Terlewati</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Masa garansi layanan cucian selama <strong>1x24 jam</strong> sejak serah terima telah ditutup otomatis
                  pada <strong>{formatDateTimeId(data.expiresAt)}</strong> untuk menjaga keakuratan investigasi barang.
                </p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 leading-relaxed">
              Apabila ada hal mendesak yang perlu didiskusikan langsung dengan pengelola outlet, silakan hubungi tim kami
              melalui WhatsApp resmi toko.
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              {data.outlet.phone && (
                <a
                  href={outletWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Diskusikan via WhatsApp Outlet</span>
                </a>
              )}
              <a
                href={trackingUrl}
                className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold transition-colors"
              >
                <span>Lihat Detail Nota</span>
              </a>
            </div>
          </section>
        ) : (
          /* STATE 4: OPEN (AKTIF DALAM MASA 1x24 JAM) */
          <>
            {/* Countdown Garansi Aktif */}
            <section className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                    Masa Garansi Keluhan Aktif
                  </p>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Sisa waktu untuk mengajukan keluhan atas nota ini:
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono font-extrabold text-sm bg-slate-950/35 px-3.5 py-2 rounded-xl border border-white/15 self-start sm:self-center shrink-0 tabular-nums">
                <span>{countdown.hours}j</span>
                <span className="text-blue-300">:</span>
                <span>{countdown.minutes}m</span>
                <span className="text-blue-300">:</span>
                <span className="text-amber-300">{countdown.seconds}d</span>
              </div>
            </section>

            {/* Form Pengajuan Keluhan Pelanggan */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Form Pengajuan Keluhan & Garansi</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lengkapi data berikut dengan bukti foto jelas agar kami dapat segera memproses solusi (cuci ulang / kompensasi).
                </p>
              </div>

              {/* 1. Jenis Kendala */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Jenis Kendala <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value as LaundryIncidentType)}
                    className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm font-medium text-slate-800 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/15 outline-none transition-all"
                  >
                    {INCIDENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {INCIDENT_TYPE_OPTIONS.find((o) => o.value === incidentType)?.hint}
                </p>
              </div>

              {/* 2. Nama / Deskripsi Pakaian Bermasalah */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Barang / Pakaian yang Bermasalah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Contoh: Kemeja putih kerah luntur / Sprei king putih masih bernoda"
                  maxLength={250}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/15 outline-none"
                />
              </div>

              {/* 3. Verifikasi Kepemilikan Pelanggan */}
              <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-900 shrink-0" />
                  <span>Verifikasi Pemilik Nota (Anti-Komplain Fiktif)</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap Pelapor <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    placeholder="Nama Anda sesuai nota"
                    maxLength={120}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/15 outline-none"
                  />
                </div>
                <WhatsAppInput
                  label="Nomor WhatsApp Terdaftar di Nota"
                  value={claimantPhone}
                  onChange={setClaimantPhone}
                  required
                  helperText={
                    data.hasCustomerPhone
                      ? 'Harus sama dengan nomor WhatsApp pemilik nota (minimal cocok 4 digit terakhir).'
                      : 'Masukkan nomor WhatsApp aktif Anda agar tim outlet mudah menghubungi.'
                  }
                />
              </div>

              {/* 4. Kronologi Kendala */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kronologi & Detail Kendala <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  required
                  placeholder="Ceritakan kondisi cucian saat diterima di rumah dan solusi yang diharapkan (misal: cuci ulang / perbaikan)..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/15 outline-none resize-y"
                />
                <p className="text-[11px] text-slate-400 mt-1 text-right">{evidenceNotes.length}/2000 karakter</p>
              </div>

              {/* 5. Upload Foto Bukti Wajib 1-3 Foto */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Foto Bukti Kondisi Cucian <span className="text-rose-500">* (Min. 1, Maks. 3 foto)</span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">{photoUrls.length}/3 foto</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />

                {photoUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5 mb-2.5">
                    {photoUrls.map((url, idx) => (
                      <div
                        key={url}
                        className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group"
                      >
                        <img src={url} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="absolute bottom-1.5 left-1.5 p-1.5 rounded-lg bg-slate-900/75 text-white hover:bg-slate-900 transition-colors"
                          aria-label="Perbesar foto"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                          aria-label="Hapus foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {photoUrls.length < 3 && (
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 hover:border-blue-900 hover:bg-blue-50/40 rounded-2xl py-4 px-4 flex flex-col items-center justify-center gap-1.5 text-slate-600 transition-colors disabled:opacity-60"
                  >
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin text-blue-900" />
                        <span className="text-xs font-semibold text-blue-900">Mengunggah foto bukti...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-6 h-6 text-blue-900" />
                        <span className="text-xs font-bold text-slate-800">Ambil / Pilih Foto Bukti</span>
                        <span className="text-[11px] text-slate-500">JPG / PNG / WebP • Otomatis dioptimalkan</span>
                      </>
                    )}
                  </button>
                )}

                {photoError && (
                  <p className="text-xs font-semibold text-rose-600 mt-1.5">{photoError}</p>
                )}
              </div>

              {/* 6. Rekening Bank Opsional */}
              <div className="border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBankInfo}
                    onChange={(e) => setIncludeBankInfo(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    <strong className="inline-flex items-center gap-1 text-slate-900">
                      <Landmark className="w-3.5 h-3.5 text-blue-900" />
                      Lampirkan Rekening Bank (Opsional)
                    </strong>
                    <br />
                    Berguna jika hasil verifikasi menyepakati pengembalian dana atau kompensasi via transfer.
                  </span>
                </label>

                {includeBankInfo && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Nama Bank / E-Wallet"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium focus:border-blue-900 outline-none"
                    />
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Nomor Rekening"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-900 outline-none"
                    />
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Atas Nama"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium focus:border-blue-900 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 7. Persetujuan Syarat & Ketentuan */}
              <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 border border-slate-200 rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Saya menyatakan bahwa keluhan dan foto bukti yang saya kirim adalah kondisi asli cucian dari nota{' '}
                  <strong className="text-slate-800">{data.invoiceNumber}</strong> tanpa dicuci/diubah ulang setelah
                  diterima.
                </span>
              </label>

              {submitError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || uploadingPhoto}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 text-white text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim Pengajuan Keluhan...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>Kirim Keluhan & Bukti ke Outlet</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </main>

      {/* Lightbox Pratinjau Foto */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 text-white hover:bg-white/25"
            aria-label="Tutup pratinjau"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Pratinjau Bukti"
            className="max-w-full max-h-[85vh] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
