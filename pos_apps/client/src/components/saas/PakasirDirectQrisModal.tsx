import React, { useState, useEffect } from 'react';
import {
  QrCode,
  CheckCircle2,
  RotateCw,
  Zap,
  ShieldCheck,
  Clock,
  X,
  ArrowRight,
} from 'lucide-react';
import { generateQrPngUri } from '../../utils/qrCode';
import { api } from '../../services/api';

export interface PakasirDirectQrisModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  invoiceNumber: string;
  amount: number;
  tokenAmount?: number;
  qrString?: string;
  expiredAt?: string;
  onSuccess?: () => void;
  successButtonText?: string;
  onSuccessButtonClick?: () => void;
}

export const PakasirDirectQrisModal: React.FC<PakasirDirectQrisModalProps> = ({
  isOpen,
  onClose,
  title = 'Pembayaran QRIS',
  subtitle = 'Pindai kode QRIS di bawah menggunakan aplikasi M-Banking atau E-Wallet apa saja.',
  invoiceNumber,
  amount,
  tokenAmount,
  qrString,
  expiredAt,
  onSuccess,
  successButtonText = 'Selesai & Lanjutkan',
  onSuccessButtonClick,
}) => {
  const [isPaid, setIsPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Menunggu pembayaran Anda...');

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Check invoice status
  const checkStatus = async (silent: boolean = false) => {
    if (!invoiceNumber || isPaid) return;
    if (!silent) setChecking(true);

    try {
      const res = await api.checkPakasirInvoiceStatus(invoiceNumber);
      if (res.status === 'success' && res.data?.status === 'PAID') {
        setIsPaid(true);
        setStatusMessage('Pembayaran berhasil diverifikasi!');
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      if (!silent) console.error('Error saat cek status pembayaran:', err);
    } finally {
      if (!silent) setChecking(false);
    }
  };

  // Auto-polling status setiap 4 detik saat modal terbuka
  useEffect(() => {
    if (!isOpen || isPaid || !invoiceNumber) return;

    // Cek awal
    checkStatus(true);

    const interval = setInterval(() => {
      checkStatus(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, isPaid, invoiceNumber]);

  if (!isOpen) return null;

  const qrImageUrl = qrString ? generateQrPngUri(qrString, 320) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
              isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-800'
            }`}>
              {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {isPaid ? 'Pembayaran Berhasil!' : title}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {invoiceNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 text-center space-y-4 max-h-[85vh] overflow-y-auto">
          {isPaid ? (
            /* =================================================================
               STATE 1: SUKSES (LUNAS)
            ================================================================= */
            <div className="py-4 space-y-4 animate-scaleUp">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">
                  Pembayaran Berhasil Diterima!
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Transaksi Anda telah terverifikasi lunas secara otomatis via Pakasir.com.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Nomor Faktur:</span>
                  <span className="font-mono font-bold text-slate-900">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Total Dibayar:</span>
                  <span className="font-black text-emerald-700">{formatRupiah(amount)}</span>
                </div>
                {tokenAmount && tokenAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Kuota Token Ditambahkan:</span>
                    <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      +{tokenAmount.toLocaleString('id-ID')} Token
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (onSuccessButtonClick) {
                    onSuccessButtonClick();
                  } else {
                    onClose();
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              >
                <span>{successButtonText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* =================================================================
               STATE 2: MENUNGGU PEMBAYARAN (QRIS DIRECT)
            ================================================================= */
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                {subtitle}
              </p>

              {/* Rincian Tagihan & Token */}
              <div className="flex items-center justify-between bg-blue-50/60 border border-blue-100 rounded-2xl px-4 py-3 text-left">
                <div>
                  <span className="text-[11px] font-semibold text-blue-700 block">Total Tagihan</span>
                  <span className="text-lg font-black text-blue-950">{formatRupiah(amount)}</span>
                </div>
                {tokenAmount && tokenAmount > 0 && (
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-amber-700 block">Bonus / Kuota</span>
                    <span className="inline-flex items-center gap-1 text-xs font-black text-amber-900 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-lg">
                      <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                      +{tokenAmount.toLocaleString('id-ID')} Token
                    </span>
                  </div>
                )}
              </div>

              {/* Box Tampilan QRIS */}
              <div className="relative inline-block p-4 bg-white border-2 border-dashed border-slate-200 rounded-3xl shadow-inner mx-auto">
                {qrImageUrl ? (
                  <img
                    src={qrImageUrl}
                    alt="Kode QRIS Pembayaran"
                    className="w-56 h-56 mx-auto object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <QrCode className="w-12 h-12 mb-2 stroke-1" />
                    <span>Memuat QRIS...</span>
                  </div>
                )}

                {/* Badge logo QRIS */}
                <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-600">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>QRIS Nasional Terverifikasi (Pakasir)</span>
                </div>

                {expiredAt && (
                  <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>Berlaku hingga: {new Date(expiredAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                  </div>
                )}
              </div>

              {/* Status Polling Live & Indikator */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="font-medium">{statusMessage}</span>
              </div>

              {/* Aksi Cek Status & Simulasi Sandbox */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => checkStatus(false)}
                  disabled={checking}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  <span>{checking ? 'Memeriksa...' : 'Cek Status Pembayaran Manual'}</span>
                </button>
              </div>

              {/* Dukungan E-Wallet & Mobile Banking */}
              <p className="text-[10px] text-slate-400">
                Dapat dibayar menggunakan BCA Mobile, Livin by Mandiri, BRImo, BNI Mobile, GoPay, OVO, Dana, ShopeePay, LinkAja, dll.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
