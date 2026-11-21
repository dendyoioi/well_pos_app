import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Sparkles,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Check,
  Tag,
  Filter,
  Waves,
  Wind,
  Flame,
  Layers,
  Package,
  Wrench,
  ShieldAlert,
  Archive,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import type { ProductionStageDefinition } from '../types/laundry';
import { DEFAULT_PRODUCTION_STAGES } from '../types/laundry';

interface LaundryStageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (stages: ProductionStageDefinition[]) => void;
}

const STAGE_ICON_MAP: Record<string, React.ElementType> = {
  Tag,
  Filter,
  Sparkles,
  ShieldAlert,
  Wrench,
  Waves,
  Wind,
  Flame,
  Layers,
  Package,
  Archive,
  Sliders,
};

const MACRO_STATUS_OPTIONS = [
  { value: 'RECEIVED', label: '1. Penerimaan / Antrean Masuk', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
  { value: 'WASHING_DRYING', label: '2. Pencucian & Pengeringan', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { value: 'IRONING_PACKING', label: '3. Penyetrikaan & Pelipatan', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'READY_FOR_PICKUP', label: '4. Pengemasan & Rak Siap Ambil', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { value: 'COMPLETED', label: '5. Selesai / Diserahkan', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
];

export const LaundryStageSettingsModal: React.FC<LaundryStageSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [stages, setStages] = useState<ProductionStageDefinition[]>(DEFAULT_PRODUCTION_STAGES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDesc, setNewStageDesc] = useState('');
  const [newStageMacro, setNewStageMacro] = useState('WASHING_DRYING');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const loadStages = async () => {
    try {
      setLoading(true);
      const res = await api.getLaundryStageSettings();
      if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
        setStages(res.data);
      } else {
        setStages(DEFAULT_PRODUCTION_STAGES);
      }
    } catch {
      setStages(DEFAULT_PRODUCTION_STAGES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStages();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleStage = (key: string) => {
    setStages((prev) =>
      prev.map((s) => (s.key === key ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const handleNameChange = (key: string, name: string) => {
    setStages((prev) =>
      prev.map((s) => (s.key === key ? { ...s, name } : s))
    );
  };

  const handleDeleteCustomStage = (key: string) => {
    setStages((prev) => prev.filter((s) => s.key !== key));
  };

  const handleAddCustomStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) {
      showToast('Nama tahapan wajib diisi', 'error');
      return;
    }
    const cleanKey = newStageName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .slice(0, 30);

    const isDuplicate = stages.some((s) => s.key === cleanKey);
    const key = isDuplicate ? `${cleanKey}_${Date.now() % 1000}` : cleanKey;

    const newStage: ProductionStageDefinition = {
      key,
      name: newStageName.trim(),
      description: newStageDesc.trim() || 'Tahapan pengerjaan kustom toko',
      sequence: stages.length + 1,
      isActive: true,
      isDefault: false,
      macroStatus: newStageMacro as any,
      icon: 'Sliders',
    };

    setStages((prev) => [...prev, newStage]);
    setNewStageName('');
    setNewStageDesc('');
    setShowAddForm(false);
    showToast(`Tahapan kustom "${newStage.name}" berhasil ditambahkan`);
  };

  const handleResetToDefault = async () => {
    if (!window.confirm('Kembalikan seluruh pengaturan tahapan ke standar 11 tahapan baku SmartOwner?')) {
      return;
    }
    try {
      setSaving(true);
      const res = await api.resetLaundryStageSettings();
      if (res.status === 'success' && res.data) {
        setStages(res.data);
        showToast('Berhasil dikembalikan ke 11 tahapan standar SmartOwner');
        if (onSaved) onSaved(res.data);
      }
    } catch {
      setStages(DEFAULT_PRODUCTION_STAGES);
      showToast('Berhasil direset ke default');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const res = await api.updateLaundryStageSettings(stages);
      if (res.status === 'success') {
        showToast('Pengaturan tahapan produksi toko berhasil disimpan!');
        if (onSaved) onSaved(stages);
        setTimeout(() => onClose(), 800);
      } else {
        showToast(res.message || 'Gagal menyimpan pengaturan', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem saat menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = stages.filter((s) => s.isActive).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base">Pengaturan Tahapan Produksi</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                  {activeCount} dari {stages.length} Aktif
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasi 11 alur baku SmartOwner &amp; tahapan kustom khusus toko Anda
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
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
          {/* Info Banner */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-slate-700 space-y-1">
            <div className="font-extrabold text-blue-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-900" />
              <span>SOP Produksi Standar SmartOwner &amp; Kustomisasi Toko</span>
            </div>
            <p className="text-[11px] text-blue-900/80 leading-relaxed">
              Tahapan yang berstatus <strong>Aktif</strong> di bawah ini akan muncul sebagai opsi checklist saat membuat layanan baru serta menjadi alur stasiun pengerjaan bagi operator produksi.
            </p>
          </div>

          {/* List of Stages */}
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="inline-block w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="font-bold">Memuat konfigurasi tahapan...</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stages.map((stage, idx) => {
                const IconComponent = STAGE_ICON_MAP[stage.icon || 'Sliders'] || Sliders;
                const macroOpt = MACRO_STATUS_OPTIONS.find((m) => m.value === stage.macroStatus);

                return (
                  <div
                    key={stage.key}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      stage.isActive
                        ? 'bg-white border-slate-200 shadow-2xs hover:border-blue-200'
                        : 'bg-slate-50/70 border-slate-200/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Sequence Badge & Icon */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs border ${
                            stage.isActive
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>

                        {/* Title & Editable Name */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] font-black text-slate-400">
                              #{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={stage.name}
                              onChange={(e) => handleNameChange(stage.key, e.target.value)}
                              className="font-black text-slate-900 text-xs px-2 py-0.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-blue-900 focus:bg-white bg-transparent transition-all outline-hidden max-w-xs"
                            />
                            {stage.code && (
                              <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                {stage.code}
                              </span>
                            )}
                            {!stage.isDefault && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                                Kustom Toko
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {stage.description}
                          </p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                                macroOpt?.badge || 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {macroOpt?.label.split('. ')[1] || stage.macroStatus}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action: Toggle Active & Delete Custom */}
                      <div className="flex items-center gap-2 shrink-0 pt-1">
                        {!stage.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomStage(stage.key)}
                            title="Hapus tahapan kustom"
                            className="w-8 h-8 rounded-xl text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleStage(stage.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            stage.isActive
                              ? 'bg-blue-900 text-white shadow-2xs hover:bg-blue-800'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              stage.isActive ? 'bg-emerald-400' : 'bg-slate-300'
                            }`}
                          />
                          <span>{stage.isActive ? 'Aktif' : 'Mati'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form Tambah Tahapan Kustom Baru */}
          {showAddForm ? (
            <form
              onSubmit={handleAddCustomStage}
              className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-black text-amber-950 text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Tahapan Kustom Baru</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-amber-800 hover:text-amber-950 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nama Tahapan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Sterilisasi Ozon, Cuci Syariah, QC Akhir..."
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kelompok Status Makro
                  </label>
                  <select
                    value={newStageMacro}
                    onChange={(e) => setNewStageMacro(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-900 focus:outline-none"
                  >
                    {MACRO_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Deskripsi / Petunjuk Pengerjaan
                </label>
                <input
                  type="text"
                  placeholder="Ringkasan instruksi kerja untuk staf operator..."
                  value={newStageDesc}
                  onChange={(e) => setNewStageDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md shadow-amber-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Tambahkan ke Daftar</span>
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-900 text-slate-600 hover:text-blue-900 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer bg-slate-50/50 hover:bg-blue-50/30"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tahapan Kustom Baru</span>
            </button>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
            title="Reset ke 11 tahapan baku SmartOwner"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset ke Standar SmartOwner (11 Tahap)</span>
            <span className="sm:hidden">Reset Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-200 transition-all text-xs cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Tahapan'}</span>
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
