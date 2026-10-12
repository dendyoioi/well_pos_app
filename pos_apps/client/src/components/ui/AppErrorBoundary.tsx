import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw, Copy, Check, MessageCircle, Trash2 } from 'lucide-react';
import { recordClientError, generateDiagnosticReport, resetAppSessionAndRecover } from '../../services/errorMonitor';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
  showDetails: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      copied: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Uncaught React Error:', error, errorInfo);
    recordClientError(error, 'React.ErrorBoundary', {
      componentStack: errorInfo.componentStack,
    });
  }

  handleCopyReport = () => {
    const reportText = generateDiagnosticReport(this.state.error);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(reportText).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 3000);
      });
    }
  };

  handleWhatsAppHelp = () => {
    const reportText = generateDiagnosticReport(this.state.error);
    const waUrl = `https://wa.me/6281299990000?text=${encodeURIComponent(
      `Halo Tim Teknis Well POS, saya mengalami kendala pada aplikasi:\n\n${reportText}`
    )}`;
    window.open(waUrl, '_blank');
  };

  render() {
    if (this.state.hasError) {
      const { error, copied, showDetails } = this.state;

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5">
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-blue-950 tracking-tight">
                Terjadi Kendala Tampilan
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Antarmuka mengalami hambatan saat memuat data atau periferal. Anda dapat memuat ulang atau menyalin laporan untuk bantuan teknis.
              </p>
            </div>

            {/* Error Message Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-left text-xs font-mono text-slate-700 break-words">
              <span className="font-bold text-rose-600 font-sans block mb-1">Pesan Error:</span>
              {error?.message || 'Terjadi kesalahan runtime komponen tak terduga.'}
            </div>

            {/* Collapsible Stack Trace */}
            {error?.stack && (
              <div className="text-left">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !showDetails })}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline"
                >
                  {showDetails ? 'Sembunyikan Rincian Teknis ▲' : 'Lihat Rincian Teknis (Stack Trace) ▼'}
                </button>
                {showDetails && (
                  <pre className="mt-2 p-3 bg-slate-900 text-emerald-400 text-[10px] rounded-xl overflow-x-auto max-h-36 leading-relaxed font-mono">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="w-full h-11 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                Muat Ulang Halaman
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={this.handleCopyReport}
                  className="h-10 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Laporan</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={this.handleWhatsAppHelp}
                  className="h-10 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Bantuan WA</span>
                </button>
              </div>

              {/* Emergency Reset Button */}
              <button
                type="button"
                onClick={resetAppSessionAndRecover}
                className="w-full h-9 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 mt-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset Sesi & Cache Bersih (Darurat)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
