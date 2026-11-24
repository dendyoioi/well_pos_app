import React, { useState, useEffect } from 'react';
import {
  Award,
  Star,
  TrendingUp,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  History,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import type { StaffPerformanceItem, StaffPerformanceReview } from '../../types/laundry';
import type { User as AuthUser } from '../../types/auth';

interface StaffPerformanceEvaluationViewProps {
  activeOutletId: string;
  currentUser: AuthUser;
}

export const StaffPerformanceEvaluationView: React.FC<StaffPerformanceEvaluationViewProps> = ({
  activeOutletId,
  currentUser: _currentUser,
}) => {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [evaluations, setEvaluations] = useState<StaffPerformanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffPerformanceItem | null>(null);
  const [staffHistory, setStaffHistory] = useState<StaffPerformanceReview[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form Catatan Evaluasi
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchPerformance = async () => {
    if (!activeOutletId) return;
    setLoading(true);
    try {
      const res = await api.getStaffPerformance({
        outletId: activeOutletId,
        startDate,
        endDate,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
      });

      if (res.status === 'success' && res.data?.evaluations) {
        setEvaluations(res.data.evaluations);
      }
    } catch (err: any) {
      console.error('Error fetching staff performance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [activeOutletId, startDate, endDate, roleFilter]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleOpenDetail = async (item: StaffPerformanceItem) => {
    setSelectedStaff(item);
    setReviewerNotes(item.latestReview?.reviewerNotes || '');
    setLoadingHistory(true);
    try {
      const res = await api.getStaffPerformanceReviews({
        outletId: activeOutletId,
        userId: item.user.id,
      });
      if (res.status === 'success' && Array.isArray(res.data)) {
        setStaffHistory(res.data);
      }
    } catch (err) {
      console.error('Error fetching staff review history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setSavingReview(true);
    try {
      const res = await api.createStaffPerformanceReview({
        outletId: activeOutletId,
        userId: selectedStaff.user.id,
        periodStart: startDate,
        periodEnd: endDate,
        disciplineScore: selectedStaff.scores.discipline,
        productivityScore: selectedStaff.scores.productivity,
        qualityScore: selectedStaff.scores.quality,
        customerScore: selectedStaff.scores.customer,
        overallScore: selectedStaff.scores.overall,
        grade: selectedStaff.scores.grade,
        reviewerNotes: reviewerNotes.trim(),
      });

      if (res.status === 'success') {
        showToast('Catatan evaluasi pembinaan berhasil disimpan');
        fetchPerformance();
        // Refresh history
        const histRes = await api.getStaffPerformanceReviews({
          outletId: activeOutletId,
          userId: selectedStaff.user.id,
        });
        if (histRes.status === 'success') {
          setStaffHistory(histRes.data);
        }
      } else {
        showToast(res.message || 'Gagal menyimpan catatan evaluasi', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSavingReview(false);
    }
  };

  const filteredEvaluations = evaluations.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.user.name.toLowerCase().includes(q) ||
      item.user.role.toLowerCase().includes(q) ||
      (item.user.userCode && item.user.userCode.toLowerCase().includes(q))
    );
  });

  const avgOutletScore =
    evaluations.length > 0
      ? Math.round(
          (evaluations.reduce((sum, e) => sum + e.scores.overall, 0) / evaluations.length) * 10
        ) / 10
      : 0;

  const totalDamagedCases = evaluations.reduce((sum, e) => sum + e.metrics.damagedCount + e.metrics.lostCount, 0);

  return (
    <div className="space-y-4">
      {/* Filter Bar & Periode */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Period Presets */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const start = new Date(now);
                start.setDate(now.getDate() - 7);
                setStartDate(start.toISOString().slice(0, 10));
                setEndDate(now.toISOString().slice(0, 10));
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all"
            >
              7 Hari Terakhir
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
                setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10));
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-blue-900 bg-blue-50 text-blue-950 transition-all"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setStartDate(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10));
                setEndDate(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10));
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all"
            >
              Bulan Lalu
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl font-mono text-xs"
            />
            <span className="text-slate-400 font-bold">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Role */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-700"
          >
            <option value="ALL">Semua Peran</option>
            <option value="CASHIER">Kasir</option>
            <option value="KITCHEN">Produksi / Operator</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="WAITER">Kurir / Petugas</option>
          </select>

          {/* Search Box */}
          <div className="relative w-full sm:w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari staf..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Rata-rata Skor</span>
            <span className="text-2xl font-black font-mono text-blue-950 mt-0.5 block">{avgOutletScore}</span>
            <span className="text-[10px] text-slate-400">Skala 0 - 100</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Top Performer</span>
            <span className="text-base font-extrabold text-slate-800 mt-0.5 block truncate max-w-[140px]">
              {evaluations[0]?.user.name || '-'}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold">
              Grade {evaluations[0]?.scores.grade || '-'} ({evaluations[0]?.scores.overall || 0})
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Insiden</span>
            <span className="text-2xl font-black font-mono text-rose-700 mt-0.5 block">{totalDamagedCases}</span>
            <span className="text-[10px] text-slate-400">Kasus rusak &amp; hilang</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Bobot 4 Pilar</span>
            <span className="text-xs font-bold text-slate-700 mt-1 block">25% • 35% • 20% • 20%</span>
            <span className="text-[10px] text-slate-400">Disiplin • Kerja • Mutu • Rating</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <Star className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-900 mb-2" />
            <p className="text-xs">Mengkalkulasi evaluasi 4 pilar staf...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <th className="p-3.5 w-12 text-center">Rank</th>
                  <th className="p-3.5">Karyawan</th>
                  <th className="p-3.5 text-center">Grade</th>
                  <th className="p-3.5 text-right">Skor Total</th>
                  <th className="p-3.5 text-center">Disiplin (25%)</th>
                  <th className="p-3.5 text-center">Produktivitas (35%)</th>
                  <th className="p-3.5 text-center">Mutu (20%)</th>
                  <th className="p-3.5 text-center">Kepuasan (20%)</th>
                  <th className="p-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredEvaluations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Tidak ada data staf untuk periode ini
                    </td>
                  </tr>
                ) : (
                  filteredEvaluations.map((item, idx) => {
                    const grade = item.scores.grade;
                    const gradeBg =
                      grade === 'A'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : grade === 'B'
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : grade === 'C'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300';

                    return (
                      <tr key={item.user.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 text-center font-bold text-slate-400 font-mono">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </td>
                        <td className="p-3.5">
                          <div className="font-extrabold text-slate-900">{item.user.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 font-mono font-medium">
                              {item.user.role}
                            </span>
                            {item.user.userCode && <span>#{item.user.userCode}</span>}
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-0.5 text-xs font-black rounded-full border ${gradeBg}`}>
                            {grade}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-sm text-slate-900">
                          {item.scores.overall}
                        </td>
                        {/* 1. Disiplin */}
                        <td className="p-3.5 text-center font-mono">
                          <div className="font-bold text-slate-800">{item.scores.discipline}</div>
                          <div className="text-[10px] text-slate-400">
                            {item.metrics.attendedDays}/{item.metrics.scheduledDays} hr (Telat: {item.metrics.lateCount})
                          </div>
                        </td>
                        {/* 2. Produktivitas */}
                        <td className="p-3.5 text-center font-mono">
                          <div className="font-bold text-slate-800">{item.scores.productivity}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            {item.user.role === 'CASHIER'
                              ? `${item.metrics.cashierOrderCount} nota`
                              : `${item.metrics.stagesCompleted} tahap / ${item.metrics.totalProcessedKg} kg`}
                          </div>
                        </td>
                        {/* 3. Mutu */}
                        <td className="p-3.5 text-center font-mono">
                          <div className="font-bold text-slate-800">{item.scores.quality}</div>
                          <div className="text-[10px] text-slate-400">
                            Rewash: {item.metrics.rewashCount} • Rusak: {item.metrics.damagedCount + item.metrics.lostCount}
                          </div>
                        </td>
                        {/* 4. Kepuasan */}
                        <td className="p-3.5 text-center font-mono">
                          <div className="font-bold text-slate-800">{item.scores.customer}</div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{item.metrics.avgRating} ({item.metrics.ratingCount})</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(item)}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-xl transition-all shadow-xs whitespace-nowrap"
                          >
                            Tinjau &amp; Arsip
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail Evaluasi & Form Catatan Pembinaan */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-900 text-white rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">{selectedStaff.user.name}</h4>
                  <p className="text-xs text-slate-500">
                    Peran: {selectedStaff.user.role} • Periode: {startDate} s/d {endDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rincian Skor 4 Pilar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">1. Disiplin (25%)</span>
                <span className="text-xl font-black font-mono text-slate-900 mt-0.5 block">
                  {selectedStaff.scores.discipline}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {selectedStaff.metrics.attendedDays} Hadir / {selectedStaff.metrics.lateCount} Telat
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">2. Kerja (35%)</span>
                <span className="text-xl font-black font-mono text-slate-900 mt-0.5 block">
                  {selectedStaff.scores.productivity}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {selectedStaff.metrics.stagesCompleted} Tahap Selesai
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">3. Mutu (20%)</span>
                <span className="text-xl font-black font-mono text-slate-900 mt-0.5 block">
                  {selectedStaff.scores.quality}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {selectedStaff.metrics.damagedCount + selectedStaff.metrics.lostCount} Insiden
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">4. Rating (20%)</span>
                <span className="text-xl font-black font-mono text-slate-900 mt-0.5 block">
                  {selectedStaff.scores.customer}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ★ {selectedStaff.metrics.avgRating} ({selectedStaff.metrics.ratingCount})
                </span>
              </div>
            </div>

            {/* Hasil Akhir */}
            <div className="p-3.5 bg-blue-900 text-white rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-blue-200 font-bold uppercase tracking-wider block">Total Skor Akhir</span>
                <span className="text-2xl font-black font-mono block mt-0.5">{selectedStaff.scores.overall} / 100</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-blue-200 font-bold uppercase tracking-wider block">Kategori Grade</span>
                <span className="text-3xl font-black block mt-0.5 text-amber-300">Grade {selectedStaff.scores.grade}</span>
              </div>
            </div>

            {/* Form Catatan Pembinaan / Review Owner */}
            <form onSubmit={handleSaveReview} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Evaluasi &amp; Arahan Pembinaan (Owner / Supervisor)
                </label>
                <textarea
                  rows={3}
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="Contoh: Kinerja sangat memuaskan, pertahankan ketelitian pemilahan kain luntur..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingReview}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-blue-900 hover:bg-blue-800 rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  {savingReview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Catatan Evaluasi</span>
                </button>
              </div>
            </form>

            {/* Riwayat Evaluasi Sebelumnya */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>Riwayat Catatan Evaluasi ({staffHistory.length})</span>
              </div>

              {loadingHistory ? (
                <div className="py-4 text-center text-xs text-slate-400">Memuat riwayat...</div>
              ) : staffHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada riwayat catatan evaluasi untuk staf ini.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {staffHistory.map((rev) => (
                    <div key={rev.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          Grade {rev.grade} ({rev.overallScore}) • {rev.periodStart} s/d {rev.periodEnd}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Oleh: {rev.reviewedBy?.name || 'Supervisor'}
                        </span>
                      </div>
                      {rev.reviewerNotes && <p className="text-slate-600 italic">"{rev.reviewerNotes}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-in fade-in transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
