import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Loader2,
  ChevronDown,
  Camera,
  CheckCircle2,
  Copy,
  Check,
  MessageCircle,
  Link2,
} from 'lucide-react';
import { api } from '../../services/api';
import type { LaundryQueueOrder, LaundryMachine, LaundryIncident } from '../../types/laundry';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useDialog } from '../../context/DialogContext';
import { buildWhatsAppUrl } from '../../utils/phone';

interface LaundryIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: LaundryQueueOrder | null;
  outletId: string;
  onSuccess: () => void;
}

const INCIDENT_TYPES = [
  { value: 'DAMAGED', label: 'Pakaian Rusak / Luntur', color: 'border-rose-300 text-rose-700 bg-rose-50' },
  { value: 'LOST', label: 'Pakaian Hilang', color: 'border-amber-300 text-amber-700 bg-amber-50' },
  { value: 'STAIN_REMAINING', label: 'Noda Membandel', color: 'border-purple-300 text-purple-700 bg-purple-50' },
  { value: 'MIXED_UP', label: 'Pakaian Tertukar', color: 'border-blue-300 text-blue-700 bg-blue-50' },
] as const;

const PRODUCTION_STAGES = [
  { value: 'SORTING', label: '1. Pemilahan & Cek Noda (Sorting)' },
  { value: 'WASHING', label: '2. Proses Cuci (Washing)' },
  { value: 'DRYING', label: '3. Pengeringan (Drying)' },
  { value: 'IRONING', label: '4. Setrika & Uap (Ironing)' },
  { value: 'PACKING', label: '5. Pengemasan & Plastik (Packing)' },
  { value: 'RACK_STORAGE', label: '6. Rak Penyimpanan (Ready)' },
];

