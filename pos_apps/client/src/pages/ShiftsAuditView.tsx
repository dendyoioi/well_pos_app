import React, { useState, useEffect } from 'react';
import {
  Clock,
  RefreshCw,
  Search,
  User,
  Calendar,
  Eye,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type { Shift } from '../types/shift';
import { TablePagination } from '../components/TablePagination';

export const ShiftsAuditView: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<any | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const res = await api.getShiftHistory();
      if (res.status === 'success') {
        setShifts(res.data);
      }
    } catch (err) {
      console.error('Error fetching shift history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleViewDetail = async (shiftId: string) => {
    try {
      const res = await api.getShiftById(shiftId);
      if (res.status === 'success') {
        setSelectedShift(res.data);
      }
    } catch (err) {
      console.error('Error fetching shift detail:', err);
    }
  };

  const filteredShifts = shifts.filter((s) => {
    const q = search.toLowerCase();
    const cashier = s.cashier?.name?.toLowerCase() || '';
    const outlet = s.outlet?.name?.toLowerCase() || '';
    const notes = s.notes?.toLowerCase() || '';
    return cashier.includes(q) || outlet.includes(q) || notes.includes(q);
  });

  // Reset pagination ke halaman 1 saat pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredShifts.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedShifts = filteredShifts.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20">
            <Clock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Audit & Riwayat Shift Kasir
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau rekapitulasi modal awal, penjualan tunai, dan selisih uang laci (*Z-Report*) setiap sesi kasir.
            </p>
          </div>
        </div>

        <button
          onClick={fetchShifts}
          disabled={loading}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari kasir, outlet, atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-900 shadow-xs"
          />
        </div>

        <span className="text-xs font-bold text-slate-500">
          Total: <strong className="text-slate-900">{filteredShifts.length}</strong> sesi shift
        </span>
      </div>

      {/* Shifts Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Kasir</th>
                <th className="px-5 py-3.5">Waktu Shift</th>
                <th className="px-5 py-3.5 text-right">Modal Awal</th>
                <th className="px-5 py-3.5 text-right">Uang Fisik</th>
                <th className="px-5 py-3.5 text-right">Selisih Kas</th>
                <th className="px-5 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-900" />
                    <span>Memuat riwayat shift...</span>
                  </td>
                </tr>
              ) : filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Tidak ada riwayat shift yang sesuai
                  </td>
                </tr>
              ) : (
                paginatedShifts.map((shift) => {
                  const isDiffZero = shift.difference === 0;
                  const isDiffPositive = (shift.difference || 0) > 0;

                  return (
                    <tr key={shift.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {shift.status === 'OPEN' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>AKTIF (OPEN)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold">
                            <span>SELESAI (CLOSED)</span>
                          </span>
                        )}
                      </td>

                      {/* Cashier */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{shift.cashier?.name || 'Kasir'}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">{shift.outlet?.name}</span>
                      </td>

                      {/* Waktu */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(shift.startTime).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(shift.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {shift.endTime
                            ? new Date(shift.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                            : 'Sekarang'}
                        </div>
                      </td>

                      {/* Modal Awal */}
                      <td className="px-5 py-4 text-right whitespace-nowrap font-medium text-slate-700">
                        Rp {shift.startingCash.toLocaleString('id-ID')}
                      </td>

                      {/* Uang Fisik */}
                      <td className="px-5 py-4 text-right whitespace-nowrap font-semibold text-slate-900">
                        {shift.actualCash != null
                          ? `Rp ${shift.actualCash.toLocaleString('id-ID')}`
                          : '-'}
                      </td>

                      {/* Selisih */}
                      <td className="px-5 py-4 text-right whitespace-nowrap font-black">
                        {shift.difference != null ? (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[11px] ${
                              isDiffZero
                                ? 'bg-emerald-50 text-emerald-700'
                                : isDiffPositive
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {isDiffPositive ? '+' : ''}Rp {shift.difference.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-normal">Berjalan</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetail(shift.id)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-900 text-blue-900 hover:text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Shift */}
        {!loading && filteredShifts.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={filteredShifts.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="shift"
          />
        )}
      </div>

      {/* Detail Shift Modal */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-blue-950 to-blue-900 text-white p-5 flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-800 text-[10px] font-bold text-blue-200 uppercase mb-1">
                  Detail Shift #{selectedShift.id.slice(0, 8)}
                </div>
                <h3 className="font-extrabold text-base text-white">
                  Rekap Shift: {selectedShift.cashier?.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedShift(null)}
                className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Modal Awal</span>
                  <span className="text-xs font-black text-slate-900">
                    Rp {selectedShift.startingCash?.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Penjualan Tunai</span>
                  <span className="text-xs font-black text-emerald-700">
                    Rp {selectedShift.stats?.cashSales?.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Penjualan QRIS</span>
                  <span className="text-xs font-black text-blue-700">
                    Rp {selectedShift.stats?.qrisSales?.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Selisih Kas</span>
                  <span className="text-xs font-black text-slate-900">
                    {selectedShift.difference !== null
                      ? `Rp ${selectedShift.difference.toLocaleString('id-ID')}`
                      : 'Shift Aktif'}
                  </span>
                </div>
              </div>

              {/* Orders List in this shift */}
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider mb-2.5">
                  Daftar Transaksi Selama Shift ({selectedShift.orders?.length || 0})
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase">
                      <tr>
                        <th className="px-3 py-2">No. Faktur</th>
                        <th className="px-3 py-2">Waktu</th>
                        <th className="px-3 py-2">Metode</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedShift.orders?.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-xs">
                            Belum ada transaksi di shift ini
                          </td>
                        </tr>
                      ) : (
                        selectedShift.orders?.map((ord: any) => (
                          <tr key={ord.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-bold text-slate-800">{ord.invoiceNumber}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {new Date(ord.createdAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700">
                                {ord.payments[0]?.method || 'CASH'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-black text-blue-900">
                              Rp {Number(ord.grandTotal).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedShift(null)}
                className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
