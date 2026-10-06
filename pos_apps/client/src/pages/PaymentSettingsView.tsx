import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Upload,
  Trash2,
  Save,
  Building2,
  Store,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Eye,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { Outlet, PaymentConfig, QrisConfig } from '../types/outlet';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { compressImage } from '../utils/imageCompressor';

interface PaymentSettingsViewProps {
  activeOutlet: Outlet | null;
  onOutletUpdated?: (updatedOutlet: Outlet) => void;
  currentUserRole?: string;
}

export const PaymentSettingsView: React.FC<PaymentSettingsViewProps> = ({
  activeOutlet,
  onOutletUpdated,
}) => {
  const dialog = useDialog();
  const [isSaving, setIsSaving] = useState(false);

  const currentQris: QrisConfig = activeOutlet?.paymentConfig?.qris || {
    isActive: true,
    imageUrl: null,
  };

  const [isActive, setIsActive] = useState<boolean>(currentQris.isActive ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(currentQris.imageUrl || null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Sinkronisasi saat activeOutlet berubah
  useEffect(() => {
    if (activeOutlet) {
      const q = activeOutlet.paymentConfig?.qris;
      setIsActive(q?.isActive ?? true);
      setImageUrl(q?.imageUrl || null);
    }
  }, [activeOutlet?.id, activeOutlet?.paymentConfig]);

  // Handler Upload Gambar dengan Kompresi Otomatis di Browser
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      dialog.alert({
        title: 'Format Berkas Salah',
        message: 'Mohon unggah berkas gambar dengan format PNG, JPG, JPEG, atau WebP.',
        variant: 'warning',
      });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      dialog.alert({
        title: 'Ukuran Terlalu Besar',
        message: 'Ukuran berkas gambar maksimal adalah 15 MB.',
        variant: 'warning',
      });
      return;
    }

    setIsCompressing(true);
    try {
      // Untuk barcode QRIS, 800px dengan kualitas 0.85 memastikan barcode terbaca tajam oleh kamera
      const result = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.85,
        mimeType: 'image/webp',
      });
      setImageUrl(result.dataUrl);
      dialog.toast('Foto barcode QRIS berhasil diunggah', 'success');
    } catch (err: any) {
      dialog.alert({
        title: 'Gagal Memproses Berkas',
        message: err?.message || 'Terjadi kendala saat membaca berkas gambar. Silakan coba lagi.',
        variant: 'danger',
      });
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  // Hapus Gambar
  const handleRemoveImage = () => {
    setImageUrl(null);
    dialog.toast('Gambar QRIS telah dikosongkan.', 'info');
  };

  // Simpan Pengaturan ke Backend
  const handleSaveConfig = async () => {
    if (!activeOutlet) return;
    setIsSaving(true);

    try {
      const updatedQris: QrisConfig = {
        isActive,
        imageUrl: imageUrl || null,
      };

      const updatedPaymentConfig: PaymentConfig = {
        ...(activeOutlet.paymentConfig || {}),
        qris: updatedQris,
      };

      const res = await api.updateOutletPaymentConfig(activeOutlet.id, updatedPaymentConfig);

      if (res.status === 'success') {
        if (onOutletUpdated) {
          onOutletUpdated({
            ...activeOutlet,
            paymentConfig: updatedPaymentConfig,
          });
        }
        dialog.toast('Pengaturan QRIS Toko berhasil disimpan!', 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menyimpan',
          message: res.message || 'Terjadi kesalahan saat menyimpan pengaturan.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Gagal menghubungi server.',
        variant: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeOutlet) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Store className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-bold text-slate-700">Pilih Toko Terlebih Dahulu</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Silakan pilih outlet toko di bilah atas untuk mengelola konfigurasi QRIS.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* HEADER UTAMA */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 shadow-xs">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Metode Pembayaran &amp; QRIS Statis Toko
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <Building2 className="w-3 h-3" />
                  Toko: {activeOutlet.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Unggah gambar barcode QRIS resmi toko Anda agar kasir dapat menampilkannya langsung kepada konsumen saat checkout di terminal POS.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
        >
          {isSaving ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Menyimpan...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Simpan Pengaturan</span>
            </>
          )}
        </button>
      </div>

      {/* BANNER EDUKASI QRIS STATIS */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/80 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs">
          <p className="font-bold text-blue-950">Panduan QRIS Statis Standar Bank Indonesia (ASPI MPM):</p>
          <p className="text-blue-900/80 leading-relaxed">
            QRIS Statis (<em>Merchant-Presented Mode</em>) memungkinkan konsumen memindai satu kode QR toko menggunakan seluruh aplikasi pembayaran (BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay, DANA, dll). Konsumen memasukkan nominal sesuai total tagihan di layar kasir, lalu kasir memverifikasi notifikasi berhasil sebelum menyelesaikan pesanan.
          </p>
        </div>
      </div>

      {/* GRID DUA KOLOM: FORM SETTINGS & LIVE PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KOLOM KIRI: FORM PENGATURAN */}
        <div className="lg:col-span-7 space-y-6">
          {/* TOGGLE STATUS */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-700" />
                  Status Metode QRIS di Kasir
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tampilkan tombol pilihan pembayaran "QRIS" di jendela checkout kasir POS.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* UPLOAD FOTO QRIS */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-700" />
                Unggah Berkas Gambar QRIS Statis
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unggah foto atau scan barcode QRIS yang Anda terima dari Bank atau mitra e-wallet Anda.
              </p>
            </div>

            {/* DROPZONE / FILE PREVIEW */}
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/20 rounded-2xl p-8 text-center transition-all">
              {imageUrl ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-[200px] overflow-hidden">
                      <img
                        src={imageUrl}
                        alt="QRIS Preview"
                        className="w-full h-auto object-contain max-h-48 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer shadow-2xs transition-all">
                      {isCompressing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Ganti Gambar</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleFileChange}
                        disabled={isCompressing}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={isCompressing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
                    {isCompressing ? (
                      <Loader2 className="w-7 h-7 animate-spin text-blue-700" />
                    ) : (
                      <Upload className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    {isCompressing ? (
                      <p className="text-xs font-bold text-blue-800 animate-pulse">
                        Sedang memproses gambar barcode...
                      </p>
                    ) : (
                      <>
                        <label className="text-xs font-bold text-blue-700 hover:text-blue-800 cursor-pointer underline underline-offset-2">
                          Pilih berkas dari komputer
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                        <span className="text-xs text-slate-500"> atau seret ke area ini</span>
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          Mendukung PNG, JPG, JPEG, WebP (Maksimal 15 MB)
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* INFO PANDUAN */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <strong>Tips:</strong> Gunakan foto/scan barcode QRIS yang Anda terima langsung dari bank atau dompet digital penyedia QRIS Anda (BCA, Mandiri, GoPay, dll). Gambar akan otomatis dioptimasi agar tetap tajam saat discan namun sangat ringan dimuat di terminal kasir.
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: PRATINJAU KARTU QRIS DI KASIR */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Pratinjau Layar Kasir POS
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Preview
              </span>
            </div>

            {/* MOCK CASHIER CARD */}
            <div className="mt-4 p-4 bg-slate-100 border border-slate-200 rounded-2xl flex flex-col items-center">
              <div className="w-full max-w-[260px] bg-white p-4 border border-slate-300 rounded-2xl shadow-md flex flex-col items-center space-y-3">
                {/* Label QRIS */}
                <div className="w-full flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <span className="text-xs font-black tracking-wider text-rose-700">QRIS</span>
                  <span className="text-[9px] font-semibold text-slate-400">PEMBAYARAN</span>
                </div>

                {/* Barcode Image */}
                <div className="w-48 h-48 bg-slate-50 p-2 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Barcode QRIS Toko"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-3">
                      <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-1 stroke-[1.5]" />
                      <p className="text-[10px] font-bold text-slate-500">QRIS Belum Diunggah</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Upload gambar QRIS di panel kiri.
                      </p>
                    </div>
                  )}
                </div>

                {/* Total Tagihan */}
                <div className="w-full bg-blue-50 py-1.5 px-3 rounded-xl border border-blue-100 flex items-center justify-between">
                  <span className="text-[10px] text-blue-950 font-bold">Total Tagihan:</span>
                  <span className="text-xs font-black text-blue-950 font-mono">Rp 57.500</span>
                </div>

                <div className="w-full text-center">
                  <p className="text-[9px] text-slate-400">
                    Dapat dipindai via GoPay, BCA, OVO, ShopeePay, DANA, dll.
                  </p>
                </div>
              </div>

              {/* Alur Kasir */}
              <div className="mt-3 w-full bg-white/80 p-2.5 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Alur Kasir:</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  Tunjukkan barcode ke konsumen → Konsumen scan &amp; masukkan nominal → Kasir cek notifikasi masuk → Tekan Selesaikan Transaksi di POS.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
