import React, { useState, useEffect } from 'react';
import {
  Printer,
  Save,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Monitor,
  Store,
  Bluetooth,
  Zap,
  Power,
  Coins,
  MessageCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { ThermalReceiptPreview } from '../components/ThermalReceiptPreview';
import { useBluetoothPrinter } from '../hooks/useBluetoothPrinter';

interface ReceiptSettingsViewProps {
  activeOutlet: Outlet | null;
  onOutletUpdated?: (updatedOutlet: Outlet) => void;
}

export const ReceiptSettingsView: React.FC<ReceiptSettingsViewProps> = ({
  activeOutlet,
  onOutletUpdated,
}) => {
  const dialog = useDialog();
  const btPrinter = useBluetoothPrinter();
  const [testingBt, setTestingBt] = useState(false);
  const [kickingBt, setKickingBt] = useState(false);
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('58mm');
  const [footerText, setFooterText] = useState('Terima kasih atas kunjungan Anda!\nFollow Instagram kami: @wellpos.id');
  const [showQueueNumber, setShowQueueNumber] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);

  // WhatsApp Gateway Automated Dispatch Settings
  const [waEnabled, setWaEnabled] = useState(false);
  const [waUsePlatformFallback, setWaUsePlatformFallback] = useState(true);
  const [waApiKey, setWaApiKey] = useState('');
  const [waSenderNumber, setWaSenderNumber] = useState('');

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
      if (activeOutlet.receiptConfig.showWatermark !== undefined) {
        setShowWatermark(activeOutlet.receiptConfig.showWatermark !== false);
      } else {
        setShowWatermark(true);
      }
      if (activeOutlet.receiptConfig.whatsappConfig) {
        const w = activeOutlet.receiptConfig.whatsappConfig;
        setWaEnabled(!!w.enabled);
        setWaUsePlatformFallback(w.usePlatformFallback !== false);
        setWaApiKey(w.apiKey || '');
        setWaSenderNumber(w.senderNumber || '');
      } else {
        setWaEnabled(false);
        setWaUsePlatformFallback(true);
        setWaApiKey('');
        setWaSenderNumber('');
      }
    }
  }, [activeOutlet]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
          showWatermark,
          whatsappConfig: {
            enabled: waEnabled,
            provider: 'FONNTE',
            usePlatformFallback: waUsePlatformFallback,
            apiKey: waUsePlatformFallback ? undefined : waApiKey.trim(),
            senderNumber: waSenderNumber.trim() || undefined,
          },
        },
      });

      if (res.status === 'success' && res.data) {
        setSuccessMessage('Format struk thermal kasir berhasil diperbarui!');
        dialog.toast('Format struk thermal kasir berhasil diperbarui!', 'success');
        if (onOutletUpdated) {
          onOutletUpdated(res.data);
        }
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage(res.message || 'Gagal menyimpan pengaturan struk.');
        dialog.toast(res.message || 'Gagal menyimpan pengaturan struk.', 'error');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menyimpan pengaturan struk.');
      dialog.toast(err.message || 'Terjadi kesalahan saat menyimpan pengaturan struk.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectBluetooth = async () => {
    try {
      const ok = await btPrinter.connect();
      if (ok) {
        dialog.toast(`Printer Bluetooth "${btPrinter.deviceName || 'Thermal'}" berhasil terhubung!`, 'success');
      }
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menghubungkan printer Bluetooth', 'error');
    }
  };

  const handleTestPrint = async () => {
    setTestingBt(true);
    try {
      await btPrinter.testPrint(paperSize);
      dialog.toast('Cetak uji coba berhasil dikirim ke printer Bluetooth!', 'success');
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal mengirim cetak uji coba', 'error');
    } finally {
      setTestingBt(false);
    }
  };

  const handleTestKickDrawer = async () => {
    setKickingBt(true);
    try {
      await btPrinter.kickDrawer();
      dialog.toast('Sinyal pemicu laci kasir (ESC/POS 24V) berhasil dikirim!', 'success');
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal memicu laci kasir', 'error');
    } finally {
      setKickingBt(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans">
      {/* Header Kanonikal */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-900" />
              <span>Format Struk & Pengaturan Printer</span>
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1">
              <Store className="w-3 h-3 text-blue-800" />
              Toko: {activeOutlet?.name || 'Utama'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Thermal 58/80mm & WhatsApp E-Receipt
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Kustomisasi tata letak nota belanja kasir, printer thermal Bluetooth (ESC/POS), serta otomasi struk digital via WhatsApp Gateway.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="h-10 px-5 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Format Struk</span>
              </>
            )}
          </button>
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
          {/* 1. Pilihan Lebar Kertas */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-3">
              1. Pilihan Lebar Kertas Thermal Printer
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
                <span className={`text-[10px] font-black mt-3 inline-block px-2 py-0.5 rounded-md w-fit ${
                  paperSize === '58mm'
                    ? 'bg-blue-900 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}>
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
                <span className={`text-[10px] font-black mt-3 inline-block px-2 py-0.5 rounded-md w-fit ${
                  paperSize === '80mm'
                    ? 'bg-blue-900 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {paperSize === '80mm' ? '✓ Pilihan Aktif' : 'Pilih 80mm'}
                </span>
              </button>
            </div>
          </div>

          {/* 2. Koneksi Printer Thermal Bluetooth (Direct 1-Klik) */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Bluetooth className="w-4 h-4 text-blue-900" />
                <span>2. Printer Bluetooth Thermal (1-Klik Cetak Langsung)</span>
              </label>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-3">
              Hubungkan printer thermal fisik Anda (Panda, Goojprt, Iware, RPP02N, Epson, Xprinter) untuk mencetak struk kasir seketika tanpa membuka pop-up print browser.
            </p>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    btPrinter.isConnected
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    <Bluetooth className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        {btPrinter.isConnected
                          ? btPrinter.deviceName || 'Printer Bluetooth Terhubung'
                          : 'Belum Ada Printer Terhubung'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        btPrinter.isConnected
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {btPrinter.isConnected ? '● Terhubung' : 'Terputus'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {btPrinter.isConnected
                        ? 'Siap mencetak langsung via Web Bluetooth API (ESC/POS).'
                        : 'Nyalakan Bluetooth & printer thermal Anda, lalu klik hubungkan.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {btPrinter.isConnected ? (
                    <button
                      type="button"
                      onClick={btPrinter.disconnect}
                      className="h-10 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>Putus</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectBluetooth}
                      disabled={btPrinter.isConnecting}
                      className="h-10 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {btPrinter.isConnecting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mencari Printer...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Hubungkan Printer Bluetooth</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {btPrinter.isConnected && (
                <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    disabled={testingBt}
                    className="h-9 px-3.5 bg-white hover:bg-blue-50 text-blue-900 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{testingBt ? 'Mencetak...' : `Cetak Uji Coba (${paperSize})`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTestKickDrawer}
                    disabled={kickingBt}
                    className="h-9 px-3.5 bg-white hover:bg-amber-50 text-amber-900 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-600" />
                    <span>{kickingBt ? 'Mengirim Sinyal...' : 'Uji Buka Laci Kasir'}</span>
                  </button>
                </div>
              )}

              {btPrinter.lastError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{btPrinter.lastError}</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Informasi Header Outlet */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
              3. Kop &amp; Header Struk (Otomatis dari Profil Toko)
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

          {/* 4. Pengaturan Nomor Antrean / Panggilan Pesanan */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  4. Nomor Antrean / Panggilan Pesanan (#01)
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

          {/* 5. Catatan Kaki (Footer Text) */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
              5. Pesan Footer Struk (Catatan Kaki)
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

          {/* 6. Watermark Struk Kasir ("Powered by Well POS") */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                  6. Watermark Struk (&quot;Powered by Well POS&quot;)
                </label>
                <p className="text-xs text-slate-500 font-medium">
                  Tampilkan identitas branding &quot;Powered by Well POS&quot; di bagian paling bawah struk kasir, nota PDF, cetak printer thermal fisik, dan pesan WhatsApp.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={showWatermark}
                  onChange={(e) => setShowWatermark(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-900"></div>
              </label>
            </div>
          </div>

          {/* 7. Otomasi Pengiriman Struk WhatsApp Gateway (Fonnte API) */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>7. Pengiriman Struk Otomatis via WhatsApp Gateway</span>
                </label>
                <p className="text-xs text-slate-500 font-medium">
                  Kirim nota/struk belanja langsung ke WhatsApp pelanggan saat kasir menyelesaikan checkout secara otomatis tanpa perlu membuka aplikasi WhatsApp.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={waEnabled}
                  onChange={(e) => setWaEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {waEnabled && (
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3.5 animate-in fade-in">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-xs font-extrabold text-emerald-950">
                      Sumber Kuota WhatsApp Gateway
                    </span>
                    <p className="text-[11px] text-emerald-800/80">
                      Pilih apakah menggunakan jalur gateway platform Superadmin atau token Fonnte milik toko sendiri.
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl bg-slate-200/70 p-1 border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setWaUsePlatformFallback(true)}
                      className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        waUsePlatformFallback
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Gateway Platform
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaUsePlatformFallback(false)}
                      className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !waUsePlatformFallback
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Token Pribadi (Fonnte)
                    </button>
                  </div>
                </div>

                {!waUsePlatformFallback && (
                  <div className="space-y-4 pt-2 border-t border-emerald-200/60">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Fonnte API Token Toko Anda
                      </label>
                      <input
                        type="password"
                        value={waApiKey}
                        onChange={(e) => setWaApiKey(e.target.value)}
                        placeholder="Contoh: aBcDeFgHiJkLmNoP123456"
                        className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-hidden"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Token disimpan aman dan terenkripsi untuk mengotorisasi pengiriman struk atas nama nomor toko Anda.
                      </p>
                    </div>

                    {/* Panduan Eksklusif Owner untuk Aktivasi Fonnte */}
                    <div className="p-4 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs space-y-2.5 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 font-black text-emerald-950">
                        <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Panduan Aktivasi WhatsApp Gateway Toko (Fonnte API)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Sebagai Owner, Anda dapat menghubungkan nomor WhatsApp bisnis toko agar kasir dapat mengirim struk belanja pelanggan secara otomatis:
                      </p>
                      <ol className="list-decimal pl-4 space-y-1.5 text-slate-600 text-[11px] leading-relaxed">
                        <li>
                          Buka situs resmi{' '}
                          <a
                            href="https://fonnte.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 font-bold underline inline-flex items-center gap-0.5 hover:text-emerald-800"
                          >
                            fonnte.com <ExternalLink className="w-3 h-3 inline" />
                          </a>{' '}
                          dan daftarkan akun toko Anda.
                        </li>
                        <li>
                          Di dashboard Fonnte, masuk ke menu <strong>Device</strong> lalu lakukan <strong>Scan QR</strong> menggunakan nomor WhatsApp resmi toko hingga status terhubung (<em>Connected</em>).
                        </li>
                        <li>
                          Salin <strong>API Token</strong> perangkat Anda dari dashboard Fonnte.
                        </li>
                        <li>
                          Tempelkan token tersebut pada kolom input di atas, lalu klik tombol <strong>Simpan Format Struk</strong> di bawah.
                        </li>
                        <li>
                          <strong>Selesai!</strong> Kasir di meja pembayaran kini dapat langsung mengirimkan struk otomatis ke nomor pembeli hanya dengan 1 kali klik.
                        </li>
                      </ol>
                    </div>
                  </div>
                )}

                {waUsePlatformFallback && (
                  <div className="text-[11px] text-emerald-900 bg-white/80 p-2.5 rounded-xl border border-emerald-200/60 flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">●</span>
                    <span>
                      Menggunakan jalur integrasi <strong>WhatsApp Gateway Platform (Superadmin)</strong>. Toko tidak perlu mengonfigurasi API token sendiri.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto justify-center h-10 px-6 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-blue-900" />
                <span>Simulasi Struk Fisik</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Pratinjau langsung sesuai lebar kertas thermal kasir aktif</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200">
              {paperSize}
            </span>
          </div>

          <ThermalReceiptPreview
            paperSize={paperSize}
            onPaperSizeChange={setPaperSize}
            brandName={(activeOutlet as any)?.tenant?.name || 'WELL POS CAFE'}
            storeName={activeOutlet?.name || 'Outlet Kemang'}
            address={activeOutlet?.address || 'Jl. Kemang Raya No. 10, Jakarta Selatan'}
            phone={activeOutlet?.phone || '0812-3456-7890'}
            showQueueNumber={showQueueNumber}
            showWatermark={showWatermark}
            footerText={footerText}
            showControls={false}
          />
        </div>
      </div>

      {/* Mobile Sticky Action Footer (Rule 10 Kanonikal) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Pengaturan Struk</span>
          <span className="text-xs font-black text-slate-800 truncate">Kertas {paperSize} {waEnabled ? '+ WA' : ''}</span>
        </div>
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving}
          className="h-10 px-5 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Menyimpan...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Simpan Struk</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

