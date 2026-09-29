import React, { useState, useEffect } from 'react';
import {
  Printer,
  Save,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Monitor,
  Store,
  RefreshCw,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';

interface ReceiptSettingsViewProps {
  activeOutlet: Outlet | null;
  onOutletUpdated?: (updatedOutlet: Outlet) => void;
}

export const ReceiptSettingsView: React.FC<ReceiptSettingsViewProps> = ({
  activeOutlet,
  onOutletUpdated,
}) => {
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('58mm');
  const [footerText, setFooterText] = useState('Terima kasih atas kunjungan Anda!\nFollow Instagram kami: @wellpos.id');
  const [showQueueNumber, setShowQueueNumber] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeOutlet?.receiptConfig) {
      if (activeOutlet.receiptConfig.paperSize) {
        setPaperSize(activeOutlet.receiptConfig.paperSize);
      }
      if (activeOutlet.receiptConfig.footerText !== undefined) {
        setFooterText(activeOutlet.receiptConfig.footerText);
      }
      if (activeOutlet.receiptConfig.showQueueNumber !== undefined) {
        setShowQueueNumber(activeOutlet.receiptConfig.showQueueNumber);
      }
    }
  }, [activeOutlet]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet) {
      setErrorMessage('Pilih outlet toko terlebih dahulu.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await api.updateOutlet(activeOutlet.id, {
        receiptConfig: {
          paperSize,
          footerText: footerText.trim(),
          showQueueNumber,
        },
      });

      if (res.status === 'success' && res.data) {
        setSuccessMessage('Format struk thermal kasir berhasil diperbarui!');
        if (onOutletUpdated) {
          onOutletUpdated(res.data);
        }
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage(res.message || 'Gagal menyimpan pengaturan struk.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menyimpan pengaturan struk.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-900" />
              <span>Format Struk Kasir Thermal (58mm / 80mm)</span>
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1">
              <Store className="w-3 h-3 text-blue-800" />
              Toko: {activeOutlet?.name || 'Utama'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Kustomisasi tata letak nota belanja kasir, pilihan lebar kertas thermal printer, serta pesan penutup / catatan kaki struk.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Pengaturan (Kiri - 7 Kolom) */}
        <form onSubmit={handleSave} className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          {/* Pilihan Lebar Kertas */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-3">
              1. Pilih Lebar Kertas Thermal Printer
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setPaperSize('58mm')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  paperSize === '58mm'
                    ? 'border-blue-900 bg-blue-50/50 ring-2 ring-blue-900/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">58 mm</span>
                  <Smartphone className="w-4 h-4 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  Ukuran ringkas. Ideal untuk printer Bluetooth portable, kasir mobile, dan EDC mini.
                </p>
                <span className="text-[10px] font-black text-blue-900 mt-3 inline-block">
                  {paperSize === '58mm' ? '✓ Pilihan Aktif' : 'Pilih 58mm'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaperSize('80mm')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  paperSize === '80mm'
                    ? 'border-blue-900 bg-blue-50/50 ring-2 ring-blue-900/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">80 mm</span>
                  <Monitor className="w-4 h-4 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  Ukuran standar lebar. Ideal untuk printer desktop thermal kasir restoran (USB / LAN / Wi-Fi).
                </p>
                <span className="text-[10px] font-black text-blue-900 mt-3 inline-block">
                  {paperSize === '80mm' ? '✓ Pilihan Aktif' : 'Pilih 80mm'}
                </span>
              </button>
            </div>
          </div>

          {/* Informasi Header Outlet */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
              2. Kop &amp; Header Struk (Otomatis dari Profil Toko)
            </label>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Nama Bisnis:</span>
                <span className="font-extrabold text-slate-900">{(activeOutlet as any)?.tenant?.name || 'Well POS Coffee'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Nama Toko:</span>
                <span className="font-bold text-slate-800">{activeOutlet?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Alamat:</span>
                <span className="font-medium text-slate-700 max-w-xs text-right truncate">{activeOutlet?.address || 'Jl. Kemang Raya No. 10'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">No. Telepon:</span>
                <span className="font-medium text-slate-700">{activeOutlet?.phone || '0812-3456-7890'}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
              * Untuk mengubah nama atau alamat di atas, silakan edit melalui menu <strong>Kelola Toko</strong>.
            </p>
          </div>

          {/* Pengaturan Nomor Antrean / Panggilan Pesanan */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  3. Nomor Antrean / Panggilan Pesanan (#01)
                </label>
                <p className="text-xs text-slate-500 font-medium">
                  Cetak nomor panggilan berukuran besar di atas struk kasir dan tampilkan di layar kasir untuk memudahkan barista/pelayan memanggil pelanggan secara cepat tanpa perlu input nama/meja.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={showQueueNumber}
                  onChange={(e) => setShowQueueNumber(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-900"></div>
              </label>
            </div>
          </div>

          {/* Catatan Kaki (Footer Text) */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
              4. Pesan Footer Struk (Catatan Kaki)
            </label>
            <p className="text-xs text-slate-500 mb-2 font-medium">
              Teks yang tercetak di bagian paling bawah struk belanja kasir.
            </p>
            <textarea
              rows={3}
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Contoh: Terima kasih atas kunjungan Anda!\nFollow Instagram kami: @toko.anda"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 outline-hidden font-mono"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto justify-center px-6 py-3 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Format Struk...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Format Struk</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Thermal Receipt Simulator (Kanan - 5 Kolom) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-blue-900" />
              <span>Simulasi Struk ({paperSize})</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Live Preview
            </span>
          </div>

          {/* Paper Receipt Container */}
          <div className="flex justify-center p-2">
            <div
              className={`bg-amber-50/40 border border-slate-300 rounded-xl p-5 shadow-inner text-slate-900 font-mono text-[11px] leading-tight space-y-3 transition-all ${
                paperSize === '58mm' ? 'w-64 max-w-full text-[10px]' : 'w-80 max-w-full text-[11px]'
              }`}
            >
              {/* Header */}
              <div className="text-center space-y-1">
                <div className="font-black text-sm uppercase tracking-wide">
                  {(activeOutlet as any)?.tenant?.name || 'WELL POS CAFE'}
                </div>
                <div className="font-bold text-[10px] text-slate-700">
                  {activeOutlet?.name || 'Toko Utama'}
                </div>
                <div className="text-[9px] text-slate-600 leading-snug">
                  {activeOutlet?.address || 'Jl. Kemang Raya No. 10, Jakarta Selatan'}
                </div>
                <div className="text-[9px] text-slate-600">
                  Telp: {activeOutlet?.phone || '0812-3456-7890'}
                </div>
              </div>

              {/* Dotted Divider */}
              <div className="border-b border-dashed border-slate-400 my-2" />

              {/* Nomor Antrean Panggilan Box (Jika Aktif) */}
              {showQueueNumber && (
                <div className="border-2 border-dashed border-slate-800 p-2 my-1.5 rounded-sm text-center bg-white/70">
                  <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-600">
                    NOMOR ANTRIAN
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 tracking-wider">
                    #05
                  </div>
                </div>
              )}

              {/* Order Meta */}
              <div className="space-y-0.5 text-[9px] text-slate-600">
                <div className="flex justify-between">
                  <span>No: INV-20260923-001</span>
                  <span>14:32</span>
                </div>
                <div className="flex justify-between">
                  <span>Kasir: Rian Kasir</span>
                  <span>Meja: 05</span>
                </div>
              </div>

              {/* Dotted Divider */}
              <div className="border-b border-dashed border-slate-400 my-2" />

              {/* Items List */}
              <div className="space-y-1.5">
                <div>
                  <div className="font-bold">Kopi Susu Aren Ura</div>
                  <div className="flex justify-between text-slate-600">
                    <span>2 x 22.000</span>
                    <span className="font-bold text-slate-900">44.000</span>
                  </div>
                  <div className="text-[9px] text-slate-500 pl-2">+ Extra Shot (2 x 5.000)</div>
                </div>

                <div>
                  <div className="font-bold">Croissant Butter Almond</div>
                  <div className="flex justify-between text-slate-600">
                    <span>1 x 28.000</span>
                    <span className="font-bold text-slate-900">28.000</span>
                  </div>
                </div>
              </div>

              {/* Dotted Divider */}
              <div className="border-b border-dashed border-slate-400 my-2" />

              {/* Totals */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>82.000</span>
                </div>
                <div className="flex justify-between">
                  <span>Pajak Resto (PB1 10%):</span>
                  <span>8.200</span>
                </div>
                <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-300">
                  <span>TOTAL:</span>
                  <span>Rp 90.200</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 pt-0.5">
                  <span>QRIS LUNAS:</span>
                  <span>90.200</span>
                </div>
              </div>

              {/* Dotted Divider */}
              <div className="border-b border-dashed border-slate-400 my-2" />

              {/* Footer Note */}
              <div className="text-center text-[9px] text-slate-600 whitespace-pre-line leading-relaxed">
                {footerText || 'Terima kasih atas kunjungan Anda!'}
              </div>

              <div className="text-center text-[8px] text-slate-400 pt-1">
                Powered by Well POS
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
