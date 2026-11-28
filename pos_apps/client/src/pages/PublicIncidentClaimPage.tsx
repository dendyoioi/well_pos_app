import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Camera,
  CheckCircle2,
  Clock,
  FileCheck2,
  Loader2,
  MapPin,
  Phone,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { WhatsAppInput } from '../components/ui/WhatsAppInput';
import type { PublicIncidentClaimData } from '../types/laundry';

interface PublicIncidentClaimPageProps {
  token: string;
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  DAMAGED: 'Pakaian Rusak / Luntur',
  LOST: 'Pakaian Hilang',
  STAIN_REMAINING: 'Noda Membandel',
  MIXED_UP: 'Pakaian Tertukar',
};

const PAYOUT_METHOD_LABELS: Record<string, string> = {
  CASH_DRAWER: 'Tunai Kas Laci Kasir Outlet',
  BANK_TRANSFER: 'Transfer Bank / Kas Pusat',
  CUSTOMER_WALLET: 'Saldo Deposit Pelanggan',
};

export const PublicIncidentClaimPage: React.FC<PublicIncidentClaimPageProps> = ({ token }) => {
  const [data, setData] = useState<PublicIncidentClaimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Klaim & Bukti Pelanggan
  const [claimantName, setClaimantName] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [showBankSection, setShowBankSection] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchClaimData = async () => {
    if (!token) {
      setError('Token klaim insiden tidak valid.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.getPublicIncidentClaim(token);
      if (res.status === 'success' && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Tautan form klaim insiden tidak ditemukan.');
        setData(null);
      }
    } catch {
      setError('Gagal menghubungkan ke server. Silakan muat ulang halaman.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaimData();
  }, [token]);

  const compressImageToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxWidth = 1280;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.78;
          let result = canvas.toDataURL('image/jpeg', quality);
          // Pastikan payload base64 di bawah ~1.8 MB agar lolos batas 2 MB di server
          while (result.length > 2_300_000 && quality > 0.35) {
            quality -= 0.12;
            result = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(result);
        };
        img.onerror = () => reject(new Error('File gambar tidak dapat dibaca'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Gagal membaca berkas gambar'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 3 - photoUrls.length;
    if (remainingSlots <= 0) {
      setFormError('Maksimal 3 foto bukti yang dapat diunggah.');
      e.target.value = '';
      return;
    }

    setUploadingPhoto(true);
    setFormError(null);

    try {
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      for (const file of filesToProcess) {
        if (!file.type.startsWith('image/')) {
          setFormError('Hanya berkas gambar (JPG, PNG, WebP) yang diperbolehkan.');
          continue;
        }
        const dataUrl = await compressImageToDataUrl(file);
        const base64Body = dataUrl.split(',')[1] || '';
        const approxBytes = Math.floor((base64Body.length * 3) / 4);
        if (approxBytes > 2 * 1024 * 1024) {
          setFormError('Ukuran foto masih melebihi 2 MB setelah kompresi. Gunakan foto yang lebih kecil.');
          continue;
        }

        const res = await api.uploadPublicIncidentClaimPhoto(token, dataUrl);
        if (res.status === 'success' && res.data?.url) {
          setPhotoUrls((prev) => [...prev, res.data.url]);
        } else {
          setFormError(res.message || 'Gagal mengunggah foto bukti.');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'Gagal memproses unggahan foto.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (claimantName.trim().length < 2) {
      setFormError('Nama lengkap pelanggan wajib diisi (minimal 2 karakter).');
      return;
    }
    if (!claimantPhone || claimantPhone.length < 8) {
      setFormError('Nomor WhatsApp aktif wajib diisi.');
      return;
    }
    if (evidenceNotes.trim().length < 5) {
      setFormError('Kronologi / keterangan dari pihak Anda wajib diisi (minimal 5 karakter).');
      return;
    }

    const hasAnyBankField = bankName.trim() || accountNumber.trim() || accountHolder.trim();
    if (hasAnyBankField && (!bankName.trim() || accountNumber.trim().length < 4 || !accountHolder.trim())) {
      setFormError('Apabila mengisi informasi rekening transfer, lengkapi Nama Bank, No. Rekening, dan Nama Pemilik Rekening.');
      return;
    }

    if (!agreedToTerms) {
      setFormError('Anda wajib mencentang persetujuan pernyataan kebenaran bukti & Berita Acara.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.submitPublicIncidentClaimEvidence(token, {
        claimantName: claimantName.trim(),
        claimantPhone,
        evidenceNotes: evidenceNotes.trim(),
        photoUrls,
        bankInfo: hasAnyBankField
          ? {
              bankName: bankName.trim(),
              accountNumber: accountNumber.trim(),
              accountHolder: accountHolder.trim(),
            }
          : null,
        agreedToTerms: true,
      });

      if (res.status === 'success') {
        setSubmitSuccess('Bukti dan kronologi Anda telah tercatat dan sedang ditinjau oleh pengelola outlet.');
        await fetchClaimData();
      } else {
        setFormError(res.message || 'Gagal mengirim bukti klaim. Periksa kembali isian Anda.');
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan saat mengirim bukti klaim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Header Publik */}
      <header className="bg-blue-950 text-white px-4 py-4 shadow-md sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight truncate">
                {data?.outlet?.name || 'Portal Klaim & Bukti Insiden'}
              </h1>
              <p className="text-[11px] text-blue-200 truncate">
                {data?.tenantName || 'Layanan Penanganan Komplain Resmi'}
              </p>
            </div>
          </div>
          {data?.settledAt ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 whitespace-nowrap shrink-0">
              Selesai &amp; Sah
            </span>
          ) : data?.customerEvidenceSubmittedAt ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-500/25 text-blue-100 border border-blue-300/40 whitespace-nowrap shrink-0">
              Bukti Diterima
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-400/20 text-amber-200 border border-amber-300/40 whitespace-nowrap shrink-0">
              Menunggu Bukti
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 pb-12 space-y-4">
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-900 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Memuat informasi insiden dan nota...</p>
          </div>
        ) : error || !data ? (
          <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-900">Tautan Tidak Tersedia</h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
              {error || 'Tautan form klaim insiden tidak ditemukan atau sudah kedaluwarsa.'}
            </p>
          </div>
        ) : (
          <>
            {/* Ringkasan Insiden & Info Outlet */}
            <section className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Nota Pesanan Terkait
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="font-mono font-black text-sm sm:text-base text-blue-950">
                      {data.order.invoiceNumber}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-bold text-slate-700">{data.customerName}</span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>{INCIDENT_TYPE_LABELS[data.incidentType] || data.incidentType}</span>
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {new Date(data.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-3 text-xs">
                <div>
                  <div className="text-[11px] font-bold text-slate-500 mb-0.5">Item / Pakaian Terdampak</div>
                  <div className="font-extrabold text-slate-900 text-sm">{data.itemDescription}</div>
                </div>

                {data.notes && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-600 mb-1">Catatan Pemeriksaan Toko</div>
                    <p className="text-xs text-slate-700 leading-relaxed">{data.notes}</p>
                  </div>
                )}

                {/* Galeri Foto Bukti dari Toko */}
                <div>
                  <div className="text-[11px] font-bold text-slate-600 mb-1.5">Foto Bukti dari Toko</div>
                  {data.photoUrls && data.photoUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {data.photoUrls.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPreviewPhoto(url)}
                          className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 hover:ring-2 hover:ring-blue-900 transition-all cursor-pointer"
                        >
                          <img src={url} alt={`Bukti Toko ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Tidak ada foto yang dilampirkan oleh toko.</p>
                  )}
                </div>

                {/* Info Kontak Outlet */}
                {(data.outlet.address || data.outlet.phone) && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    {data.outlet.address && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{data.outlet.address}</span>
                      </span>
                    )}
                    {data.outlet.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{data.outlet.phone}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Jika Sudah Selesai: Berita Acara Penyelesaian Insiden */}
            {data.settledAt && (
              <section className="bg-emerald-50/80 rounded-3xl border border-emerald-200 shadow-xs p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm sm:text-base font-black text-emerald-950">
                      Berita Acara Penyelesaian Insiden
                    </h2>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Disahkan pada{' '}
                      {new Date(data.settledAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-2xl bg-white border border-emerald-200/80">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Garansi Cuci Ulang</div>
                    <div className="font-extrabold text-slate-900 mt-0.5 flex items-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5 text-blue-900" />
                      <span>{data.rewashTriggered ? 'Ya (Rp 0 / Diproses)' : 'Tidak'}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-emerald-200/80">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Refund Biaya Cuci</div>
                    <div className="font-extrabold text-slate-900 mt-0.5 tabular-nums">
                      Rp {Number(data.refundAmount || 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-emerald-200/80">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Kompensasi Ganti Rugi</div>
                    <div className="font-extrabold text-emerald-700 mt-0.5 tabular-nums">
                      Rp {Number(data.approvedCompensation || 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {(Number(data.refundAmount || 0) + Number(data.approvedCompensation || 0) > 0) && data.payoutMethod && (
                  <div className="p-3 rounded-2xl bg-white border border-emerald-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <Wallet className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        Metode Pencairan: {PAYOUT_METHOD_LABELS[data.payoutMethod] || data.payoutMethod}
                      </span>
                    </div>
                    {data.payoutReference && (
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                        Ref: {data.payoutReference}
                      </span>
                    )}
                  </div>
                )}

                {data.resolutionNotes && (
                  <div className="p-3 rounded-2xl bg-white border border-emerald-200/80 text-xs">
                    <div className="text-[11px] font-bold text-slate-600 mb-0.5">Catatan Penyelesaian Toko</div>
                    <p className="text-slate-800 leading-relaxed">{data.resolutionNotes}</p>
                  </div>
                )}
              </section>
            )}

            {/* Jika Bukti Klien Sudah Masuk */}
            {data.customerEvidenceSubmittedAt ? (
              <section className="bg-white rounded-3xl border border-blue-200 shadow-xs p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-blue-900 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-black text-slate-900">
                        {data.settledAt ? 'Bukti & Kronologi Anda' : 'Bukti Anda Sudah Diterima — Sedang Ditinjau Outlet'}
                      </h2>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Dikirim pada{' '}
                      {new Date(data.customerEvidenceSubmittedAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {submitSuccess && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{submitSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Pengirim Klaim</div>
                    <div className="font-bold text-slate-900 mt-0.5">{data.customerClaimantName}</div>
                    <div className="text-[11px] text-slate-600 font-mono">{data.customerClaimantPhone}</div>
                  </div>
                  {data.customerBankInfo && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Rekening Penerima</div>
                      <div className="font-bold text-slate-900 mt-0.5">{data.customerBankInfo.bankName}</div>
                      <div className="text-[11px] text-slate-700 font-mono">
                        {data.customerBankInfo.accountNumber} • a.n. {data.customerBankInfo.accountHolder}
                      </div>
                    </div>
                  )}
                </div>

                {data.customerEvidenceNotes && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs">
                    <div className="text-[11px] font-bold text-slate-600 mb-1">Kronologi / Keterangan Anda</div>
                    <p className="text-slate-800 leading-relaxed">{data.customerEvidenceNotes}</p>
                  </div>
                )}

                {data.customerEvidencePhotos && data.customerEvidencePhotos.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold text-slate-600 mb-1.5">Foto Bukti dari Anda</div>
                    <div className="flex flex-wrap gap-2">
                      {data.customerEvidencePhotos.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPreviewPhoto(url)}
                          className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 hover:ring-2 hover:ring-blue-900 transition-all cursor-pointer"
                        >
                          <img src={url} alt={`Bukti Anda ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ) : !data.settledAt ? (
              /* Form Kirim Bukti & Klaim Pelanggan */
              <form
                onSubmit={handleSubmitEvidence}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4"
              >
                <div className="flex items-start gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-2xl bg-blue-900 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900">
                      Kirim Bukti &amp; Klaim Pelanggan
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Lampirkan kronologi dan foto kondisi pakaian dari pihak Anda agar dapat ditinjau bersama bukti toko.
                    </p>
                  </div>
                </div>

                {formError && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Nama Pelanggan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={claimantName}
                      onChange={(e) => setClaimantName(e.target.value)}
                      placeholder="Masukkan nama lengkap Anda"
                      className="w-full min-h-[44px] px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <WhatsAppInput
                      label="Nomor WhatsApp"
                      value={claimantPhone}
                      onChange={(val) => setClaimantPhone(val)}
                      required
                      placeholder="81234567890"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Kronologi / Keterangan Klien <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={evidenceNotes}
                    onChange={(e) => setEvidenceNotes(e.target.value)}
                    placeholder="Jelaskan kondisi pakaian saat diterima kembali, bagian yang rusak/luntur/hilang, atau perkiraan nilai barang..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-slate-400"
                  />
                </div>

                {/* Upload Foto Bukti Klien (Maks 3 Foto) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Foto Bukti Klien ({photoUrls.length}/3)
                    </label>
                    <span className="text-[11px] text-slate-400">Maks 2 MB/foto</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5 items-center">
                    {photoUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative w-22 h-22 rounded-2xl overflow-hidden border border-slate-200 group"
                      >
                        <img
                          src={url}
                          alt={`Bukti Klien ${idx + 1}`}
                          onClick={() => setPreviewPhoto(url)}
                          className="w-full h-full object-cover cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          aria-label="Hapus foto"
                          className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-lg shadow-xs hover:bg-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {photoUrls.length < 3 && (
                      <label className="w-22 h-22 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-900 flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:text-blue-900 bg-slate-50 transition-colors">
                        {uploadingPhoto ? (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-900" />
                        ) : (
                          <>
                            <Camera className="w-5 h-5" />
                            <span className="text-[11px] mt-1 font-bold">Unggah Foto</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Opsional Info Rekening Transfer */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowBankSection((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-blue-900 shrink-0" />
                      <span>Info Rekening Transfer (Opsional — untuk pengembalian dana)</span>
                    </span>
                    <span className="text-[11px] text-blue-900 font-extrabold">
                      {showBankSection ? 'Sembunyikan' : 'Isi Rekening'}
                    </span>
                  </button>

                  {showBankSection && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Bank</label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="BCA / BRI / Mandiri"
                          className="w-full min-h-[40px] px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">No. Rekening</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          placeholder="1234567890"
                          className="w-full min-h-[40px] px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Atas Nama</label>
                        <input
                          type="text"
                          value={accountHolder}
                          onChange={(e) => setAccountHolder(e.target.value)}
                          placeholder="Nama di buku tabungan"
                          className="w-full min-h-[40px] px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Persetujuan Berita Acara */}
                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-blue-50/70 border border-blue-200/80 cursor-pointer text-xs text-slate-700 leading-relaxed">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900 shrink-0 cursor-pointer"
                  />
                  <span>
                    Saya menyatakan keterangan dan bukti yang saya kirimkan adalah benar serta bersedia menjadi acuan Berita Acara penyelesaian bersama pihak outlet.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting || uploadingPhoto}
                  className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-sm shadow-md shadow-blue-900/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim Bukti Klaim...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Kirim Bukti &amp; Klaim Pelanggan</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Insiden telah diselesaikan. Formulir unggah bukti baru sudah ditutup.</span>
              </div>
            )}
          </>
        )}
      </main>

      {/* Lightbox Foto */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl">
            <img src={previewPhoto} alt="Pratinjau Foto" className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              aria-label="Tutup pratinjau"
              className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/90 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
