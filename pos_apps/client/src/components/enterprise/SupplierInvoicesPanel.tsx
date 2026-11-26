import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  ChevronDown,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { enterpriseCore4Api, api } from '../../services/api';
import type { SupplierInvoiceRecord, SupplierInvoiceSummary } from '../../types/enterprise_core4';
import type { Outlet } from '../../types/outlet';
import type { User } from '../../types/auth';
import type { Supplier } from '../../types/supplier';
import type { PurchaseOrder } from '../../types/purchasing';
import { formatRupiah } from '../../utils/currency';

interface SupplierInvoicesPanelProps {
  activeOutlet?: Outlet | null;
  currentUser?: User | null;
}

export const SupplierInvoicesPanel: React.FC<SupplierInvoicesPanelProps> = ({
  activeOutlet,
  currentUser,
}) => {
  const isManager = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  // Data states
  const [invoices, setInvoices] = useState<SupplierInvoiceRecord[]>([]);
  const [summary, setSummary] = useState<SupplierInvoiceSummary>({
    totalInvoices: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalRemaining: 0,
    overdueCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Supporting options
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  // Modal: Create Supplier Invoice
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [submittingInvoice, setSubmittingInvoice] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState<string>('');
  const [formSubtotal, setFormSubtotal] = useState<number>(0);
  const [formTax, setFormTax] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Modal: Pay Invoice
  const [payModalOpen, setPayModalOpen] = useState<boolean>(false);
  const [payingInvoice, setPayingInvoice] = useState<SupplierInvoiceRecord | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('BANK_TRANSFER');
  const [payReference, setPayReference] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Modal: Detail Invoice & Payments History
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoiceRecord | null>(null);

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await enterpriseCore4Api.getSupplierInvoices({
        outletId: activeOutlet?.id,
        status: statusFilter,
        search: searchQuery.trim() || undefined,
      });
      if (res.status === 'success' && res.data) {
        setInvoices(res.data);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err: any) {
      console.error('Gagal memuat tagihan supplier:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id, statusFilter, searchQuery]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Load suppliers & POs
  useEffect(() => {
    const loadPrerequisites = async () => {
      try {
        const [supRes, poRes] = await Promise.all([
          api.getSuppliers({ isActive: true }),
          api.getPurchaseOrders({ outletId: activeOutlet?.id, limit: 50 }),
        ]);
        if (supRes.status === 'success' && supRes.data) setSuppliers(supRes.data);
        if (poRes.status === 'success' && poRes.data) setPurchaseOrders(poRes.data);
      } catch (err) {
        console.error('Gagal memuat data supplier/PO:', err);
      }
    };
    loadPrerequisites();
  }, [activeOutlet?.id]);

  // When PO is selected in create modal, auto-fill supplier & subtotal
  const handleSelectPO = (poId: string) => {
    setSelectedPoId(poId);
    if (!poId) return;
    const po = purchaseOrders.find((p) => p.id === poId);
    if (po) {
      setSelectedSupplierId(po.supplierId);
      setFormSubtotal(Number(po.subtotal || po.totalAmount || 0));
    }
  };

  // Handler: Submit Create AP Invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!selectedSupplierId) {
      setCreateError('Supplier wajib dipilih.');
      return;
    }
    if (formSubtotal <= 0) {
      setCreateError('Subtotal tagihan harus lebih besar dari Rp 0.');
      return;
    }

    try {
      setSubmittingInvoice(true);
      const res = await enterpriseCore4Api.createSupplierInvoice({
        outletId: activeOutlet?.id,
        supplierId: selectedSupplierId,
        purchaseOrderId: selectedPoId || null,
        invoiceNumber: formInvoiceNumber.trim() || undefined,
        subtotal: formSubtotal,
        taxAmount: formTax,
        dueDate: formDueDate || null,
        notes: formNotes || null,
      });

      if (res.status === 'success') {
        setCreateModalOpen(false);
        setSelectedSupplierId('');
        setSelectedPoId('');
        setFormInvoiceNumber('');
        setFormSubtotal(0);
        setFormTax(0);
        setFormDueDate('');
        setFormNotes('');
        fetchInvoices();
      } else {
        setCreateError(res.message || 'Gagal mencatat tagihan supplier.');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmittingInvoice(false);
    }
  };

  // Handler: Open Pay Modal
  const handleOpenPay = (inv: SupplierInvoiceRecord) => {
    setPayingInvoice(inv);
    setPayAmount(Number(inv.remainingAmount));
    setPayMethod('BANK_TRANSFER');
    setPayReference('');
    setPayNotes('');
    setPayError(null);
    setPayModalOpen(true);
  };

  // Handler: Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    setPayError(null);

    const remaining = Number(payingInvoice.remainingAmount);
    if (payAmount <= 0) {
      setPayError('Nominal pembayaran harus lebih besar dari Rp 0.');
      return;
    }
    if (payAmount > remaining + 0.01) {
      setPayError(`Nominal tidak boleh melebihi sisa hutang (${formatRupiah(remaining)}).`);
      return;
    }

    try {
      setSubmittingPayment(true);
      const res = await enterpriseCore4Api.paySupplierInvoice(payingInvoice.id, {
        amount: payAmount,
        paymentMethod: payMethod,
        referenceNumber: payReference.trim() || null,
        notes: payNotes.trim() || null,
      });

      if (res.status === 'success') {
        setPayModalOpen(false);
        setPayingInvoice(null);
        fetchInvoices();
      } else {
        setPayError(res.message || 'Gagal memproses pembayaran.');
      }
    } catch (err: any) {
      setPayError(err.message || 'Terjadi kesalahan.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Tagihan AP</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(summary.totalAmount)}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-slate-700">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sudah Dibayar</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{formatRupiah(summary.totalPaid)}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sisa Hutang Usaha</p>
            <p className="text-xl font-bold text-blue-900 mt-1">{formatRupiah(summary.totalRemaining)}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-900">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Lewat Jatuh Tempo</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{summary.overdueCount}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor tagihan, supplier, atau catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white transition"
            />
          </div>

          <div className="relative min-w-[160px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900 transition"
            >
              <option value="ALL">Semua Status</option>
              <option value="UNPAID">Belum Bayar</option>
              <option value="PARTIAL">Sebagian</option>
              <option value="PAID">Lunas</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {isManager && (
          <button
            onClick={() => {
              setCreateError(null);
              setSelectedSupplierId(suppliers[0]?.id || '');
              setSelectedPoId('');
              setFormInvoiceNumber('');
              setFormSubtotal(0);
              setFormTax(0);
              setFormDueDate('');
              setFormNotes('');
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl shadow-sm transition active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>Catat Tagihan Supplier</span>
          </button>
        )}
      </div>

      {/* List / Table Invoices */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Memuat tagihan supplier (AP)...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700">Belum ada Tagihan Supplier</p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              Seluruh kewajiban hutang usaha dari PO maupun tagihan operasional akan tercatat di sini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => {
              const isOverdue = inv.status !== 'PAID' && inv.dueDate && new Date(inv.dueDate) < new Date();

              return (
                <div key={inv.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">#{inv.invoiceNumber}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="font-semibold text-slate-800 text-xs">{inv.supplier?.name || 'Supplier'}</span>

                      {/* Status Badges */}
                      {inv.status === 'PAID' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Lunas
                        </span>
                      )}
                      {inv.status === 'PARTIAL' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-900">
                          <Clock className="w-3 h-3 mr-1" />
                          Bayar Sebagian
                        </span>
                      )}
                      {inv.status === 'UNPAID' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Belum Bayar
                        </span>
                      )}

                      {isOverdue && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Jatuh Tempo!
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Total: <strong className="text-slate-900 font-semibold">{formatRupiah(Number(inv.totalAmount))}</strong></span>
                      <span>Terbayar: <strong className="text-emerald-700">{formatRupiah(Number(inv.paidAmount))}</strong></span>
                      <span>Sisa Hutang: <strong className="text-blue-900 font-semibold">{formatRupiah(Number(inv.remainingAmount))}</strong></span>
                      {inv.dueDate && (
                        <span>Jatuh Tempo: <strong>{new Date(inv.dueDate).toLocaleDateString('id-ID')}</strong></span>
                      )}
                    </div>

                    {inv.purchaseOrder && (
                      <p className="text-xs text-slate-400">
                        Rujukan PO: <span className="font-mono text-slate-600 font-medium">#{inv.purchaseOrder.poNumber}</span>
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setDetailModalOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                    >
                      Riwayat Bayar
                    </button>

                    {isManager && inv.status !== 'PAID' && (
                      <button
                        onClick={() => handleOpenPay(inv)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-sm transition inline-flex items-center gap-1"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Catat Pembayaran
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Catat Tagihan Supplier Baru */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-900 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Catat Tagihan Supplier (AP)</h3>
                  <p className="text-xs text-slate-500">Pencatatan kewajiban hutang usaha kepada mitra</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
                {createError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{createError}</span>
                  </div>
                )}

                {/* Optional PO Reference */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Rujuk Purchase Order (Opsional)</label>
                  <div className="relative">
                    <select
                      value={selectedPoId}
                      onChange={(e) => handleSelectPO(e.target.value)}
                      className="w-full appearance-none pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    >
                      <option value="">-- Tanpa Rujukan PO (Tagihan Langsung) --</option>
                      {purchaseOrders.map((po) => (
                        <option key={po.id} value={po.id}>
                          #{po.poNumber} — {po.supplier?.name} ({formatRupiah(Number(po.totalAmount))})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Supplier Selection */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Supplier Mitra</label>
                  <div className="relative">
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full appearance-none pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    >
                      <option value="">Pilih Supplier...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || 'SUP'})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Nomor Invoice Supplier (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: INV-SUP-001"
                      value={formInvoiceNumber}
                      onChange={(e) => setFormInvoiceNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Jatuh Tempo (Opsional)</label>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Subtotal Tagihan (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={formSubtotal}
                      onChange={(e) => setFormSubtotal(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Pajak / PPN (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={formTax}
                      onChange={(e) => setFormTax(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-600">Total Kewajiban Tagihan:</span>
                    <span className="text-base font-bold text-blue-900">{formatRupiah(formSubtotal + formTax)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Keterangan termin pembayaran, nomor rekening, dll..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingInvoice}
                  className="px-5 py-2 text-xs font-medium text-white bg-blue-900 hover:bg-blue-800 disabled:opacity-50 rounded-xl shadow-sm transition"
                >
                  {submittingInvoice ? 'Menyimpan...' : 'Simpan Tagihan AP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Catat Pembayaran AP */}
      {payModalOpen && payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 text-sm">
                Catat Pembayaran #{payingInvoice.invoiceNumber}
              </h3>
              <button
                onClick={() => setPayModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-3 text-xs">
                {payError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{payError}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Supplier:</span>
                    <strong className="text-slate-800">{payingInvoice.supplier?.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Tagihan:</span>
                    <span className="font-semibold text-slate-800">{formatRupiah(Number(payingInvoice.totalAmount))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sisa Hutang:</span>
                    <span className="font-bold text-blue-900">{formatRupiah(Number(payingInvoice.remainingAmount))}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nominal Pembayaran (Rp)</label>
                  <input
                    type="number"
                    min="1"
                    max={Number(payingInvoice.remainingAmount)}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Metode Pembayaran</label>
                  <div className="relative">
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="w-full appearance-none pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    >
                      <option value="BANK_TRANSFER">Transfer Bank</option>
                      <option value="CASH">Tunai (Kasbon / Kasbon Drawer)</option>
                      <option value="GIRO">Giro / Cek</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nomor Referensi / Bukti Transfer (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: TRF-BCA-12345"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Catatan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Keterangan pembayaran termin..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 text-xs font-medium text-white bg-blue-900 hover:bg-blue-800 disabled:opacity-50 rounded-xl shadow-sm transition"
                >
                  {submittingPayment ? 'Menyimpan...' : 'Konfirmasi Bayar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Riwayat Pembayaran Detail */}
      {detailModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 text-sm">
                Riwayat Pembayaran #{selectedInvoice.invoiceNumber}
              </h3>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Total Tagihan:</span>
                  <p className="font-semibold text-slate-900">{formatRupiah(Number(selectedInvoice.totalAmount))}</p>
                </div>
                <div>
                  <span className="text-slate-400">Sisa Hutang:</span>
                  <p className="font-bold text-blue-900">{formatRupiah(Number(selectedInvoice.remainingAmount))}</p>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-700 uppercase tracking-wider mb-2">Riwayat Pembayaran</p>
                {!selectedInvoice.payments || selectedInvoice.payments.length === 0 ? (
                  <p className="p-4 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Belum ada pembayaran yang tercatat untuk invoice ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {selectedInvoice.payments.map((p) => (
                      <div key={p.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">{formatRupiah(Number(p.amount))}</p>
                          <p className="text-slate-400">
                            {new Date(p.paidAt).toLocaleString('id-ID')} • {p.paymentMethod}
                            {p.referenceNumber ? ` (${p.referenceNumber})` : ''}
                          </p>
                        </div>
                        {p.notes && <p className="text-xs text-slate-500 italic max-w-xs">{p.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition"
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
