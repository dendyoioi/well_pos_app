import React, { useState, useEffect } from 'react';
import {
  Award,
  Save,
  Coins,
  ShieldAlert,
  Sparkles,
  Store,
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
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-900 flex items-center justify-center font-bold">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Program Loyalitas &amp; Poin Member
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Per-Outlet
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Atur aktivasi program poin, aturan perolehan belanja, dan penukaran diskon khusus untuk toko ini
              </p>
            </div>
          </div>
        </div>

        {/* Current Active Outlet Badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs shrink-0 self-start sm:self-auto">
          <Store className="w-4 h-4 text-blue-900" />
          <span className="text-slate-500">Toko Terpilih:</span>
          <span className="font-bold text-slate-900">{activeOutlet?.name || 'Belum Dipilih'}</span>
        </div>
      </div>

      {/* 2. Main Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Toggle Box Aktif / Non-aktif */}
        <div className={`p-6 rounded-2xl border transition-all ${
          isActive 
            ? 'bg-emerald-50/50 border-emerald-200/80' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-slate-900">
                  Status Program Loyalitas di {activeOutlet?.name || 'Toko Ini'}
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {isActive ? 'Aktif' : 'Non-Aktif'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {isActive
                  ? 'Pelanggan dapat mengumpulkan poin reward saat belanja dan kasir dapat menukarkan poin untuk potongan harga di toko ini.'
                  : 'Program loyalitas dinonaktifkan di toko ini. Transaksi kasir tidak akan menambah atau menukar poin member.'}
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-hidden peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Konfigurasi Aturan Poin (Tampil saat Aktif) */}
        {isActive ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <Coins className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-black text-slate-900">
                Formula Perolehan &amp; Nilai Tukar Poin
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Rasio Perolehan Poin */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Nominal Belanja per 1 Poin</span>
                  <span className="text-[11px] text-slate-400 font-normal">Perolehan</span>
                </label>
                <CurrencyInput
                  value={pointsPerSpend}
                  onChange={(val) => setPointsPerSpend(val)}
                  placeholder="10000"
                  className="w-full text-sm font-semibold rounded-xl border-slate-300 focus:border-blue-900 focus:ring-blue-900/10"
                />
                <span className="text-[11px] text-slate-500 block">
                  Setiap pembelanjaan {formatRupiah(pointsPerSpend || 10000)} bernilai 1 Poin loyalitas.
                </span>
              </div>

              {/* Nilai Tukar Rupiah per Poin */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Nilai Potongan per 1 Poin</span>
                  <span className="text-[11px] text-slate-400 font-normal">Penukaran</span>
                </label>
                <CurrencyInput
                  value={pointValueIdr}
                  onChange={(val) => setPointValueIdr(val)}
                  placeholder="100"
                  className="w-full text-sm font-semibold rounded-xl border-slate-300 focus:border-blue-900 focus:ring-blue-900/10"
                />
                <span className="text-[11px] text-slate-500 block">
                  1 Poin dapat ditukarkan senilai {formatRupiah(pointValueIdr || 100)} potongan belanja.
                </span>
              </div>

              {/* Minimal Poin Ditukar */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Minimal Poin untuk Ditukar</span>
                  <span className="text-[11px] text-slate-400 font-normal">Ambang Batas</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={minPointsToRedeem}
                    onChange={(e) => setMinPointsToRedeem(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-sm font-semibold rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10"
                  />
                  <span className="absolute right-3 top-3 text-xs font-bold text-slate-400 pointer-events-none">
                    Poin
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block">
                  Pelanggan minimal harus menukarkan {minPointsToRedeem} Poin ({formatRupiah(sampleRedeemDiscount)}).
                </span>
              </div>
            </div>

            {/* Live Calculation Preview Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Simulasi Alur Kasir:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="p-3 bg-white rounded-lg border border-slate-200/60">
                  <span className="text-slate-400 block text-[11px]">Saat Pelanggan Belanja:</span>
                  <span className="font-medium text-slate-800 mt-1 block">
                    Belanja <b>{formatRupiah(sampleSpend)}</b> ➔ Mendapatkan <b>+{samplePointsEarned} Poin</b>
                  </span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200/60">
                  <span className="text-slate-400 block text-[11px]">Saat Menukarkan Poin:</span>
                  <span className="font-medium text-slate-800 mt-1 block">
                    Tukar <b>{sampleRedeemPoints} Poin</b> ➔ Diskon Potongan <b>-{formatRupiah(sampleRedeemDiscount)}</b>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-100/70 border border-slate-200 text-slate-600 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 block text-sm">Toko Ini Menjalankan Mode Kasir Standar</span>
              <p className="mt-1 leading-relaxed">
                Ketika fitur ini dinonaktifkan, kasir di toko <b>{activeOutlet?.name}</b> tetap dapat memilih pelanggan untuk mencatat profil dan riwayat order CRM, namun opsi penukaran poin tidak akan ditampilkan di layar kasir, dan order tidak akan memicu kalkulasi perolehan poin.
              </p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 sm:py-3 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-sm shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Loyalitas Toko'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
