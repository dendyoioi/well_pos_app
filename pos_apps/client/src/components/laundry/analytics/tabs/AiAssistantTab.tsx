// Well POS - AiAssistantTab Component
// Sub-Tab AI Intelligence Laundry (Ringkasan Deskriptif, Diagnosis, Preskripsi 1-Klik, Proyeksi EOM & Tanya Data)

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  TrendingUp,
  AlertCircle,
  RotateCcw,
  Send,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type {
  AiSummaryResult,
  AiForecastResult,
  AiQueryResult,
} from '../../../../types/laundryAnalytics';
import {
  fetchLaundryAiSummary,
  fetchLaundryAiForecast,
  postLaundryAiQuery,
} from '../../../../services/laundryAnalyticsApi';
import { formatRupiah } from '../../../../utils/currency';

interface AiAssistantTabProps {
  preset: string;
  startDate?: string;
  endDate?: string;
  outletId: string;
  isOwner: boolean;
  userRole?: string;
  onAlertAction?: (target: string) => void;
}

const QUICK_PROMPTS = [
  'Berapa omzet dan tren pendapatan bulan ini?',
  'Berapa laba bersih dan margin operasional?',
  'Layanan apa yang paling diminati pelanggan?',
  'Siapa kasir dengan penjualan terbanyak?',
  'Apakah ada stok kritis atau piutang macet?',
];