export const LaundryIncidentModal: React.FC<LaundryIncidentModalProps> = ({
  isOpen,
  onClose,
  order,
  outletId,
  onSuccess,
}) => {
  const dialog = useDialog();
  const [incidentType, setIncidentType] = useState<string>('DAMAGED');
  const [itemDescription, setItemDescription] = useState('');
  const [stage, setStage] = useState('SORTING');
  const [machineName, setMachineName] = useState('');
  const [responsibleStaffId, setResponsibleStaffId] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [estimatedCompensation, setEstimatedCompensation] = useState<number>(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdIncident, setCreatedIncident] = useState<LaundryIncident | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Dynamic machines & staff list
  const [machines, setMachines] = useState<LaundryMachine[]>([]);
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; role: string }>>([]);

  useEffect(() => {
    if (!isOpen || !outletId) return;
    setCreatedIncident(null);
    setCopiedLink(false);
    setErrorMessage(null);
    setItemDescription('');
    setNotes('');
    setPhotoUrls([]);

    // Prefill automatic compensation suggestion
    if (order) {
      const suggested = Math.min(Number(order.grandTotal || 0) * 5, 100000);
      setEstimatedCompensation(suggested);
      if (order.currentStage) {
        setStage(order.currentStage);
      }
    }

    // Load machines dynamically from API (NO HARDCODING)
    api
      .getLaundryMachines(outletId)
      .then((res) => {
        if (res.status === 'success' && Array.isArray(res.data)) {
          setMachines(res.data.filter((m) => m.status === 'ACTIVE'));
        }
      })
      .catch((err) => console.error('Error fetching machines:', err));

    // Load staff list
    api
      .getUsers()
      .then((res) => {
        if (res.status === 'success' && Array.isArray(res.data)) {
          setStaffList(res.data.filter((u: any) => u.isActive));
        }
      })
      .catch((err) => console.error('Error fetching users:', err));
  }, [isOpen, outletId, order]);

  if (!isOpen || !order) return null;

  // Kompres file gambar ke Base64 Data URL (Maks lebar 1280px, JPEG 0.78, < 2MB)
  const compressFileToDataUrl = (file: File): Promise<string> => {
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Gagal membaca gambar'));
        img.src = event.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);
    setErrorMessage(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedDataUrl = await compressFileToDataUrl(file);

        const res = await api.uploadLaundryConditionPhoto({
          image: compressedDataUrl,
          caption: itemDescription.trim() || 'Bukti Insiden',
          stage: stage || 'WASHING',
        });

        if (res.status === 'success' && res.data?.url) {
          setPhotoUrls((prev) => [...prev, res.data.url]);
        } else if (res.data?.url) {
          setPhotoUrls((prev) => [...prev, res.data.url]);
        } else {
          // Fallback lokal jika environment offline/mock
          setPhotoUrls((prev) => [...prev, compressedDataUrl]);
        }
      }
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setErrorMessage('Gagal mengunggah foto. Pastikan ukuran file di bawah 5MB.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDescription.trim()) {
      setErrorMessage('Deskripsi pakaian rusak / hilang wajib diisi.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.createLaundryIncident({
        outletId,
        orderId: order.orderId,
        incidentType,
        itemDescription: itemDescription.trim(),
        stage,
        machineName: machineName || undefined,
        responsibleStaffId: responsibleStaffId || undefined,
        notes: notes.trim(),
        photoUrls,
        estimatedCompensation: Number(estimatedCompensation || 0),
      });

      if (res.status === 'success') {
        onSuccess();
        if (res.data?.customerClaimToken) {
          setCreatedIncident(res.data);
        } else {
          onClose();
        }
      } else {
        setErrorMessage(res.message || 'Gagal menyimpan laporan insiden.');
      }
    } catch (err: any) {
      console.error('Error submitting incident:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menyimpan laporan insiden.');
    } finally {
      setSubmitting(false);
    }
  };

  const claimUrl =
    createdIncident?.customerClaimToken && typeof window !== 'undefined'
      ? `${window.location.origin}/incident-claim/${createdIncident.customerClaimToken}`
      : '';

  const handleCopyClaimLink = async () => {
    if (!claimUrl) return;
    try {
      await navigator.clipboard.writeText(claimUrl);
      setCopiedLink(true);
      dialog.toast('Link form bukti pelanggan berhasil disalin!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      dialog.toast('Gagal menyalin link. Silakan salin secara manual.', 'error');
    }
  };

  const handleSendClaimWhatsApp = () => {
    if (!claimUrl || !order) return;
    const message =
      `Halo Kak ${order.customerName || 'Pelanggan'},\n` +
      `Terkait laporan insiden pada nota *${order.invoiceNumber}* (${createdIncident?.itemDescription || itemDescription}), ` +
      `mohon bantuannya untuk mengisi form kronologi & mengunggah foto bukti dari pihak Kakak melalui tautan resmi berikut agar dapat segera kami tindak lanjuti:\n\n` +
      `${claimUrl}\n\nTerima kasih.`;
    window.open(buildWhatsAppUrl(order.customerPhone, message), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Catat Insiden Produksi</h3>
              <p className="text-xs text-slate-500">
                Invoice: <span className="font-semibold text-slate-700">{order.invoiceNumber}</span> • {order.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post-Create Claim Link Sharing View vs Form Body */}
        {createdIncident ? (
          <>
            <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-emerald-950 text-sm">
                    Laporan Insiden Berhasil Dicatat
                  </h4>
                  <p className="text-emerald-800 mt-0.5 leading-relaxed">
                    Bagikan tautan portal klaim di bawah ini kepada pelanggan agar mereka dapat mengirimkan foto bukti &amp; kronologi secara langsung sebelum penyelesaian dicairkan.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <Link2 className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                  <span>Link Form Bukti Pelanggan</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-[11px] text-slate-700 break-all select-all">
                  {claimUrl}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyClaimLink}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link Tersalin' : 'Salin Link Form Bukti'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSendClaimWhatsApp}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Kirim via WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 py-2.5 text-xs font-extrabold text-white bg-blue-900 hover:bg-blue-800 rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Selesai &amp; Tutup
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Form Body Scrollable */}
            <form id="incident-form" onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Jenis Insiden */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Jenis Insiden <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {INCIDENT_TYPES.map((type) => {
                const isSelected = incidentType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setIncidentType(type.value)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between ${
                      isSelected
                        ? `${type.color} ring-2 ring-blue-900 border-transparent shadow-sm`
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{type.label}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-900 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deskripsi Pakaian */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deskripsi Pakaian / Item <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="Contoh: Kemeja Putih Zara sobek di bagian kancing kedua / Luntur warna merah"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent text-slate-800"
            />
          </div>

          {/* Tahap Kejadian & Mesin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tahap Ditemukan
              </label>
              <div className="relative">
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full appearance-none pr-10 px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent text-slate-800 font-medium"
                >
                  {PRODUCTION_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mesin Terkait (Opsional)
              </label>
              <div className="relative">
                <select
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  className="w-full appearance-none pr-10 px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent text-slate-800"
                >
                  <option value="">-- Pilih Mesin --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.machineType})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Staf Penanggung Jawab */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operator / Staf Bertugas (Opsional)
            </label>
            <div className="relative">
              <select
                value={responsibleStaffId}
                onChange={(e) => setResponsibleStaffId(e.target.value)}
                className="w-full appearance-none pr-10 px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent text-slate-800"
              >
                <option value="">-- Tidak Ditentukan / Bersama --</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Catatan Kronologi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kronologi / Catatan Khusus
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jelaskan detail saat pakaian ditemukan rusak/luntur atau kondisi awal saat diterima..."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* Upload Foto Bukti */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Foto Bukti Kerusakan / Kondisi Pakaian
            </label>
            <div className="flex flex-wrap gap-2.5 items-center">
              {photoUrls.map((url, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group">
                  <img src={url} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-900 flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:text-blue-900 bg-slate-50 transition-colors">
                {uploadingPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-900" />
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    <span className="text-[10px] mt-1 font-medium">Tambah</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Format: JPG, PNG. Kompresi otomatis.</p>
          </div>

          {/* Estimasi Ganti Rugi Sesuai Klausul Nota */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-900 font-semibold">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Saran Ganti Rugi (Klausul Nota)
              </span>
              <span className="tabular-nums font-bold">
                Max 5x Ongkos / Rp 100.000
              </span>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Total tagihan nota ini adalah{' '}
              <span className="font-semibold text-slate-800">
                Rp {Number(order.grandTotal).toLocaleString('id-ID')}
              </span>
              . Nilai ganti rugi disetujui akan diputuskan oleh Owner/Supervisor.
            </p>
            <CurrencyInput
              label="Estimasi Penggantian (Rp)"
              value={estimatedCompensation}
              onChange={(val) => setEstimatedCompensation(val)}
              placeholder="0"
              className="bg-white rounded-xl"
            />
          </div>
        </form>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Batal
          </button>
            <button
              type="submit"
              form="incident-form"
              disabled={submitting || uploadingPhoto}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Simpan Laporan</span>
            </button>
          </div>
          </>
        )}
      </div>
    </div>
  );
};
