import React, { useState, useEffect } from 'react';
import {
  Filter,
  Plus,
  Minus,
  AlertTriangle,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Scale,
  Sparkles,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import type { LaundryQueueOrder } from '../types/laundry';

interface LaundrySortingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: LaundryQueueOrder | null;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  onSorted?: () => void;
  onSaved?: () => void;
}

const COMMON_GARMENT_PRESETS = [
  { type: 'Kaos / T-Shirt', icon: '👕' },
  { type: 'Kemeja', icon: '👔' },
  { type: 'Celana Panjang', icon: '👖' },
  { type: 'Celana Pendek', icon: '🩳' },
  { type: 'Pakaian Dalam', icon: '🩲' },
  { type: 'Kerudung / Jilbab', icon: '🧕' },
  { type: 'Handuk', icon: '🧖' },
  { type: 'Sprei / Sarung Bantal', icon: '🛏️' },
  { type: 'Jaket / Sweater', icon: '🧥' },
  { type: 'Pakaian Lainnya', icon: '📦' },
];

const DEFECT_OPTIONS = [
  { key: 'ROBEK', label: 'Baju Robek / Bolong', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'KANCING_LEPAS', label: 'Kancing Lepas / Resleting Rusak', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  { key: 'LUNTUR', label: 'Risiko Luntur / Kain Sensitif', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'NODA_BERAT', label: 'Noda Berat (Darah, Karat, Tinta, Minyak)', badge: 'bg-orange-50 text-orange-800 border-orange-200' },
  { key: 'PINDAH_SATUAN', label: 'Rekomendasi Pindah ke Satuan / Dry Clean', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
];

export const LaundrySortingModal: React.FC<LaundrySortingModalProps> = ({
  isOpen,
  onClose,
  order,
  storeName = 'Well POS Laundry',
  storeAddress = 'Jl. Toko Laundry',
  storePhone = '-',
  onSorted,
  onSaved,
}) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [defects, setDefects] = useState<string[]>([]);
  const [defectNotes, setDefectNotes] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [showSlipPreview, setShowSlipPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  useEffect(() => {
    if (order) {
      // Inisialisasi hitungan helai yang sudah tersimpan sebelumnya (jika ada)
      const initialCounts: Record<string, number> = {};
      if (Array.isArray(order.garmentCounts) && order.garmentCounts.length > 0) {
        order.garmentCounts.forEach((gc: any) => {
          if (gc?.type && gc?.qty) {
            initialCounts[gc.type] = Number(gc.qty);
          }
        });
      } else {
        COMMON_GARMENT_PRESETS.forEach((p) => {
          initialCounts[p.type] = 0;
        });
      }
      setCounts(initialCounts);
      setDefects(Array.isArray(order.defects) ? order.defects : []);
      setDefectNotes(order.defectNotes || '');
      setOperatorName(order.sortedBy || '');
      setShowSlipPreview(false);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const totalPieces = Object.values(counts).reduce((acc, curr) => acc + (curr || 0), 0);

  const handleIncrement = (type: string, delta: number) => {
    setCounts((prev) => {
      const current = prev[type] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [type]: next };
    });
  };

  const handleToggleDefect = (key: string) => {
    setDefects((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  };

  const handleSave = async (advanceToNext: boolean = false) => {
    try {
      setSaving(true);
      const garmentCountsArray = Object.entries(counts)
        .filter(([_, qty]) => qty > 0)
        .map(([type, qty]) => ({ type, qty }));

      const res = await api.saveLaundrySortingData(order.id || order.orderId, {
        garmentCounts: garmentCountsArray,
        defects,
        defectNotes: defectNotes.trim(),
        operatorName: operatorName.trim() || 'Kasir / Operator',
        advanceToNext,
      });

      if (res.status === 'success') {
        showToast(
          advanceToNext
            ? 'Sortir selesai & nota dialihkan ke Stasiun Cuci!'
            : 'Hasil sortir & QC berhasil disimpan!'
        );
        if (onSorted) onSorted();
        if (onSaved) onSaved();
        setTimeout(() => onClose(), 800);
      } else {
        showToast(res.message || 'Gagal menyimpan data sortir', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem saat menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base">Sortir &amp; Quality Control (QC)</h3>
                <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200">
                  {order.invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {order.customerName} &bull; {order.serviceName} ({order.totalWeightKg || 0} Kg)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-5 text-xs">
          {/* Ringkasan Helai & Timbangan */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
              <Scale className="w-4 h-4 text-blue-900 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">Berat Kasir</span>
                <span className="font-mono text-sm font-black text-slate-900">
                  {order.totalWeightKg ? `${order.totalWeightKg} Kg` : '-'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-blue-900 shrink-0" />
              <div>
                <span className="text-[10px] text-blue-900 font-bold block">Total Helai Pcs</span>
                <span className="font-mono text-sm font-black text-blue-950">
                  {totalPieces} Pcs
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 flex items-center gap-2.5 col-span-2 sm:col-span-1">
              <Sparkles className="w-4 h-4 text-purple-900 shrink-0" />
              <div>
                <span className="text-[10px] text-purple-900 font-bold block">Aroma Parfum</span>
                <span className="font-bold text-xs text-purple-950 truncate block">
                  {order.perfumeVariant || 'Reguler'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 1: COUNTER HELAI PAKAIAN */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-900 text-xs">Rincian Helai Pakaian</h4>
                <p className="text-[11px] text-slate-500">
                  Hitung fisik pakaian per kategori untuk bukti serah terima transparan
                </p>
              </div>
              <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 border border-slate-200">
                {totalPieces} Helai Terhitung
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COMMON_GARMENT_PRESETS.map((preset) => {
                const qty = counts[preset.type] || 0;
                return (
                  <div
                    key={preset.type}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between transition-all ${
                      qty > 0
                        ? 'bg-blue-50/40 border-blue-200 shadow-2xs'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{preset.icon}</span>
                      <span className="font-bold text-slate-800 truncate text-xs">
                        {preset.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleIncrement(preset.type, -1)}
                        disabled={qty <= 0}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 flex items-center justify-center font-black transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-mono font-black text-xs text-slate-900">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleIncrement(preset.type, 1)}
                        className="w-7 h-7 rounded-lg bg-blue-900 hover:bg-blue-800 text-white flex items-center justify-center font-black transition-colors cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: PEMERIKSAAN KENDALA FISIK & QC */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div>
              <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Pemeriksaan Kendala Fisik &amp; Catatan Khusus</span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Centang jika ada kendala agar tercatat resmi di nota sortir dan QR tracking pelanggan
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {DEFECT_OPTIONS.map((opt) => {
                const isChecked = defects.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleToggleDefect(opt.key)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isChecked
                        ? `${opt.badge} shadow-xs ring-1 ring-amber-300 font-extrabold`
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{isChecked ? '✓' : '+'}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Keterangan Detail Kendala / Catatan Perawatan Khusus
              </label>
              <textarea
                rows={2}
                value={defectNotes}
                onChange={(e) => setDefectNotes(e.target.value)}
                placeholder="Contoh: Kemeja putih kancing ke-2 hilang, noda getah pisang di bagian lengan bawah, bahan sutra halus..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-900 focus:outline-none bg-slate-50 focus:bg-white font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nama Petugas Sortir
                </label>
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="Nama operator sortir..."
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setShowSlipPreview(!showSlipPreview)}
                  className="w-full h-9 rounded-xl border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-900" />
                  <span>{showSlipPreview ? 'Tutup Pratinjau Slip' : 'Lihat Pratinjau Slip Sortir'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* PRATINJAU SLIP SORTIR MANUAL (THERMAL 58MM / 80MM) */}
          {showSlipPreview && (
            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-300 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Pratinjau Kertas Nota Sortir (Thermal 58mm/80mm)
                </span>
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="px-3 py-1 rounded-lg bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs hover:bg-blue-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Slip</span>
                </button>
              </div>

              {/* Tampilan Struk Fisik Thermal */}
              <div
                id="printable-sorting-slip"
                className="max-w-xs mx-auto bg-white p-4 rounded-xl border border-slate-300 shadow-md font-mono text-[11px] text-slate-900 space-y-2 leading-relaxed"
              >
                <div className="text-center pb-2 border-b border-dashed border-slate-300">
                  <div className="font-extrabold text-sm uppercase">{storeName}</div>
                  <div className="text-[10px] text-slate-600">{storeAddress}</div>
                  <div className="text-[10px] text-slate-600">Telp: {storePhone}</div>
                  <div className="mt-1 font-bold text-xs bg-slate-100 py-0.5 rounded">
                    *** SLIP REKAP SORTIR &amp; QC ***
                  </div>
                </div>

                <div className="space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>No. Nota:</span>
                    <span className="font-bold">{order.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span className="font-bold">{order.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Layanan:</span>
                    <span className="font-bold">{order.serviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Timbangan:</span>
                    <span className="font-bold">{order.totalWeightKg || 0} Kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parfum:</span>
                    <span className="font-bold">{order.perfumeVariant || 'Reguler'}</span>
                  </div>
                </div>

                {/* Tabel Rincian Helai */}
                <div className="border-t border-b border-dashed border-slate-300 py-1.5 space-y-1">
                  <div className="flex justify-between font-bold text-[10px]">
                    <span>JENIS PAKAIAN</span>
                    <span>JUMLAH</span>
                  </div>
                  {Object.entries(counts)
                    .filter(([_, q]) => q > 0)
                    .map(([type, q]) => (
                      <div key={type} className="flex justify-between text-[10px]">
                        <span>{type}</span>
                        <span className="font-bold">{q} pcs</span>
                      </div>
                    ))}
                  <div className="flex justify-between font-extrabold text-[11px] pt-1 border-t border-dotted border-slate-200">
                    <span>TOTAL HELAI:</span>
                    <span>{totalPieces} PCS</span>
                  </div>
                </div>

                {/* Catatan Kendala */}
                {(defects.length > 0 || defectNotes) && (
                  <div className="border-b border-dashed border-slate-300 pb-1.5 space-y-0.5 text-[10px]">
                    <div className="font-bold text-rose-700">CATATAN KENDALA FISIK:</div>
                    {defects.map((d) => (
                      <div key={d} className="text-rose-600 font-semibold">
                        &bull; {DEFECT_OPTIONS.find((opt) => opt.key === d)?.label || d}
                      </div>
                    ))}
                    {defectNotes && <div className="italic text-slate-700 mt-0.5">"{defectNotes}"</div>}
                  </div>
                )}

                <div className="text-center pt-1 text-[9px] text-slate-500 space-y-0.5">
                  <div>Petugas Sortir: {operatorName || 'Operator'}</div>
                  <div>Waktu: {new Date().toLocaleString('id-ID')}</div>
                  <div className="italic text-[8px] mt-1">Disematkan pada keranjang kontainer produksi</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-200 transition-all text-xs cursor-pointer"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 font-extrabold text-xs transition-all cursor-pointer shadow-2xs"
            >
              <span>{saving ? 'Menyimpan...' : 'Simpan Saja'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Memproses...' : 'Simpan & Lanjut ke Cuci'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-fadeIn transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
