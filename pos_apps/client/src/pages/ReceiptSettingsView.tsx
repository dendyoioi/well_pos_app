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
  Usb,
  Sliders,
  Zap,
  Power,
  Coins,
  MessageCircle,
  ExternalLink,
  Loader2,
  Tag,
  Coffee,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { ThermalReceiptPreview } from '../components/ThermalReceiptPreview';
import { CupLabelPreview } from '../components/CupLabelPreview';
import { useThermalPrinterHub } from '../hooks/useThermalPrinterHub';
import { ThermalPrinterModal } from '../components/pos/ThermalPrinterModal';

interface ReceiptSettingsViewProps {
  activeOutlet: Outlet | null;
  onOutletUpdated?: (updatedOutlet: Outlet) => void;
}

export const ReceiptSettingsView: React.FC<ReceiptSettingsViewProps> = ({
  activeOutlet,
  onOutletUpdated,
}) => {
  const dialog = useDialog();
  const printerHub = useThermalPrinterHub();
  const [hardwareModalOpen, setHardwareModalOpen] = useState(false);
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

  // Cup Label Sticker Settings (Barista F&B Setup - Opt-in)
  const [cupLabelEnabled, setCupLabelEnabled] = useState(false);
  const [cupLabelPaperSize, setCupLabelPaperSize] = useState<'40x30mm' | '50x30mm' | '40x20mm' | '50x40mm'>('40x30mm');
  const [cupLabelAutoPrint, setCupLabelAutoPrint] = useState(true);
  const [cupLabelOnlyBeverages, setCupLabelOnlyBeverages] = useState(true);
  const [cupLabelShowStoreName, setCupLabelShowStoreName] = useState(true);
  const [cupLabelShowCustomerName, setCupLabelShowCustomerName] = useState(true);
  const [cupLabelShowModifiers, setCupLabelShowModifiers] = useState(true);
  const [testingLabel, setTestingLabel] = useState(false);

  // Preview simulator view tab (Receipt vs Cup Label)
  const [previewTab, setPreviewTab] = useState<'receipt' | 'cupLabel'>('receipt');

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

      if (activeOutlet.receiptConfig.cupLabelConfig) {
        const c = activeOutlet.receiptConfig.cupLabelConfig;
        setCupLabelEnabled(!!c.enabled);
        if (c.paperSize) setCupLabelPaperSize(c.paperSize);
        setCupLabelAutoPrint(c.autoPrintOnCheckout !== false);
        setCupLabelOnlyBeverages(c.onlyBeverages !== false);
        setCupLabelShowStoreName(c.showStoreName !== false);
        setCupLabelShowCustomerName(c.showCustomerName !== false);
        setCupLabelShowModifiers(c.showModifiers !== false);
      } else {
        setCupLabelEnabled(false);
        setCupLabelPaperSize('40x30mm');
        setCupLabelAutoPrint(true);
        setCupLabelOnlyBeverages(true);
        setCupLabelShowStoreName(true);
        setCupLabelShowCustomerName(true);
        setCupLabelShowModifiers(true);
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
          cupLabelConfig: {
            enabled: cupLabelEnabled,
            paperSize: cupLabelPaperSize,
            autoPrintOnCheckout: cupLabelAutoPrint,
            onlyBeverages: cupLabelOnlyBeverages,
            showStoreName: cupLabelShowStoreName,
            showCustomerName: cupLabelShowCustomerName,
            showModifiers: cupLabelShowModifiers,
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
      const ok = await printerHub.connectBluetooth();
      if (ok) {
        dialog.toast(`Printer Bluetooth "${printerHub.deviceName || 'Thermal'}" berhasil terhubung!`, 'success');
      }
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menghubungkan printer Bluetooth', 'error');
    }
  };

  const handleConnectUsb = async () => {
    try {
      const ok = await printerHub.connectUsb();
      if (ok) {
        dialog.toast(`Printer USB "${printerHub.deviceName || 'Thermal'}" berhasil terhubung!`, 'success');
      }
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menghubungkan printer USB', 'error');
    }
  };

  const handleTestPrint = async () => {
    setTestingBt(true);
    try {
      await printerHub.testPrint(paperSize);
      dialog.toast('Cetak uji coba berhasil dikirim ke printer!', 'success');
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal mengirim cetak uji coba', 'error');
    } finally {
      setTestingBt(false);
    }
  };

  const handleTestKickDrawer = async () => {
    setKickingBt(true);
    try {
      await printerHub.kickCashDrawer();
      dialog.toast('Sinyal pemicu laci kasir (ESC/POS 24V) berhasil dikirim!', 'success');
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal memicu laci kasir', 'error');
    } finally {
      setKickingBt(false);
    }
  };

  const handleConnectLabelBluetooth = async () => {
    try {
      const ok = await printerHub.connectLabelBluetooth();
      if (ok) {
        dialog.toast(`Printer Label Bluetooth "${printerHub.labelPrinter.deviceName || 'Label Cup'}" berhasil terhubung!`, 'success');
      }
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menghubungkan printer label Bluetooth', 'error');
    }
  };

  const handleConnectLabelUsb = async () => {
    try {
      const ok = await printerHub.connectLabelUsb();
      if (ok) {
        dialog.toast(`Printer Label USB "${printerHub.labelPrinter.deviceName || 'Label Cup'}" berhasil terhubung!`, 'success');
      }
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menghubungkan printer label USB', 'error');
    }
  };

  const handleTestPrintLabel = async () => {
    setTestingLabel(true);
    try {
      await printerHub.testPrintLabel(cupLabelPaperSize === '50x30mm' ? '50x30mm' : '40x30mm');
      dialog.toast('Stiker uji coba barista berhasil dikirim ke printer label!', 'success');
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal mengirim stiker uji coba label', 'error');
    } finally {
      setTestingLabel(false);
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

          {/* 2. Koneksi Printer Thermal Kasir & Hardware Hub */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-blue-900" />
                <span>2. Hardware Hub: Printer Kasir &amp; Laci Kasir (Direct ESC/POS)</span>
              </label>
              <button
                type="button"
                onClick={() => setHardwareModalOpen(true)}
                className="text-[11px] font-extrabold text-blue-900 hover:text-blue-950 flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-xl transition-all"
              >
                <Sliders className="w-3.5 h-3.5 text-blue-700" />
                <span>Pengaturan Lengkap &amp; Otomasi</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-3">
              Hubungkan printer thermal fisik Anda (Panda, Goojprt, Iware, RPP02N, Epson, Xprinter) via Bluetooth nirkabel atau kabel USB langsung tanpa repot install driver.
            </p>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    printerHub.isConnected
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {printerHub.connectionType === 'usb' ? (
                      <Usb className="w-5 h-5 text-emerald-700" />
                    ) : (
                      <Bluetooth className="w-5 h-5 text-blue-900" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        {printerHub.isConnected
                          ? printerHub.deviceName || 'Printer Thermal Terhubung'
                          : 'Belum Ada Printer Terhubung'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        printerHub.isConnected
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {printerHub.isConnected ? `● Terhubung (${printerHub.connectionType.toUpperCase()})` : 'Terputus'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {printerHub.isConnected
                        ? `Siap mencetak langsung via ${printerHub.connectionType === 'usb' ? 'WebUSB (Kabel)' : 'Web Bluetooth BLE'} (ESC/POS).`
                        : 'Pilih jalur koneksi Bluetooth nirkabel atau kabel USB di bawah ini.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {printerHub.isConnected ? (
                    <button
                      type="button"
                      onClick={printerHub.disconnect}
                      className="h-10 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>Putus</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleConnectBluetooth}
                        disabled={printerHub.isConnecting}
                        className="h-10 px-3.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        <Bluetooth className="w-3.5 h-3.5 text-blue-300" />
                        <span>Hubungkan Bluetooth</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleConnectUsb}
                        disabled={printerHub.isConnecting}
                        className="h-10 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        <Usb className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Hubungkan Kabel USB</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {printerHub.isConnected && (
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

              {printerHub.lastError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{printerHub.lastError}</span>
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

          {/* 8. Stiker Label Cup Minuman (Barista F&B Setup - Opt-in) */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-amber-600" />
                  <span>8. Cetak Stiker Label Cup / Minuman (Barista F&amp;B)</span>
                </label>
                <p className="text-xs text-slate-500 font-medium">
                  Aktifkan printer kedua khusus stiker label cup thermal (seperti Starbucks, Kopi Kenangan, Fore, Chatime). 1 item dengan kuantitas N akan otomatis dicetak menjadi N lembar stiker individu.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={cupLabelEnabled}
                  onChange={(e) => {
                    setCupLabelEnabled(e.target.checked);
                    if (e.target.checked) setPreviewTab('cupLabel');
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {cupLabelEnabled && (
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-4 animate-in fade-in">
                {/* Pilihan Ukuran Stiker */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    Ukuran Stiker Label Cup (Lebar × Tinggi)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { size: '40x30mm' as const, label: '40 × 30 mm', badge: 'Standar Cafe' },
                      { size: '50x30mm' as const, label: '50 × 30 mm', badge: 'Lebar' },
                      { size: '40x20mm' as const, label: '40 × 20 mm', badge: 'Kecil' },
                      { size: '50x40mm' as const, label: '50 × 40 mm', badge: 'Ekstra Luas' },
                    ].map((opt) => (
                      <button
                        key={opt.size}
                        type="button"
                        onClick={() => setCupLabelPaperSize(opt.size)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          cupLabelPaperSize === opt.size
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="font-extrabold text-xs">{opt.label}</div>
                        <div
                          className={`text-[10px] ${
                            cupLabelPaperSize === opt.size ? 'text-amber-100' : 'text-slate-400'
                          }`}
                        >
                          {opt.badge}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles opsi filter & cetak otomatis */}
                <div className="space-y-2.5 pt-2 border-t border-amber-200/60">
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                    <span>Saring Hanya Kategori Minuman (Beverages / Kopi / Teh / Boba)</span>
                    <input
                      type="checkbox"
                      checked={cupLabelOnlyBeverages}
                      onChange={(e) => setCupLabelOnlyBeverages(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                    <span>Cetak Otomatis Stiker Cup saat Kasir Selesai Transaksi</span>
                    <input
                      type="checkbox"
                      checked={cupLabelAutoPrint}
                      onChange={(e) => setCupLabelAutoPrint(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                    <span>Tampilkan Varian &amp; Modifiers (Gula, Es, Topping) di Stiker</span>
                    <input
                      type="checkbox"
                      checked={cupLabelShowModifiers}
                      onChange={(e) => setCupLabelShowModifiers(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                    <span>Tampilkan Nama Pelanggan di Bagian Bawah Stiker</span>
                    <input
                      type="checkbox"
                      checked={cupLabelShowCustomerName}
                      onChange={(e) => setCupLabelShowCustomerName(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                    />
                  </label>
                </div>

                {/* Hubungkan Hardware Printer Label (Dual-Printer Slot 2) */}
                <div className="pt-3 border-t border-amber-200/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-700" />
                        <span>Koneksi Printer Stiker Label (Slot 2)</span>
                      </span>
                      <p className="text-[11px] text-amber-900/80">
                        {printerHub.isLabelConnected
                          ? `● Terhubung: ${printerHub.labelPrinter.deviceName || 'Printer Label Cup'} (${printerHub.labelPrinter.connectionType.toUpperCase()})`
                          : 'Belum ada printer label cup yang terpasang.'}
                      </p>
                    </div>
                    {printerHub.isLabelConnected && (
                      <button
                        type="button"
                        onClick={() => printerHub.disconnectLabel()}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-white px-2 py-1 rounded-lg border border-rose-200 cursor-pointer"
                      >
                        Putuskan
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleConnectLabelBluetooth}
                      className="h-8 px-3 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Bluetooth className="w-3.5 h-3.5 text-blue-600" />
                      <span>{printerHub.isLabelConnected && printerHub.labelPrinter.connectionType === 'bluetooth' ? 'Ganti BLE Label' : 'Pair Bluetooth Label'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleConnectLabelUsb}
                      className="h-8 px-3 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Usb className="w-3.5 h-3.5 text-slate-700" />
                      <span>{printerHub.isLabelConnected && printerHub.labelPrinter.connectionType === 'usb' ? 'Ganti USB Label' : 'Hubungkan USB Label'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTestPrintLabel}
                      disabled={testingLabel}
                      className="h-8 px-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>{testingLabel ? 'Mencetak Stiker...' : `Uji Cetak Stiker (${cupLabelPaperSize})`}</span>
                    </button>
                  </div>
                  {printerHub.labelPrintError && (
                    <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                      {printerHub.labelPrintError}
                    </div>
                  )}
                </div>
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

        {/* Live Thermal Receipt & Cup Label Simulator (Kanan - 5 Kolom) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-blue-900" />
                <span>Simulasi Perangkat Fisik</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Pratinjau langsung sesuai konfigurasi cetak aktif</p>
            </div>

            {cupLabelEnabled && (
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreviewTab('receipt')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    previewTab === 'receipt'
                      ? 'bg-white text-blue-950 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Struk ({paperSize})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('cupLabel')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                    previewTab === 'cupLabel'
                      ? 'bg-white text-amber-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Tag className="w-3 h-3 text-amber-600" />
                  <span>Stiker Cup</span>
                </button>
              </div>
            )}
          </div>

          {previewTab === 'receipt' || !cupLabelEnabled ? (
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
          ) : (
            <CupLabelPreview
              config={{
                enabled: cupLabelEnabled,
                paperSize: cupLabelPaperSize,
                autoPrintOnCheckout: cupLabelAutoPrint,
                onlyBeverages: cupLabelOnlyBeverages,
                showStoreName: cupLabelShowStoreName,
                showCustomerName: cupLabelShowCustomerName,
                showModifiers: cupLabelShowModifiers,
              }}
              brandName={(activeOutlet as any)?.tenant?.name || 'WELL POS COFFEE'}
              storeName={activeOutlet?.name || 'Outlet Kemang'}
            />
          )}
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

      {/* Modal Pengaturan Hardware Printer & Laci Kasir */}
      <ThermalPrinterModal
        isOpen={hardwareModalOpen}
        onClose={() => setHardwareModalOpen(false)}
        defaultPaperSize={paperSize}
      />
    </div>
  );
};

