import React, { useState, useEffect } from 'react';
import {
  Award,
  Waves,
  Flame,
  Package,
  Printer,
  TrendingUp,
} from 'lucide-react';
import type { LaundryOperatorKpi } from '../../types/laundry';
import { api } from '../../services/api';
import { useDialog } from '../../context/DialogContext';

interface LaundryProductionKpiModalProps {
  isOpen: boolean;
  onClose: () => void;
  outletName?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const LaundryProductionKpiModal: React.FC<LaundryProductionKpiModalProps> = ({
  isOpen,
  onClose,
  outletName,
}) => {
  const dialog = useDialog();
  const [kpis, setKpis] = useState<LaundryOperatorKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'LAST_7' | 'THIS_MONTH'>('THIS_MONTH');

  const fetchKpiData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      let startDate: string | undefined;

      if (dateFilter === 'TODAY') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startDate = todayStart.toISOString();
      } else if (dateFilter === 'LAST_7') {
        const last7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        startDate = last7.toISOString();
      } else if (dateFilter === 'THIS_MONTH') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = monthStart.toISOString();
      }

      const res = await api.getLaundryProductionKpi({ startDate });
      if (res.status === 'success' && Array.isArray(res.data)) {
        setKpis(res.data);
      }
    } catch {
      // Abaikan
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKpiData();
    }
  }, [isOpen, dateFilter]);

  if (!isOpen) return null;

  const totalKgIronedAll = kpis.reduce((acc, curr) => acc + (curr.totalIroningKg || 0), 0);
  const totalKgWashedAll = kpis.reduce((acc, curr) => acc + (curr.totalWashingKg || 0), 0);
  const totalPackedAll = kpis.reduce((acc, curr) => acc + (curr.totalPackingOrders || 0), 0);

  const periodLabel =
    dateFilter === 'TODAY'
      ? 'Hari Ini'
      : dateFilter === 'LAST_7'
      ? '7 Hari Terakhir'
      : 'Bulan Ini';

  const handlePrintKpiReport = () => {
    try {
      const safeOutlet = escapeHtml(outletName || 'Outlet Laundry Well POS');
      const safePeriod = escapeHtml(periodLabel);
      const printedAt = escapeHtml(
        new Date().toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );

      const rowsHtml =
        kpis.length === 0
          ? '<tr><td colspan="8" style="text-align:center;padding:20px;color:#64748b;">Belum ada aktivitas produksi pada periode ini.</td></tr>'
          : kpis
              .map(
                (op, idx) => `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td><strong>${escapeHtml(op.operatorName || 'Staf')}</strong><br/><span style="color:#64748b;font-size:10px;">ID: ${escapeHtml(op.operatorId ? op.operatorId.slice(0, 8) : 'Manual')}</span></td>
            <td style="text-align:right;">${op.totalWashingKg > 0 ? `${op.totalWashingKg.toFixed(1)} Kg` : '-'}</td>
            <td style="text-align:right;">${op.totalDryingKg > 0 ? `${op.totalDryingKg.toFixed(1)} Kg` : '-'}</td>
            <td style="text-align:right;font-weight:700;color:#c2410c;">${op.totalIroningKg > 0 ? `${op.totalIroningKg.toFixed(1)} Kg` : '-'}</td>
            <td style="text-align:right;font-weight:700;color:#047857;">${op.totalPackingOrders > 0 ? `${op.totalPackingOrders} Nota` : '-'}</td>
            <td style="text-align:right;font-weight:700;color:#1e3a8a;">${op.totalJobs} Kali</td>
            <td style="text-align:right;color:#475569;">${op.totalDurationMinutes > 0 ? `${Math.round(op.totalDurationMinutes)} menit` : '-'}</td>
          </tr>`
              )
              .join('');

      const reportHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Rekap Kinerja Produksi Staf - ${safeOutlet}</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 12px; }
      .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
      .header h1 { margin: 0 0 4px 0; font-size: 18px; color: #172554; }
      .header p { margin: 0; font-size: 11px; color: #475569; }
      .meta { text-align: right; font-size: 11px; color: #475569; }
      .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
      .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; background: #f8fafc; }
      .card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 4px; }
      .card-value { font-size: 16px; font-weight: 800; color: #0f172a; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; font-size: 11px; }
      th { background: #f1f5f9; text-align: left; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 10px; }
      .footer { margin-top: 20px; font-size: 10px; color: #64748b; text-align: center; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Rekapitulasi Penilaian Kinerja &amp; KPI Staf</h1>
        <p>${safeOutlet}</p>
      </div>
      <div class="meta">
        <div><strong>Periode:</strong> ${safePeriod}</div>
        <div><strong>Dicetak:</strong> ${printedAt}</div>
      </div>
    </div>
    <div class="cards">
      <div class="card"><div class="card-label">Total Output Cuci</div><div class="card-value">${totalKgWashedAll.toFixed(1)} Kg</div></div>
      <div class="card"><div class="card-label">Total Output Setrika</div><div class="card-value">${totalKgIronedAll.toFixed(1)} Kg</div></div>
      <div class="card"><div class="card-label">Total Nota Dipacking</div><div class="card-value">${totalPackedAll} Nota</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:36px;">No</th>
          <th>Nama Operator</th>
          <th style="text-align:right;">Cuci (Kg)</th>
          <th style="text-align:right;">Kering (Kg)</th>
          <th style="text-align:right;">Setrika (Kg)</th>
          <th style="text-align:right;">Packing (Nota)</th>
          <th style="text-align:right;">Total Pekerjaan</th>
          <th style="text-align:right;">Durasi Kerja</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="footer">Dokumen Rekap KPI Produksi — Well POS</div>
  </body>
</html>`;

      let iframe = document.getElementById('kpi-print-iframe') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'kpi-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.opacity = '0.01';
        iframe.style.pointerEvents = 'none';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc || !iframe.contentWindow) {
        const popup = window.open('', '_blank', 'width=900,height=700');
        if (!popup) {
          dialog.toast('Pop-up cetak diblokir browser. Izinkan pop-up untuk mencetak laporan KPI.', 'error');
          return;
        }
        popup.document.open();
        popup.document.write(reportHtml);
        popup.document.close();
        popup.focus();
        setTimeout(() => popup.print(), 250);
        return;
      }

      doc.open();
      doc.write(reportHtml);
      doc.close();
      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch {
          dialog.toast('Gagal membuka dialog cetak. Periksa izin browser Anda.', 'error');
        }
      }, 200);
    } catch {
      dialog.toast('Gagal menyiapkan dokumen cetak rekap kinerja.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
      <div className="w-full sm:max-w-4xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col min-h-0 overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm truncate">Penilaian Kinerja Produksi &amp; Komisi Staf</h3>
              <p className="text-xs text-slate-500 break-words">
                Akumulasi output riil operator per tahapan (Cuci, Kering, Setrika, Packing)
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* Filter Rentang Tanggal */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold overflow-x-auto scrollbar-none flex-nowrap">
              <button
                type="button"
                onClick={() => setDateFilter('TODAY')}
                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  dateFilter === 'TODAY' ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('LAST_7')}
                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  dateFilter === 'LAST_7' ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('THIS_MONTH')}
                className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  dateFilter === 'THIS_MONTH' ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulan Ini
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold p-2 rounded-xl hover:bg-slate-100 cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Konten Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-6">
          {/* Kartu Ringkasan Metrik Output */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0">
                <Waves className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Total Output Cuci</div>
                <div className="text-lg font-black text-blue-950">{totalKgWashedAll.toFixed(1)} Kg</div>
              </div>
            </div>

            <div className="p-3.5 bg-orange-50/70 border border-orange-200/80 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-orange-700 tracking-wider">Total Output Setrika</div>
                <div className="text-lg font-black text-orange-950">{totalKgIronedAll.toFixed(1)} Kg</div>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Total Nota Dipacking</div>
                <div className="text-lg font-black text-emerald-950">{totalPackedAll} Nota</div>
              </div>
            </div>
          </div>

          {/* Tabel Leaderboard Output per Operator */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-900" />
                <span>Leaderboard Produktivitas Staf</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {kpis.length} Staf Terdata
              </span>
            </div>

            {loading ? (
              <div className="p-10 text-center text-xs text-slate-400">Menghitung metrik performa staf...</div>
            ) : kpis.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                Belum ada aktivitas produksi yang tercatat pada periode ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10.5px] font-bold text-slate-600 border-b border-slate-100">
                      <th className="py-2.5 px-3">Nama Operator</th>
                      <th className="py-2.5 px-3 text-right">Cuci (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Kering (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Setrika (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Packing (Nota)</th>
                      <th className="py-2.5 px-3 text-right">Total Pekerjaan</th>
                      <th className="py-2.5 px-3 text-right">Durasi Kerja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">
                    {kpis.map((op, idx) => (
                      <tr key={op.operatorId || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{op.operatorName}</div>
                          <div className="text-[10px] text-slate-400">ID: {op.operatorId ? op.operatorId.slice(0, 8) : 'Manual'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {op.totalWashingKg > 0 ? `${op.totalWashingKg.toFixed(1)} Kg` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {op.totalDryingKg > 0 ? `${op.totalDryingKg.toFixed(1)} Kg` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-orange-700">
                          {op.totalIroningKg > 0 ? `${op.totalIroningKg.toFixed(1)} Kg` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-700">
                          {op.totalPackingOrders > 0 ? `${op.totalPackingOrders} Nota` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-950">
                          {op.totalJobs} Kali
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {op.totalDurationMinutes > 0 ? `${Math.round(op.totalDurationMinutes)} menit` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Modal */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handlePrintKpiReport}
            className="h-11 sm:h-10 px-4 text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Cetak Rekap Kinerja</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('wellpos:navigate_tab', { detail: 'laundry_commissions' }));
                }
              }}
              className="flex-1 sm:flex-initial h-11 sm:h-10 px-4 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>Buka Rekap Komisi Lengkap</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-11 sm:h-10 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer whitespace-nowrap"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