export const AiAssistantTab: React.FC<AiAssistantTabProps> = ({
  preset,
  startDate,
  endDate,
  outletId,
  isOwner,
  userRole: _userRole,
  onAlertAction,
}) => {
  const [summaryData, setSummaryData] = useState<AiSummaryResult | null>(null);
  const [forecastData, setForecastData] = useState<AiForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat / Query state (Owner only)
  const [question, setQuestion] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<AiQueryResult | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setError(null);

    const promises: Promise<any>[] = [
      fetchLaundryAiSummary({ preset, startDate, endDate, outletId }, ac.signal),
    ];

    if (isOwner) {
      promises.push(
        fetchLaundryAiForecast({ preset, startDate, endDate, outletId }, ac.signal)
      );
    }

    Promise.all(promises)
      .then(([summary, forecast]) => {
        setSummaryData(summary);
        if (forecast) setForecastData(forecast);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Gagal memuat asisten AI');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [preset, startDate, endDate, outletId, isOwner]);

  const handleAskQuestion = (qText: string) => {
    if (!qText.trim() || queryLoading) return;
    setQueryLoading(true);
    setQuestion(qText);

    postLaundryAiQuery(qText, { preset, startDate, endDate, outletId })
      .then((res) => {
        setQueryResult(res);
      })
      .catch((err) => {
        setQueryResult({
          meta: {
            tenantId: '',
            outletId: 'ALL',
            dataStamp: {
              periodLabel: '',
              startDate: '',
              endDate: '',
              outletScope: '',
              generatedAt: '',
            },
          },
          intent: 'ERROR',
          question: qText,
          answer: err.message || 'Gagal memproses pertanyaan Anda.',
          supportingMetrics: {},
        });
      })
      .finally(() => {
        setQueryLoading(false);
      });
  };

  if (loading && !summaryData) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 bg-slate-200/80 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-slate-200/80 rounded-2xl" />
          <div className="h-48 bg-slate-200/80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !summaryData) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-3xl">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h4 className="font-bold text-rose-900 text-base">Gagal Memuat Asisten AI</h4>
        <p className="text-xs sm:text-sm text-rose-700 mt-1">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-800 transition-colors shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Muat Ulang
        </button>
      </div>
    );
  }

  const stamp = summaryData?.meta.dataStamp;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Verification Badge */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs font-bold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Terverifikasi Data Riil Database (0 Halusinasi)
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">
              Asisten Intelligence & Rekomendasi Toko
            </h3>
            <p className="text-xs text-blue-200/80 mt-1 max-w-xl">
              Analisis cerdas deterministik yang mengevaluasi seluruh transaksi operasional tanpa biaya
              token LLM dan bebas fabrikasi data.
            </p>
          </div>

          {stamp && (
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 text-[11px] text-blue-200 shrink-0">
              <span className="block font-semibold text-white">Stempel Verifikasi Data</span>
              <span>Scope: {stamp.outletScope}</span>
              <span className="block text-slate-300">{stamp.periodLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Kartu Proyeksi Akhir Bulan (7-Day Moving Average) - Khusus OWNER */}
      {isOwner && forecastData && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Proyeksi Akhir Bulan (7-Day Moving Average)
            </h4>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Metode: {forecastData.method ?? '7-Day Moving Average'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 block mb-1">Realisasi s/d Hari Ini</span>
              <strong className="text-sm sm:text-base font-extrabold text-slate-900 tabular-nums">
                {formatRupiah(forecastData.mtd?.revenue ?? 0)}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {(forecastData.mtd?.weightKg ?? 0).toFixed(1)} Kg ({forecastData.mtd?.daysElapsed ?? 0} Hari)
              </span>
            </div>

            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100">
              <span className="text-blue-900 font-semibold block mb-1">Estimasi Omzet Akhir Bulan</span>
              <strong className="text-sm sm:text-base font-extrabold text-blue-950 tabular-nums">
                {formatRupiah(forecastData.projection?.projectedMonthEndRevenue ?? 0)}
              </strong>
              <span className="text-[10px] text-blue-700 block mt-0.5">
                Proyeksi: ~{(forecastData.projection?.projectedMonthEndWeightKg ?? 0).toFixed(0)} Kg
              </span>
            </div>

            <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-100">
              <span className="text-rose-900 font-semibold block mb-1">Sisa Hari Bulan Ini</span>
              <strong className="text-sm sm:text-base font-extrabold text-rose-950 tabular-nums">
                {forecastData.projection?.remainingDaysInMonth ?? 0} Hari
              </strong>
              <span className="text-[10px] text-rose-700 block mt-0.5">
                Target: {forecastData.projection?.projectedRevenueGrowthPercent ?? 0}% pertumbuhan
              </span>
            </div>

            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
              <span className="text-emerald-900 font-semibold block mb-1">Run-Rate Rata-rata 7 Hari</span>
              <strong className="text-sm sm:text-base font-extrabold text-emerald-950 tabular-nums">
                {formatRupiah(forecastData.recentRunRate?.last7DaysAvgRevenue ?? 0)} / hari
              </strong>
              <span className="text-[10px] text-emerald-700 block mt-0.5">
                ~{(forecastData.recentRunRate?.last7DaysAvgWeightKg ?? 0).toFixed(1)} Kg / hari
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Ringkasan Eksekutif Deskriptif & Diagnostik */}
      {summaryData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Deskriptif */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-900" />
              Narasi Kinerja Operasional & Penjualan
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {summaryData.descriptiveSummary}
            </p>
          </div>

          {/* Diagnostik Akar Masalah */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Diagnosis Titik Hambat & Evaluasi Mutu
            </h4>
            {summaryData.diagnostics && summaryData.diagnostics.length > 0 ? (
              <div className="space-y-2 text-xs">
                {summaryData.diagnostics.map((d, i) => (
                  <div key={i} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800">{d.area}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.status === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : d.status === 'WARNING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                    <p className="text-slate-600">{d.finding}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5 italic">Penyebab: {d.rootCause}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Tidak ada kendala operasional yang terdeteksi.</p>
            )}
          </div>
        </div>
      )}

      {/* 4. Rekomendasi Preskriptif 1-Klik */}
      {summaryData?.prescriptions && summaryData.prescriptions.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-900" />
            Rekomendasi Preskriptif Tindakan Nyata (1-Klik Solusi)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {summaryData.prescriptions.map((p, i) => (
              <div
                key={i}
                className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      Rekomendasi #{i + 1}
                    </span>
                  </div>
                  <h5 className="font-bold text-xs text-slate-900 mb-1">{p.title}</h5>
                  <p className="text-xs text-slate-500 line-clamp-2">{p.reason}</p>
                </div>

                {onAlertAction && (
                  <button
                    type="button"
                    onClick={() => onAlertAction(p.actionTarget)}
                    className="mt-3 w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-blue-900 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <span>{p.actionLabel}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Panel Tanya Data Bisnis Toko (Khusus Role OWNER) */}
      {isOwner && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-900" />
                Tanya Data Bisnis Toko (Query Router 0 LLM Cost)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Ketik pertanyaan bisnis apa pun untuk dijawab secara instan langsung dari data transaksi toko.
              </p>
            </div>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAskQuestion(qp)}
                className="px-2.5 py-1 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200 rounded-lg text-xs transition-colors"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Form Input Pertanyaan Bebas */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion(question);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Contoh: Siapa kasir dengan penjualan tertinggi bulan ini?"
              className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
            />
            <button
              type="submit"
              disabled={queryLoading || !question.trim()}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {queryLoading ? (
                <RotateCcw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Tanya</span>
            </button>
          </form>

          {/* Jawaban AI Query Result */}
          {queryResult && (
            <div className="mt-4 p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-blue-900 uppercase tracking-wide">
                  Jawaban Faktual: Intent {queryResult.intent}
                </span>
                <span className="text-[10px] text-slate-400">
                  {queryResult.meta.dataStamp.periodLabel}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                {queryResult.answer}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
