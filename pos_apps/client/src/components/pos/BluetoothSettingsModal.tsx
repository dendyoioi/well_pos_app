import React, { useState } from 'react';
import {
  Bluetooth,
  X,
  Power,
  Printer,
  Coins,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { useBluetoothPrinter } from '../../hooks/useBluetoothPrinter';

export interface BluetoothSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPaperSize?: '58mm' | '80mm';
}

export const BluetoothSettingsModal: React.FC<BluetoothSettingsModalProps> = ({
  isOpen,
  onClose,
  defaultPaperSize = '58mm',
}) => {
  const btPrinter = useBluetoothPrinter();
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>(defaultPaperSize);
  const [testingPrint, setTestingPrint] = useState(false);
  const [testingDrawer, setTestingDrawer] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setStatusMessage(null);
    const ok = await btPrinter.connect();
    if (ok) {
      setStatusMessage({
        type: 'success',
        text: `Printer "${btPrinter.deviceName || 'Thermal'}" berhasil terhubung!`,
      });
    }
  };

  const handleDisconnect = () => {
    btPrinter.disconnect();
    setStatusMessage({
      type: 'success',
      text: 'Koneksi printer Bluetooth telah diputuskan.',
    });
  };

  const handleTestPrint = async () => {
    setTestingPrint(true);
    setStatusMessage(null);
    try {
      await btPrinter.testPrint(paperSize);
      setStatusMessage({
        type: 'success',
        text: `Struk uji coba (${paperSize}) berhasil dikirim ke printer!`,
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
      await btPrinter.kickDrawer();
      setStatusMessage({
        type: 'success',
        text: 'Sinyal pembuka laci kasir (drawer pulse) berhasil dikirim.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Gagal mengirim sinyal ke laci kasir.',
      });
    } finally {
      setTestingDrawer(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-200 shrink-0">
              <Bluetooth className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                Pengaturan Printer Bluetooth
              </h3>
              <p className="text-[11px] text-blue-200/90 font-medium">
                Koneksi langsung printer kasir thermal nirkabel (ESC/POS)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup Jendela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Status Banner */}
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

          {/* Active Device Card */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                    btPrinter.isConnected
                      ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                      : btPrinter.isConnecting
                      ? 'bg-blue-600 text-white animate-pulse'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Bluetooth className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                      {btPrinter.isConnected
                        ? btPrinter.deviceName || 'Printer Bluetooth Terhubung'
                        : btPrinter.isConnecting
                        ? 'Sedang Mencari Printer...'
                        : 'Belum Ada Printer Terhubung'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        btPrinter.isConnected
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : btPrinter.isConnecting
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {btPrinter.isConnected
                        ? '● Terhubung'
                        : btPrinter.isConnecting
                        ? '● Menghubungkan'
                        : '○ Terputus'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    {btPrinter.isConnected
                      ? 'Siap mencetak nota transaksi kasir seketika tanpa dialog print.'
                      : 'Nyalakan Bluetooth perangkat & printer thermal, lalu ketuk tombol hubungkan.'}
                  </p>
                </div>
              </div>

              {btPrinter.isConnected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Putus Koneksi Printer"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Putus</span>
                </button>
              )}
            </div>

            {/* Error Message if any */}
            {btPrinter.lastError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="flex-1">{btPrinter.lastError}</span>
              </div>
            )}

            {/* Connect Button if disconnected */}
            {!btPrinter.isConnected && (
              <button
                type="button"
                onClick={handleConnect}
                disabled={btPrinter.isConnecting}
                className="w-full py-3 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-900/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                {btPrinter.isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-200" />
                    <span>Mencari Printer Bluetooth Terdekat...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Pindai &amp; Hubungkan Printer Bluetooth</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Test Printing Options (Only visible when connected) */}
          {btPrinter.isConnected && (
            <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-blue-900" />
                  <span>Uji Coba Cetak Struk (Test Print)</span>
                </label>
                {/* Paper size toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPaperSize('58mm')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      paperSize === '58mm'
                        ? 'bg-blue-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    58mm (Portabel)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSize('80mm')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      paperSize === '80mm'
                        ? 'bg-blue-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    80mm (Desktop)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={testingPrint}
                  className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4 text-blue-700" />
                  <span>{testingPrint ? 'Mencetak...' : `Cetak Uji Coba (${paperSize})`}</span>
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

          {/* Quick Troubleshooting Guide */}
          <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/50 space-y-2">
            <h4 className="text-xs font-extrabold text-blue-950 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-blue-700" />
              <span>Panduan Mengatasi Kendala Koneksi:</span>
            </h4>
            <ul className="text-[11px] text-slate-600 space-y-1.5 leading-relaxed list-disc list-inside">
              <li>
                <strong>Nyalakan Bluetooth:</strong> Pastikan Bluetooth di perangkat HP / Tablet / Laptop Anda sudah aktif.
              </li>
              <li>
                <strong>Pastikan Printer Siap:</strong> Nyalakan printer thermal, pastikan kertas terpasang rapi, dan lampu indikator biru/hijau menyala normal.
              </li>
              <li>
                <strong>Bukan Terhubung ke HP Lain:</strong> Printer Bluetooth hanya dapat tersambung ke <em>satu perangkat</em> dalam satu waktu. Jika sedang terhubung ke ponsel lain, putuskan terlebih dahulu.
              </li>
              <li>
                <strong>Dukungan Browser:</strong> Gunakan browser <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong> untuk dukungan Web Bluetooth resmi.
              </li>
              <li>
                <strong>Di iPhone / iPad (iOS):</strong> Safari iOS membatasi Web Bluetooth asli. Kasir di iOS dapat menggunakan browser berkemampuan BLE (seperti <em>Bluefy</em>) atau menggunakan opsi cetak standar AirPrint / PDF.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
