// Well POS - CustomerAnalyticsTab Component
// Sub-Tab Analitik Loyalitas & Retensi Pelanggan Laundry (5 Segmen, Win-back, Ulasan Google, dan CRM WhatsApp)

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  RotateCcw,
  Star,
  MessageCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import type { CustomerAnalyticsResult, DormantCustomerItem, DrilldownType } from '../../../../types/laundryAnalytics';
import { fetchLaundryCustomers } from '../../../../services/laundryAnalyticsApi';
import { TablePagination } from '../../../TablePagination';
import { formatRupiah } from '../../../../utils/currency';

interface CustomerAnalyticsTabProps {
  preset: string;
  startDate?: string;
  endDate?: string;
  outletId: string;
  onOpenDrilldown: (type: DrilldownType, context?: any) => void;
  onOpenFeedbackAudit?: () => void;
}

export const CustomerAnalyticsTab: React.FC<CustomerAnalyticsTabProps> = ({
  preset,
  startDate,
  endDate,
  outletId,
  onOpenDrilldown: _onOpenDrilldown,
  onOpenFeedbackAudit,
}) => {
  const [data, setData] = useState<CustomerAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dormantThreshold, setDormantThreshold] = useState<number>(30);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setError(null);

    fetchLaundryCustomers(
      {
        preset,
        startDate,
        endDate,
        outletId,
        dormantDays: dormantThreshold,
      },
      ac.signal
    )
      .then((res) => {
        setData(res);
        setPage(1);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Gagal memuat analitik pelanggan');
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
  }, [preset, startDate, endDate, outletId, dormantThreshold]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200/80 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200/80 rounded-2xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-3xl">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h4 className="font-bold text-rose-900 text-base">Gagal Memuat Analitik Pelanggan</h4>
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

  if (!data) return null;

  const { overview, segments, winbackStats, feedbackSummary, dormantList = [] } = data;

  // Pagination untuk Dormant List
  const totalDormant = dormantList.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedDormant = dormantList.slice(startIndex, startIndex + pageSize);

  // Helper WA Greeting Link
  const getWhatsAppLink = (customer: DormantCustomerItem) => {
    if (!customer.phone) return '#';
    let cleanPhone = customer.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('62')) cleanPhone = '62' + cleanPhone;

    const message = encodeURIComponent(
      `Halo Kak ${customer.name}, kami rindu mencucikan pakaian Kakak! Ada voucher khusus untuk kunjungan berikutnya di outlet kami lho. Ditunggu kedatangannya ya! 😊🧺`
    );
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Baris Kartu Metrik Retensi & Loyalitas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Customers */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Pelanggan Aktif
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
            {overview?.activeCustomersCount ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pelanggan bertransaksi dalam periode
          </p>
        </div>

        {/* Card 2: New Customers */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Pelanggan Baru
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
            {overview?.newCustomersCount ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pertama kali mencuci di outlet
          </p>
        </div>

        {/* Card 3: Win-Back Conversion */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Konversi Win-Back
            </span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
              PARTIAL
            </span>
          </div>
          <div className="text-2xl font-extrabold text-blue-900 tabular-nums">
            {winbackStats?.conversionRate ?? 0}%
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {winbackStats?.returnedCount ?? 0} dari {winbackStats?.contactedCount ?? 0} dihubungi kembali
          </p>
        </div>

        {/* Card 4: Kepuasan & Google Reviews */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Rating & Ulasan
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {(feedbackSummary?.avgRating ?? 0).toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              / 5.0 ({feedbackSummary?.totalFeedbacks ?? 0} ulasan)
            </span>
          </div>
          <div className="mt-2 text-xs flex justify-between items-center text-slate-600">
            <span>Google Review: <strong>{feedbackSummary?.googleRedirectCount ?? 0}x</strong></span>
            {onOpenFeedbackAudit && (
              <button
                type="button"
                onClick={onOpenFeedbackAudit}
                className="text-blue-900 font-bold hover:underline"
              >
                Audit Ulasan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Visualisasi 5 Segmen Pelanggan */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-900" />
          Segmentasi Basis Pelanggan Outlet
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
            <span className="text-xs text-slate-500 block mb-1">Baru (New)</span>
            <strong className="text-xl font-extrabold text-slate-800">
              {segments?.new ?? 0}
            </strong>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-center">
            <span className="text-xs text-blue-900 font-semibold block mb-1">Aktif (Active)</span>
            <strong className="text-xl font-extrabold text-blue-950">
              {segments?.active ?? 0}
            </strong>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
            <span className="text-xs text-emerald-800 font-semibold block mb-1">Loyal (Loyal)</span>
            <strong className="text-xl font-extrabold text-emerald-950">
              {segments?.loyal ?? 0}
            </strong>
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-center">
            <span className="text-xs text-indigo-900 font-semibold block mb-1">Sultan (High Value)</span>
            <strong className="text-xl font-extrabold text-indigo-950">
              {segments?.highValue ?? 0}
            </strong>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl text-center col-span-2 sm:col-span-1">
            <span className="text-xs text-amber-900 font-semibold block mb-1">Pasif (Dormant)</span>
            <strong className="text-xl font-extrabold text-amber-950">
              {segments?.dormant ?? 0}
            </strong>
          </div>
        </div>
      </div>

      {/* 3. Tabel Pelanggan Pasif & Filter Ambang Hari */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Daftar Pelanggan Dorman / Pasif
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Hubungi kembali pelanggan yang lama tidak mencuci dengan pesan promo personal WhatsApp.
            </p>
          </div>

          {/* Ambang Batas Dorman Selector */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white border border-slate-200 p-1 rounded-xl shadow-2xs text-xs font-semibold">
            {[30, 60, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setDormantThreshold(days)}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  dormantThreshold === days
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                &gt;{days} Hari
              </button>
            ))}
          </div>
        </div>

        {/* Table Body */}
        {totalDormant === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            Bagus! Tidak ada pelanggan pasif lebih dari {dormantThreshold} hari pada kriteria ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Nama Pelanggan</th>
                  <th className="py-3 px-4">Telepon / WhatsApp</th>
                  <th className="py-3 px-4">Terakhir Cuci</th>
                  <th className="py-3 px-4">Total Belanja</th>
                  <th className="py-3 px-4 text-right">Aksi CRM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedDormant.map((cust) => (
                  <tr key={cust.customerId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {cust.name}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {cust.phone || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200/80 text-[10px]">
                        {cust.daysSinceLastOrder} Hari Lalu
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      {formatRupiah(cust.totalSpent)}
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {cust.totalOrders}x Transaksi
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {cust.phone ? (
                        <a
                          href={getWhatsAppLink(cust)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Sapa WA</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No Phone</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination */}
        {totalDormant > 0 && (
          <TablePagination
            currentPage={page}
            pageSize={pageSize}
            totalItems={totalDormant}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
            itemLabel="pelanggan"
            className="border-t border-slate-100 bg-white"
          />
        )}
      </div>
    </div>
  );
};
