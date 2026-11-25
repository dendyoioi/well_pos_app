import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Phone, Plus, Trash2, Check } from 'lucide-react';
import type { CustomerLaundryPreferences, CustomerPreferencesResponse } from '../../types/laundry_core';
import { laundryCoreApi } from '../../services/api';

interface CustomerPreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  initialPreferences?: CustomerLaundryPreferences | null;
  initialSecondaryPhones?: string[] | null;
  onSaved?: (updated: CustomerPreferencesResponse) => void;
}

export const CustomerPreferenceModal: React.FC<CustomerPreferenceModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  customerPhone,
  initialPreferences,
  initialSecondaryPhones,
  onSaved,
}) => {
  const [allergiesText, setAllergiesText] = useState<string>('');
  const [separateColors, setSeparateColors] = useState<boolean>(false);
  const [preferFoldOrHang, setPreferFoldOrHang] = useState<'FOLD' | 'HANG' | 'MIXED'>('FOLD');
  const [preferPerfume, setPreferPerfume] = useState<string>('');
  const [avoidSoftener, setAvoidSoftener] = useState<boolean>(false);
  const [alwaysExpress, setAlwaysExpress] = useState<boolean>(false);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [secondaryPhones, setSecondaryPhones] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialPreferences) {
        setAllergiesText(Array.isArray(initialPreferences.allergies) ? initialPreferences.allergies.join(', ') : '');
        setSeparateColors(Boolean(initialPreferences.separateColors));
        setPreferFoldOrHang(initialPreferences.preferFoldOrHang || 'FOLD');
        setPreferPerfume(initialPreferences.preferPerfume || '');
        setAvoidSoftener(Boolean(initialPreferences.avoidSoftener));
        setAlwaysExpress(Boolean(initialPreferences.alwaysExpress));
        setCustomNotes(initialPreferences.customNotes || '');
      } else {
        // Fetch fresh from backend jika initialPreferences kosong
        laundryCoreApi
          .getCustomerPreferences(customerId)
          .then((res) => {
            if (res.status === 'success' && res.data) {
              const p = res.data.laundryPreferences || {};
              setAllergiesText(Array.isArray(p.allergies) ? p.allergies.join(', ') : '');
              setSeparateColors(Boolean(p.separateColors));
              setPreferFoldOrHang(p.preferFoldOrHang || 'FOLD');
              setPreferPerfume(p.preferPerfume || '');
              setAvoidSoftener(Boolean(p.avoidSoftener));
              setAlwaysExpress(Boolean(p.alwaysExpress));
              setCustomNotes(p.customNotes || '');
              setSecondaryPhones(res.data.secondaryPhones || []);
            }
          })
          .catch(() => {});
      }
      setSecondaryPhones(Array.isArray(initialSecondaryPhones) ? [...initialSecondaryPhones] : []);
      setErrorMsg(null);
    }
  }, [isOpen, customerId, initialPreferences, initialSecondaryPhones]);

  if (!isOpen) return null;

  const handleAddPhone = () => {
    if (secondaryPhones.length < 3) {
      setSecondaryPhones([...secondaryPhones, '']);
    }
  };

  const handleRemovePhone = (index: number) => {
    setSecondaryPhones(secondaryPhones.filter((_, i) => i !== index));
  };

  const handlePhoneChange = (index: number, val: string) => {
    const updated = [...secondaryPhones];
    updated[index] = val;
    setSecondaryPhones(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const allergies = allergiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const filteredPhones = secondaryPhones
      .map((p) => p.trim())
      .filter(Boolean);

    const payload = {
      laundryPreferences: {
        allergies: allergies.length > 0 ? allergies : undefined,
        separateColors,
        preferFoldOrHang,
        preferPerfume: preferPerfume.trim() || null,
        avoidSoftener,
        alwaysExpress,
        customNotes: customNotes.trim() || null,
      },
      secondaryPhones: filteredPhones,
    };

    try {
      const res = await laundryCoreApi.updateCustomerPreferences(customerId, payload);
      if (res.status === 'success') {
        if (onSaved) onSaved(res.data);
        onClose();
      } else {
        setErrorMsg(res.message || 'Gagal menyimpan preferensi pelanggan');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan koneksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                Preferensi Laundry Pelanggan
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Profil perawatan khusus untuk <span className="font-bold text-slate-800">{customerName}</span>
                {customerPhone ? ` (${customerPhone})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Peringatan Alergi */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Alergi Deterjen / Pewangi (Pisahkan dengan koma)
              </label>
              <input
                type="text"
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
                placeholder="Contoh: Pewangi Mawar, Deterjen Bubuk Keras"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 placeholder:text-slate-400"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Akan muncul badge peringatan merah di kasir dan stasiun cuci saat order diproses.
              </p>
            </div>

            {/* Preferensi Pelipatan / Gantung */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Bentuk Penyelesaian Pakaian
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'FOLD', label: 'Lipat Rapi' },
                  { value: 'HANG', label: 'Gantung (Hanger)' },
                  { value: 'MIXED', label: 'Campuran' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPreferFoldOrHang(item.value as any)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      preferFoldOrHang === item.value
                        ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pilihan Parfum Favorit */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Aroma Parfum Favorit
              </label>
              <input
                type="text"
                value={preferPerfume}
                onChange={(e) => setPreferPerfume(e.target.value)}
                placeholder="Contoh: Lavender, Ocean Fresh, Akasia"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 placeholder:text-slate-400"
              />
            </div>

            {/* Checkbox Opsional */}
            <div className="space-y-2.5 pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={separateColors}
                  onChange={(e) => setSeparateColors(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900"
                />
                <span className="text-xs font-bold text-slate-800">
                  Wajib Pisah Warna (Pakaian luntur / putih dicuci terpisah)
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={avoidSoftener}
                  onChange={(e) => setAvoidSoftener(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900"
                />
                <span className="text-xs font-bold text-slate-800">
                  Hindari Pelembut / Softener (Khusus pakaian olahraga / microfiber)
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alwaysExpress}
                  onChange={(e) => setAlwaysExpress(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900"
                />
                <span className="text-xs font-bold text-slate-800">
                  Pelanggan Selalu Menghendaki Layanan Kilat / Express
                </span>
              </label>
            </div>

            {/* Catatan Khusus */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Catatan Khusus Perawatan
              </label>
              <textarea
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Contoh: Kancing kemeja mudah lepas, jangan gunakan pemutih klorin..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Nomor Telepon / WA Alternatif (Maks 3) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-900" />
                    <span>Nomor HP / WhatsApp Alternatif</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Keluarga, asisten, atau nomor kantor untuk notifikasi status cucian (maks. 3 nomor).
                  </p>
                </div>
                {secondaryPhones.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddPhone}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                )}
              </div>

              {secondaryPhones.length === 0 ? (
                <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-center text-xs text-slate-400">
                  Belum ada nomor sekunder terdaftar.
                </div>
              ) : (
                <div className="space-y-2">
                  {secondaryPhones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => handlePhoneChange(idx, e.target.value)}
                        placeholder={`Nomor Alternatif ${idx + 1} (contoh: +62812345678)`}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhone(idx)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Hapus nomor ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Menyimpan...' : 'Simpan Preferensi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
