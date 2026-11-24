/**
 * Operational Expense Modal
 * Laundry Outlet Performance Intelligence (Well POS) - Wave 2
 * 
 * Form modal kanonikal untuk pencatatan dan audit biaya operasional outlet
 * (Listrik, Air, Sewa, Gaji Pokok, Pemasaran, Perawatan, Perlengkapan, Lainnya).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Receipt,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { CurrencyInput } from '../../../ui/CurrencyInput';
import { TablePagination } from '../../../TablePagination';
import { useDialog } from '../../../../context/DialogContext';
import {
  fetchOperationalExpenses,
  createOperationalExpense,
  updateOperationalExpense,
  deleteOperationalExpense,
} from '../../../../services/laundryAnalyticsApi';
import type {
  OperationalExpenseItem,
  ExpenseCategory,
} from '../../../../types/laundryAnalytics';

export interface OperationalExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutletId?: string | null;
  outlets?: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
}

const CATEGORY_LABELS: Record<ExpenseCategory, { label: string; color: string }> = {
  ELECTRICITY: { label: 'Listrik PLN', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  WATER: { label: 'Air PDAM', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  RENT: { label: 'Sewa Tempat', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  SALARY: { label: 'Gaji Pokok', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MARKETING: { label: 'Pemasaran / Iklan', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  MAINTENANCE: { label: 'Perawatan & Servis', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  SUPPLIES: { label: 'Perlengkapan / Bahan', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  OTHER: { label: 'Biaya Lainnya', color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export const OperationalExpenseModal: React.FC<OperationalExpenseModalProps> = ({
  isOpen,
  onClose,
  activeOutletId,
  outlets = [],
  onSuccess,
}) => {
  const dialog = useDialog();

  // Tab mode: 'FORM' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<'FORM' | 'HISTORY'>('FORM');

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [outletId, setOutletId] = useState<string>('');
  const [category, setCategory] = useState<ExpenseCategory>('ELECTRICITY');
  const [amount, setAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // History State
  const [expenses, setExpenses] = useState<OperationalExpenseItem[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Inisialisasi outlet default saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      if (activeOutletId && activeOutletId !== 'ALL') {
        setOutletId(activeOutletId);
      } else if (outlets.length > 0) {
        setOutletId(outlets[0].id);
      }
    }
  }, [isOpen, activeOutletId, outlets]);

  const loadExpenses = useCallback(async () => {
    if (!isOpen) return;
    try {
      setLoadingHistory(true);
      const res = await fetchOperationalExpenses({
        outletId: outletId && outletId !== 'ALL' ? outletId : undefined,
        category: historyCategoryFilter !== 'ALL' ? historyCategoryFilter : undefined,
        page: currentPage,
        limit: pageSize,
      });

      setExpenses(res.items || []);
      setTotalAmount(res.totalAmount || 0);
      setTotalItems(res.pagination?.totalItems || 0);
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal memuat riwayat pengeluaran', 'error');
    } finally {
      setLoadingHistory(false);
    }
  }, [isOpen, outletId, historyCategoryFilter, currentPage, pageSize, dialog]);

  useEffect(() => {
    if (isOpen && activeTab === 'HISTORY') {
      loadExpenses();
    }
  }, [isOpen, activeTab, loadExpenses]);

  const resetForm = () => {
    setEditingId(null);
    setCategory('ELECTRICITY');
    setAmount(0);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('CASH');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!outletId) {
      dialog.toast('Harap pilih outlet terlebih dahulu', 'error');
      return;
    }

    if (amount <= 0) {
      dialog.toast('Nominal pengeluaran harus lebih besar dari 0', 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        await updateOperationalExpense(editingId, {
          outletId,
          category,
          amount,
          expenseDate,
          paymentMethod,
          notes,
        });
        dialog.toast('Biaya operasional berhasil diperbarui!', 'success');
      } else {
        await createOperationalExpense({
          outletId,
          category,
          amount,
          expenseDate,
          paymentMethod,
          notes,
        });
        dialog.toast('Biaya operasional berhasil dicatat!', 'success');
      }

      resetForm();
      setActiveTab('HISTORY');
      loadExpenses();
      onSuccess?.();
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menyimpan biaya operasional', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditInline = (item: OperationalExpenseItem) => {
    setEditingId(item.id);
    setOutletId(item.outletId);
    setCategory(item.category);
    setAmount(Number(item.amount));
    setExpenseDate(item.expenseDate.split('T')[0]);
    setPaymentMethod(item.paymentMethod || 'CASH');
    setNotes(item.notes || '');
    setActiveTab('FORM');
  };

  const handleDeleteInline = async (item: OperationalExpenseItem) => {
    const confirmed = await dialog.confirm({
      title: 'Hapus Biaya Operasional',
      message: `Apakah Anda yakin ingin menghapus catatan biaya ${CATEGORY_LABELS[item.category]?.label || item.category} sebesar ${formatRupiah(Number(item.amount))}?`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await deleteOperationalExpense(item.id);
      dialog.toast('Biaya operasional berhasil dihapus', 'success');
      loadExpenses();
      onSuccess?.();
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menghapus biaya operasional', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-4xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-black">
              <Receipt className="w-5 h-5 text-blue-900" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">Kelola Biaya Operasional (OPEX)</h3>
              <p className="text-xs text-slate-500">
                Pencatatan beban rutin bulanan untuk akurasi Margin Laba Bersih
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('FORM')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'FORM'
                ? 'bg-white text-blue-900 border-t border-x border-slate-200 shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingId ? 'Edit Catatan Biaya' : 'Catat Biaya Baru'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('HISTORY');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'bg-white text-blue-900 border-t border-x border-slate-200 shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Daftar Riwayat Pengeluaran</span>
          </button>
        </div>

        {/* Body Scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 bg-white">
          {activeTab === 'FORM' ? (
            <form id="operational-expense-form" onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto">
              {editingId && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800 font-medium">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Mode Edit Biaya Aktif. Perubahan akan langsung memutakhirkan laporan.</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer"
                  >
                    Batal Edit
                  </button>
                </div>
              )}

              {/* Outlet Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Outlet / Cabang <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={outletId}
                    onChange={(e) => setOutletId(e.target.value)}
                    required
                    className="w-full appearance-none pr-10 pl-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Kategori Pengeluaran */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kategori Pengeluaran <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    required
                    className="w-full appearance-none pr-10 pl-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Nominal Biaya (CurrencyInput kanonikal) */}
              <div>
                <CurrencyInput
                  label="Nominal Pengeluaran (Rp)"
                  value={amount}
                  onChange={(numericVal) => setAmount(numericVal)}
                  required
                  placeholder="0"
                />
              </div>

              {/* Tanggal & Metode Pembayaran */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Pengeluaran <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Metode Pembayaran
                  </label>
                  <div className="relative">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full appearance-none pr-10 pl-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                    >
                      <option value="CASH">Kas Tunai Kasir / Petty Cash</option>
                      <option value="BANK_TRANSFER">Transfer Bank / Giro</option>
                      <option value="QRIS">QRIS / E-Wallet Usaha</option>
                      <option value="EDC_DEBIT">Debit EDC</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Keterangan / Catatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Nomor Invoice / Keterangan
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Tagihan Listrik PLN ID Pelanggan 5321xxxx bulan berjalan"
                  rows={3}
                  className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                />
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter Kategori:</span>
                  <div className="relative flex-1 sm:w-48">
                    <select
                      value={historyCategoryFilter}
                      onChange={(e) => {
                        setHistoryCategoryFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full appearance-none pr-10 pl-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none"
                    >
                      <option value="ALL">Semua Kategori</option>
                      {Object.entries(CATEGORY_LABELS).map(([key, item]) => (
                        <option key={key} value={key}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 self-end sm:self-auto">
                  <span className="text-slate-400">Total Periode:</span>
                  <span className="text-blue-900 font-black">{formatRupiah(totalAmount)}</span>
                </div>
              </div>

              {/* Table List */}
              {loadingHistory ? (
                <div className="py-12 text-center text-xs font-semibold text-slate-400 animate-pulse">
                  Memuat data biaya operasional...
                </div>
              ) : expenses.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-2xl">
                  Belum ada catatan biaya operasional untuk filter ini.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-3.5">Tanggal</th>
                        <th className="py-3 px-3">Kategori</th>
                        <th className="py-3 px-3">Nominal</th>
                        <th className="py-3 px-3">Metode</th>
                        <th className="py-3 px-3">Catatan</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {expenses.map((item) => {
                        const meta = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.OTHER;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3.5 whitespace-nowrap text-slate-700 font-semibold">
                              {new Date(item.expenseDate).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.color}`}
                              >
                                {meta.label}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap font-black text-slate-900">
                              {formatRupiah(Number(item.amount))}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-[11px] text-slate-500">
                              {item.paymentMethod || 'CASH'}
                            </td>
                            <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={item.notes || ''}>
                              {item.notes || '-'}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditInline(item)}
                                  className="p-1 rounded-lg hover:bg-blue-50 text-blue-900 transition-colors cursor-pointer"
                                  title="Edit Pengeluaran"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInline(item)}
                                  className="p-1 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                                  title="Hapus Pengeluaran"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Canonical Pagination */}
              {totalItems > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  onPageChange={(page) => setCurrentPage(page)}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  itemLabel="biaya"
                />
              )}
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Tutup
          </button>

          {activeTab === 'FORM' && (
            <button
              type="submit"
              form="operational-expense-form"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Catat Pengeluaran'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default OperationalExpenseModal;
