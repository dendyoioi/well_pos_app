import React, { useState, useEffect } from 'react';
import {
  Award,
  Save,
  Coins,
  ShieldAlert,
  Sparkles,
  Store,
  Loader2,
} from 'lucide-react';
import type { Outlet, OutletLoyaltyConfig } from '../types/outlet';
import { api } from '../services/api';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { formatRupiah } from '../utils/currency';
import { useDialog } from '../context/DialogContext';

interface LoyaltySettingsViewProps {
  activeOutlet: Outlet | null;
  onOutletUpdated?: (updatedOutlet: Outlet) => void;
}

export const LoyaltySettingsView: React.FC<LoyaltySettingsViewProps> = ({
  activeOutlet,
  onOutletUpdated,
}) => {
  const dialog = useDialog();

  const [isActive, setIsActive] = useState<boolean>(false);
  const [pointsPerSpend, setPointsPerSpend] = useState<number>(10000);
  const [pointValueIdr, setPointValueIdr] = useState<number>(100);
  const [minPointsToRedeem, setMinPointsToRedeem] = useState<number>(10);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (activeOutlet?.loyaltyConfig) {
      setIsActive(activeOutlet.loyaltyConfig.isActive ?? false);
      setPointsPerSpend(activeOutlet.loyaltyConfig.pointsPerSpend || 10000);
      setPointValueIdr(activeOutlet.loyaltyConfig.pointValueIdr || 100);
      setMinPointsToRedeem(activeOutlet.loyaltyConfig.minPointsToRedeem || 10);
    } else {
      setIsActive(false);
      setPointsPerSpend(10000);
      setPointValueIdr(100);
      setMinPointsToRedeem(10);
    }
  }, [activeOutlet]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet) {
      dialog.alert({
        title: 'Pilih Outlet Toko',
        message: 'Pilih outlet toko aktif terlebih dahulu.',
        variant: 'warning',
      });
      return;
    }

    setSaving(true);
    try {
      const loyaltyConfigPayload: OutletLoyaltyConfig = {
        isActive,
        pointsPerSpend: Math.max(1000, Number(pointsPerSpend)),
        pointValueIdr: Math.max(1, Number(pointValueIdr)),
        minPointsToRedeem: Math.max(1, Number(minPointsToRedeem)),
      };

      const res = await api.updateOutlet(activeOutlet.id, {
        loyaltyConfig: loyaltyConfigPayload,
      });

      if (res.status === 'success' && res.data) {
        if (onOutletUpdated) {
          onOutletUpdated(res.data);
        }
        dialog.toast(
          `Pengaturan loyalitas untuk ${activeOutlet.name} berhasil disimpan (${isActive ? 'AKTIF' : 'NON-AKTIF'})`,
          'success'
        );
      } else {
        dialog.alert({
          title: 'Gagal Menyimpan',
          message: res.message || 'Gagal menyimpan pengaturan loyalitas toko.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Terjadi kesalahan sistem saat memperbarui loyalitas.',
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const sampleSpend = 100000;
  const samplePointsEarned = Math.floor(sampleSpend / (pointsPerSpend || 10000));
  const sampleRedeemPoints = minPointsToRedeem || 10;
  const sampleRedeemDiscount = sampleRedeemPoints * (pointValueIdr || 100);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-28 sm:pb-16 font-sans animate-in fade-in duration-300">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-900 flex items-center justify-center font-bold shrink-0">
              <Award className="w-5 h-5 text-amber-600 shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Program Loyalitas &amp; Poin Member
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  Per-Outlet
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
                Atur aktivasi program poin, aturan perolehan belanja, dan penukaran diskon khusus untuk toko ini
              </p>
            </div>
          </div>
        </div>

        {/* Current Active Outlet Badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs shrink-0 self-start sm:self-auto">
          <Store className="w-4 h-4 text-blue-900" />
          <span className="text-blue-950 font-medium">Toko:</span>
          <span className="font-extrabold text-blue-900">{activeOutlet?.name || 'Belum Dipilih'}</span>
        </div>
      </div>

      {/* 2. Main Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Toggle Box Aktif / Non-aktif */}
        <div className={`p-5 sm:p-6 rounded-3xl border transition-all ${
          isActive 
            ? 'bg-blue-50/30 border-blue-200 shadow-xs' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm sm:text-base text-slate-900">
                  Status Program Loyalitas di {activeOutlet?.name || 'Toko Ini'}
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {isActive ? 'Aktif' : 'Non-Aktif'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                {isActive
                  ? 'Pelanggan dapat mengumpulkan poin reward saat belanja dan kasir dapat menukarkan poin untuk potongan harga di toko ini.'
                  : 'Program loyalitas dinonaktifkan di toko ini. Transaksi kasir tidak akan menambah atau menukar poin member.'}
              </p>
            </div>

            {/* Canonical Pill Toggle Switch */}
            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              <span className={`text-xs font-bold ${isActive ? 'text-blue-900' : 'text-slate-400'}`}>
                {isActive ? 'Aktif' : 'Off'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  isActive ? 'bg-blue-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Konfigurasi Aturan Poin (Tampil saat Aktif) */}
        {isActive ? (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Coins className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  Formula Perolehan &amp; Nilai Tukar Poin
                </h2>
                <p className="text-xs text-slate-500">Tentukan aturan konversi belanja ke poin dan nilai rupiah diskon</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Rasio Perolehan Poin */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Nominal Belanja per 1 Poin</span>
                  <span className="text-[11px] text-slate-400 font-semibold">Perolehan</span>
                </label>
                <CurrencyInput
                  value={pointsPerSpend}
                  onChange={(val) => setPointsPerSpend(val)}
                  placeholder="10000"
                  className="w-full h-10 text-xs font-mono font-semibold rounded-xl border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10"
                />
                <span className="text-[11px] text-slate-500 block leading-tight">
                  Setiap pembelanjaan <strong className="font-mono text-slate-800">{formatRupiah(pointsPerSpend || 10000)}</strong> bernilai 1 Poin loyalitas.
                </span>
              </div>

              {/* Nilai Tukar Rupiah per Poin */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Nilai Potongan per 1 Poin</span>
                  <span className="text-[11px] text-slate-400 font-semibold">Penukaran</span>
                </label>
                <CurrencyInput
                  value={pointValueIdr}
                  onChange={(val) => setPointValueIdr(val)}
                  placeholder="100"
                  className="w-full h-10 text-xs font-mono font-semibold rounded-xl border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10"
                />
                <span className="text-[11px] text-slate-500 block leading-tight">
                  1 Poin dapat ditukarkan senilai <strong className="font-mono text-slate-800">{formatRupiah(pointValueIdr || 100)}</strong> potongan belanja.
                </span>
              </div>

              {/* Minimal Poin Ditukar */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Minimal Poin untuk Ditukar</span>
                  <span className="text-[11px] text-slate-400 font-semibold">Ambang Batas</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={minPointsToRedeem}
                    onChange={(e) => setMinPointsToRedeem(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-10 text-xs font-mono font-semibold rounded-xl border border-slate-300 px-3.5 pr-14 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                    Poin
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block leading-tight">
                  Pelanggan minimal harus menukarkan <strong className="font-mono text-slate-800">{minPointsToRedeem} Poin</strong> (<span className="font-mono font-bold text-slate-800">{formatRupiah(sampleRedeemDiscount)}</span>).
                </span>
              </div>
            </div>

            {/* Live Calculation Preview Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Simulasi Alur Kasir:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="p-3.5 bg-white rounded-xl border border-slate-200/70 shadow-xs">
                  <span className="text-slate-400 block text-[11px] font-semibold mb-1">Saat Pelanggan Belanja:</span>
                  <span className="font-medium text-slate-800 block">
                    Belanja <b className="font-mono text-blue-900">{formatRupiah(sampleSpend)}</b> ➔ Mendapatkan <b className="font-mono text-emerald-700">+{samplePointsEarned} Poin</b>
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-slate-200/70 shadow-xs">
                  <span className="text-slate-400 block text-[11px] font-semibold mb-1">Saat Menukarkan Poin:</span>
                  <span className="font-medium text-slate-800 block">
                    Tukar <b className="font-mono text-amber-700">{sampleRedeemPoints} Poin</b> ➔ Diskon Potongan <b className="font-mono text-blue-900">-{formatRupiah(sampleRedeemDiscount)}</b>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block text-sm">Toko Ini Menjalankan Mode Kasir Standar</span>
              <p className="mt-1 leading-relaxed text-slate-500">
                Ketika fitur ini dinonaktifkan, kasir di toko <strong>{activeOutlet?.name || 'Utama'}</strong> tetap dapat memilih pelanggan untuk mencatat profil dan riwayat order CRM, namun opsi penukaran poin tidak akan ditampilkan di layar kasir, dan order tidak akan memicu kalkulasi perolehan poin.
              </p>
            </div>
          </div>
        )}

        {/* Desktop Submit Button */}
        <div className="hidden sm:flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-900/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Loyalitas Toko'}</span>
          </button>
        </div>

        {/* Mobile Sticky Action Footer (Rule 10 AGENTS.md) */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full h-11 inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Loyalitas Toko'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

