import React, { useState } from 'react';
import {
  Printer,
  Bluetooth,
  Usb,
  X,
  Power,
  Coins,
  AlertCircle,
  CheckCircle2,
  Zap,
  Sliders,
  Check,
  Tag,
  Coffee,
} from 'lucide-react';
import { useThermalPrinterHub } from '../../hooks/useThermalPrinterHub';

export interface ThermalPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPaperSize?: '58mm' | '80mm';
}

export const ThermalPrinterModal: React.FC<ThermalPrinterModalProps> = ({
  isOpen,
  onClose,
  defaultPaperSize,
}) => {
  const hub = useThermalPrinterHub();
  const [activeTab, setActiveTab] = useState<'receipt' | 'cupLabel' | 'preferences'>('receipt');
  const [testingPrint, setTestingPrint] = useState(false);
  const [testingDrawer, setTestingDrawer] = useState(false);
  const [testingLabel, setTestingLabel] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    if (defaultPaperSize && !localStorage.getItem('wellpos_printer_paper_size')) {
      hub.setPaperSize(defaultPaperSize);
    }
  }, [defaultPaperSize]);

  if (!isOpen) return null;

  // Primary receipt printer actions
  const handleConnectBluetooth = async () => {
    setStatusMessage(null);
    const ok = await hub.connectBluetooth();
    if (ok) {
      setStatusMessage({
        type: 'success',
        text: `Printer Struk Bluetooth "${hub.deviceName || 'Thermal'}" berhasil terhubung!`,
      });
    }
  };

  const handleConnectUsb = async () => {
    setStatusMessage(null);
    const ok = await hub.connectUsb();
    if (ok) {
      setStatusMessage({
        type: 'success',
        text: `Printer Struk USB "${hub.deviceName || 'Thermal'}" berhasil terhubung!`,
      });
    }
  };

  const handleDisconnect = () => {
    hub.disconnect();
    setStatusMessage({
      type: 'success',
      text: 'Koneksi printer struk kasir telah diputuskan.',
    });
  };

  const handleTestPrint = async () => {
    setTestingPrint(true);
    setStatusMessage(null);
    try {
      await hub.testPrint(hub.paperSize);
      setStatusMessage({
        type: 'success',
        text: `Struk kasir uji coba (${hub.paperSize}) berhasil dicetak!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Gagal mencetak struk uji coba.',
      });
    } finally {
      setTestingPrint(false);
    }
  };

  const handleTestDrawer = async () => {
    setTestingDrawer(true);
    setStatusMessage(null);
    try {
      const ok = await hub.kickCashDrawer();
      if (ok) {
        setStatusMessage({
          type: 'success',
          text: 'Sinyal pembuka laci kasir 24V (Drawer Kick) berhasil dikirim.',
        });
      } else {
        throw new Error('Gagal mengirim sinyal ke laci kasir.');
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Gagal mengirim sinyal ke laci kasir.',
      });
    } finally {
      setTestingDrawer(false);
    }
  };

  // Secondary label printer actions
  const handleConnectLabelBluetooth = async () => {
    setStatusMessage(null);
    const ok = await hub.connectLabelBluetooth();
    if (ok) {
      setStatusMessage({
        type: 'success',
        text: `Printer Label Stiker "${hub.labelPrinter.deviceName || 'Label Cup'}" berhasil terhubung!`,
      });
    }
  };

  const handleConnectLabelUsb = async () => {
    setStatusMessage(null);
    const ok = await hub.connectLabelUsb();
    if (ok) {
      setStatusMessage({
        type: 'success',
        text: `Printer Label USB "${hub.labelPrinter.deviceName || 'Label Cup'}" berhasil terhubung!`,
      });
    }
  };

  const handleDisconnectLabel = () => {
    hub.disconnectLabel();
    setStatusMessage({
      type: 'success',
      text: 'Koneksi printer stiker label cup telah diputuskan.',
    });
  };

  const handleTestPrintLabel = async () => {
    setTestingLabel(true);
    setStatusMessage(null);
    try {
      await hub.testPrintLabel(hub.labelPrinter.paperSize === '50x30mm' ? '50x30mm' : '40x30mm');
      setStatusMessage({
        type: 'success',
        text: `Stiker cup barista uji coba (${hub.labelPrinter.paperSize}) berhasil dicetak!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Gagal mencetak stiker uji coba.',
      });
    } finally {
      setTestingLabel(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-200 shrink-0">
              <Printer className="w-5 h-5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight truncate">
                Pusat Hardware Printer &amp; Laci Kasir
              </h3>
              <p className="text-[11px] text-blue-200/90 font-medium truncate">
                Dual-Printer Hub: Struk Belanja ESC/POS &amp; Stiker Cup Barista TSPL
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Tutup Jendela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector (3 Tabs: Struk, Stiker Cup, Preferensi) */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 pt-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('receipt')}
            className={`py-2 px-3 text-xs font-extrabold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'receipt'
                ? 'border-blue-900 text-blue-950 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-blue-700" />
            <span>1. Printer Struk</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cupLabel')}
            className={`py-2 px-3 text-xs font-extrabold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'cupLabel'
                ? 'border-blue-900 text-blue-950 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            <span>2. Printer Stiker Cup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`py-2 px-3 text-xs font-extrabold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'preferences'
                ? 'border-blue-900 text-blue-950 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-blue-700" />
            <span>Otomasi &amp; Ukuran</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1">
          {/* Status Alert Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="flex-1">{statusMessage.text}</span>
            </div>
          )}

          {/* TAB 1: PRINTER STRUK KASIR (PRIMARY) */}
          {activeTab === 'receipt' && (
            <div className="space-y-4">
              {/* Active Device Card */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                        hub.isConnected
                          ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                          : hub.isConnecting
                          ? 'bg-blue-600 text-white animate-pulse'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {hub.connectionType === 'usb' ? (
                        <Usb className="w-6 h-6" />
                      ) : (
                        <Bluetooth className="w-6 h-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                          {hub.isConnected
                            ? hub.deviceName || 'Printer Thermal Terhubung'
                            : hub.isConnecting
                            ? 'Sedang Menghubungkan...'
                            : 'Belum Ada Printer Terhubung'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            hub.isConnected
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : hub.isConnecting
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {hub.isConnected
                            ? `● Terhubung (${hub.connectionType.toUpperCase()})`
                            : hub.isConnecting
                            ? '● Menghubungkan'
                            : '○ Terputus'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        {hub.isConnected
                          ? 'Siap mencetak nota kasir seketika & memicu laci kasir otomatis.'
                          : 'Pilih jalur koneksi Bluetooth nirkabel atau kabel USB di bawah ini.'}
                      </p>
                    </div>
                  </div>

                  {hub.isConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                      title="Putus Koneksi"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Putus</span>
                    </button>
                  )}
                </div>

                {hub.printError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="flex-1">{hub.printError}</span>
                  </div>
                )}

                {!hub.isConnected && (
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={handleConnectBluetooth}
                      disabled={hub.isConnecting}
                      className="w-full py-3 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm shadow-blue-900/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Bluetooth className="w-4 h-4 text-blue-300" />
                      <span>Pindai &amp; Hubungkan Printer Bluetooth</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleConnectUsb}
                      disabled={hub.isConnecting}
                      className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm shadow-slate-900/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Usb className="w-4 h-4 text-emerald-400" />
                      <span>Hubungkan Printer Kabel USB (WebUSB)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Uji Coba Hardware Struk */}
              {hub.isConnected && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Printer className="w-4 h-4 text-blue-900" />
                    <span>Uji Coba Printer Struk &amp; Laci Kasir</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleTestPrint}
                      disabled={testingPrint}
                      className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Printer className="w-4 h-4 text-blue-700" />
                      <span>{testingPrint ? 'Mencetak...' : `Cetak Uji Coba (${hub.paperSize})`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTestDrawer}
                      disabled={testingDrawer}
                      className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Coins className="w-4 h-4 text-amber-700" />
                      <span>{testingDrawer ? 'Mengirim Sinyal...' : 'Uji Buka Laci Kasir'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRINTER STIKER LABEL CUP (SECONDARY / BARISTA F&B) */}
          {activeTab === 'cupLabel' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                        hub.isLabelConnected
                          ? 'bg-amber-500 text-white shadow-amber-500/30'
                          : hub.isLabelConnecting
                          ? 'bg-amber-600 text-white animate-pulse'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Tag className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                          {hub.isLabelConnected
                            ? hub.labelPrinter.deviceName || 'Printer Label Cup Terhubung'
                            : hub.isLabelConnecting
                            ? 'Menghubungkan Printer Label...'
                            : 'Belum Ada Printer Label Terhubung'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            hub.isLabelConnected
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : hub.isLabelConnecting
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {hub.isLabelConnected
                            ? `● Terhubung (${hub.labelPrinter.connectionType.toUpperCase()})`
                            : hub.isLabelConnecting
                            ? '● Menghubungkan'
                            : '○ Terputus'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        {hub.isLabelConnected
                          ? `Format TSPL/ESC-POS siap mencetak stiker (${hub.labelPrinter.paperSize}).`
                          : 'Hubungkan printer khusus stiker label cup (Xprinter, Panda, HPRT, Iware).'}
                      </p>
                    </div>
                  </div>

                  {hub.isLabelConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnectLabel}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                      title="Putus Koneksi Label"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Putus</span>
                    </button>
                  )}
                </div>

                {hub.labelPrintError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="flex-1">{hub.labelPrintError}</span>
                  </div>
                )}

                {!hub.isLabelConnected && (
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={handleConnectLabelBluetooth}
                      disabled={hub.isLabelConnecting}
                      className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm shadow-amber-600/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Bluetooth className="w-4 h-4 text-amber-200" />
                      <span>Pindai &amp; Hubungkan Printer Stiker Bluetooth</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleConnectLabelUsb}
                      disabled={hub.isLabelConnecting}
                      className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm shadow-slate-900/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Usb className="w-4 h-4 text-amber-400" />
                      <span>Hubungkan Printer Stiker Kabel USB</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Uji Coba Hardware Stiker Label */}
              {hub.isLabelConnected && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <span>Uji Coba Cetak Stiker Cup Barista</span>
                  </h4>

                  <button
                    type="button"
                    onClick={handleTestPrintLabel}
                    disabled={testingLabel}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <Tag className="w-4 h-4 text-amber-100" />
                    <span>{testingLabel ? 'Mencetak Stiker...' : `Cetak Stiker Uji Coba (${hub.labelPrinter.paperSize})`}</span>
                  </button>
                </div>
              )}

              {/* Info Kompatibilitas Dual-Printer */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-[11px] text-slate-600">
                <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Arsitektur Dual-Printer Kasir Well POS:</span>
                </div>
                <p>
                  1 tablet/laptop kasir dapat menghubungkan <strong>2 printer secara bersamaan</strong>:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Printer A:</strong> Struk belanja kasir thermal 58mm/80mm (ESC/POS)</li>
                  <li><strong>Printer B:</strong> Stiker label tempel cup minuman (TSPL gap sensor)</li>
                </ul>
                <p className="text-slate-400 text-[10px]">
                  * Pastikan fitur stiker cup telah diaktifkan di menu <strong>Format Struk</strong> Backoffice.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: PREFERENSI OTOMASI & KERTAS */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              {/* Paper Size Selector (Receipt) */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <label className="text-xs font-extrabold text-slate-900 block">
                  Ukuran Lebar Kertas Struk Thermal Kasir
                </label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => hub.setPaperSize('58mm')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      hub.paperSize === '58mm'
                        ? 'border-blue-900 bg-blue-50/80 text-blue-950 font-black shadow-xs ring-2 ring-blue-900/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">58 mm</span>
                      {hub.paperSize === '58mm' && <Check className="w-4 h-4 text-blue-900" />}
                    </div>
                    <span className="text-[10px] text-slate-500 block font-normal mt-0.5">
                      Portabel / Kasir Mini (32 Kolom)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => hub.setPaperSize('80mm')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      hub.paperSize === '80mm'
                        ? 'border-blue-900 bg-blue-50/80 text-blue-950 font-black shadow-xs ring-2 ring-blue-900/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">80 mm</span>
                      {hub.paperSize === '80mm' && <Check className="w-4 h-4 text-blue-900" />}
                    </div>
                    <span className="text-[10px] text-slate-500 block font-normal mt-0.5">
                      Desktop Kasir Standar (48 Kolom)
                    </span>
                  </button>
                </div>
              </div>

              {/* Ukuran Kertas Stiker Label Cup */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <label className="text-xs font-extrabold text-slate-900 block">
                  Ukuran Stiker Label Cup (Printer B)
                </label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[
                    { size: '40x30mm' as const, label: '40 × 30 mm (Standar Cafe)' },
                    { size: '50x30mm' as const, label: '50 × 30 mm (Lebar)' },
                    { size: '40x20mm' as const, label: '40 × 20 mm (Kecil)' },
                    { size: '50x40mm' as const, label: '50 × 40 mm (Ekstra Luas)' },
                  ].map((s) => (
                    <button
                      key={s.size}
                      type="button"
                      onClick={() => hub.setLabelPaperSize(s.size)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        hub.labelPrinter.paperSize === s.size
                          ? 'border-amber-600 bg-amber-50 text-amber-950 font-extrabold shadow-xs'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Print Toggle */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-extrabold text-slate-900 block">
                      Cetak Otomatis Struk (Auto-Print on Checkout)
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Otomatis mencetak struk kasir begitu pembayaran transaksi berhasil diselesaikan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => hub.setAutoPrint(!hub.autoPrintEnabled)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      hub.autoPrintEnabled ? 'bg-blue-900' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        hub.autoPrintEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Cash Drawer Kick Toggle */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-extrabold text-slate-900 block">
                      Buka Laci Kasir Otomatis (Cash Drawer Kick)
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Kirimkan pulsa 24V (ESC p 0 25 250) ke port RJ11 laci kasir setiap kali transaksi tunai (Cash) dibayarkan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => hub.setDrawerKick(!hub.drawerKickEnabled)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      hub.drawerKickEnabled ? 'bg-blue-900' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        hub.drawerKickEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Sticky Footer */}
        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between">
          <div className="text-[11px] font-medium text-slate-500">
            Struk: <span className="font-bold text-slate-800">{hub.isConnected ? hub.deviceName : 'System Print'}</span> | Label: <span className="font-bold text-slate-800">{hub.isLabelConnected ? hub.labelPrinter.deviceName : 'Non-aktif'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-xs active:scale-[0.99]"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
