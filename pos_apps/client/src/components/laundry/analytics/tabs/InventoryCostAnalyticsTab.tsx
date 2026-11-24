// Well POS - InventoryCostAnalyticsTab Component
// Sub-Tab Analitik Biaya Bahan Baku & Inventaris Laundry (Chemical Cost/Kg, Low Stock, BoM Variance, PO)

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  AlertCircle,
  Truck,
  ArrowRight,
  Archive,
} from 'lucide-react';
import type { InventoryAnalyticsResult } from '../../../../types/laundryAnalytics';
import { fetchLaundryInventory } from '../../../../services/laundryAnalyticsApi';
import { formatRupiah } from '../../../../utils/currency';

interface InventoryCostAnalyticsTabProps {
  preset: string;
  startDate?: string;
  endDate?: string;
  outletId: string;
  userRole?: string;
  onNavigateTab?: (tabKey: string) => void;
}

export const InventoryCostAnalyticsTab: React.FC<InventoryCostAnalyticsTabProps> = ({
  preset,
  startDate,
  endDate,
  outletId,
  userRole,
  onNavigateTab,
}) => {
  const [data, setData] = useState<InventoryAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupervisor = userRole === 'SUPERVISOR';
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setError(null);

    fetchLaundryInventory(
      {
        preset,
        startDate,
        endDate,
        outletId,
      },
      ac.signal
    )
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Gagal memuat analitik inventaris');
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
  }, [preset, startDate, endDate, outletId]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200/80 rounded-2xl" />
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
        <h4 className="font-bold text-rose-900 text-base">Gagal Memuat Laporan Inventaris</h4>
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

  const { summary, lowStockItems = [], deadStockItems = [], purchasesBySupplier = [] } = data;

  return (
    <div className="space-y-6">
      {/* 1. Baris Kartu Metrik Inventaris & Biaya BoM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Valuasi Total Stok (Khusus Owner/Admin) */}
        {!isSupervisor && summary?.inventoryValuation !== undefined ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Valuasi Total Stok
            </span>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {formatRupiah(summary.inventoryValuation)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Biaya Kemasan: {formatRupiah(summary.packagingCostPerOrder || 0)} / nota
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Biaya Kemasan per Nota
            </span>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {formatRupiah(summary?.packagingCostPerOrder || 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Plastik & gantungan per transaksi</p>
          </div>
        )}

        {/* Card 2: Biaya Kimia per Kg (Chemical Cost / Kg) */}
        {!isSupervisor && summary?.chemicalCostPerKg !== undefined ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-900 block mb-1">
              Biaya Kimia per Kg
            </span>
            <div className="text-2xl font-extrabold text-blue-900 tabular-nums">
              {formatRupiah(summary.chemicalCostPerKg)}
              <span className="text-xs font-semibold text-slate-500 ml-1">/ Kg</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Rata-rata konsumsi deterjen, alkali & softener
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-900 block mb-1">
              Variansi Resep BoM
            </span>
            <div className="text-2xl font-extrabold text-blue-900 tabular-nums">
              {summary?.bomVariancePercent || 0}%
            </div>
            <p className="text-xs text-slate-500 mt-1">Deviasi pemakaian riil vs standar resep</p>
          </div>
        )}

        {/* Card 3: Peringatan Stok Menipis */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
                Bahan Baku Menipis
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-extrabold text-rose-600 tabular-nums">
              {summary?.lowStockCount ?? lowStockItems.length}
              <span className="text-sm font-semibold text-slate-500 ml-1">Barang</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Di bawah batas aman minimum</p>
          </div>
          {onNavigateTab && (
            <div className="mt-3 pt-2 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => onNavigateTab('inventory')}
                className="text-xs font-bold text-rose-700 hover:underline inline-flex items-center gap-0.5"
              >
                Buka Inventaris <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Card 4: Belanja Purchase Order (PO) */}
        {!isSupervisor && summary?.purchaseOrderValue !== undefined ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Belanja Masuk (PO)
            </span>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {formatRupiah(summary.purchaseOrderValue)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Penyusutan: {formatRupiah(summary.shrinkageValue || 0)}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Stok Mati (&gt;60 Hari)
            </span>
            <div className="text-2xl font-extrabold text-amber-700 tabular-nums">
              {deadStockItems.length}
              <span className="text-sm font-normal text-slate-500 ml-1">Barang</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Tanpa mutasi pemakaian 60 hari</p>
          </div>
        )}
      </div>

      {/* 2. Tabel Bahan Baku Menipis (Low Stock Alert) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/40">
          <div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Peringatan Stok Bahan Baku Menipis ({lowStockItems.length})
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar bahan yang harus segera dipesan ulang (Reorder) agar operasional cuci tidak terhenti.
            </p>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('purchasing')}
              className="px-3 py-1.5 bg-blue-900 text-white rounded-xl text-xs font-semibold shadow-2xs hover:bg-blue-800 transition-colors"
            >
              Buat PO Pengadaan
            </button>
          )}
        </div>

        {lowStockItems.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Aman! Seluruh stok bahan baku berada di atas batas minimum.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Nama Bahan</th>
                  <th className="py-3 px-4">Kode SKU</th>
                  <th className="py-3 px-4">Sisa Stok</th>
                  <th className="py-3 px-4">Batas Min</th>
                  <th className="py-3 px-4 text-rose-600">Defisit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {lowStockItems.map((item) => {
                  const deficit = Math.max(0, item.reorderPoint - item.quantityOnHand);
                  return (
                    <tr key={item.itemId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{item.itemCode}</td>
                      <td className="py-3 px-4 font-bold text-rose-600 tabular-nums">
                        {item.quantityOnHand} {item.uom}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-slate-500">
                        {item.reorderPoint} {item.uom}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-rose-700 tabular-nums">
                        -{deficit} {item.uom}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Baris 2 Kolom: Stok Mati & Rekap Supplier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Kolom Kiri: Stok Mati >60 Hari */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-600" />
            Stok Mati / Mengendap (&gt;60 Hari)
          </h4>

          {deadStockItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Tidak ada bahan baku yang mengendap tanpa mutasi &gt;60 hari.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {deadStockItems.slice(0, 5).map((item) => (
                <div
                  key={item.itemId}
                  className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl"
                >
                  <div>
                    <span className="font-bold text-slate-800 block truncate">{item.name}</span>
                    <span className="text-[11px] text-amber-700">
                      {item.daysWithoutMovement} Hari Tanpa Pemakaian
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 tabular-nums block">
                      {item.quantityOnHand} {item.uom}
                    </span>
                    {!isSupervisor && item.totalValuation !== undefined && (
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {formatRupiah(item.totalValuation)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom Kanan: Rekap Pembelian per Supplier (Khusus Owner/Admin) */}
        {!isSupervisor && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-900" />
              Rekapitulasi Pengadaan per Supplier
            </h4>

            {purchasesBySupplier.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Belum ada transaksi purchase order pada periode ini.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {purchasesBySupplier.slice(0, 5).map((sup) => (
                  <div
                    key={sup.supplierId}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block truncate">
                        {sup.supplierName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {sup.poCount} Faktur PO Masuk
                      </span>
                    </div>
                    <strong className="text-slate-900 tabular-nums font-bold">
                      {formatRupiah(sup.totalAmount)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
