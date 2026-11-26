import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  AlertCircle,
  X,
  ChevronDown,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { enterpriseCore4Api, api } from '../../services/api';
import type { PurchaseRequestRecord, PurchaseRequestSummary } from '../../types/enterprise_core4';
import type { Outlet } from '../../types/outlet';
import type { User } from '../../types/auth';
import type { Supplier } from '../../types/supplier';
import type { RecipeInventoryItem } from '../../types/recipe';
import { formatRupiah } from '../../utils/currency';

interface ProcurementRequestsPanelProps {
  activeOutlet?: Outlet | null;
  currentUser?: User | null;
}

export const ProcurementRequestsPanel: React.FC<ProcurementRequestsPanelProps> = ({
  activeOutlet,
  currentUser,
}) => {
  const isManager = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  // Data states
  const [requests, setRequests] = useState<PurchaseRequestRecord[]>([]);
  const [summary, setSummary] = useState<PurchaseRequestSummary>({
    submitted: 0,
    approved: 0,
    converted: 0,
    rejected: 0,
    total: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Supporting data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<RecipeInventoryItem[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  // Modal: Create PR
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [submittingPR, setSubmittingPR] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formOutletId, setFormOutletId] = useState<string>(activeOutlet?.id || '');
  const [formPriority, setFormPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [formNeededByDate, setFormNeededByDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formItems, setFormItems] = useState<
    Array<{
      inventoryItemId: string;
      quantityRequested: number;
      estimatedUnitCost: number;
      notes: string;
    }>
  >([]);

  // Modal: Detail PR
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [selectedPR, setSelectedPR] = useState<PurchaseRequestRecord | null>(null);

  // Modal: Reject PR
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectingPR, setRejectingPR] = useState<PurchaseRequestRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [submittingReject, setSubmittingReject] = useState<boolean>(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Modal: Convert to PO
  const [convertModalOpen, setConvertModalOpen] = useState<boolean>(false);
  const [convertingPR, setConvertingPR] = useState<PurchaseRequestRecord | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [convertDeliveryDate, setConvertDeliveryDate] = useState<string>('');
  const [convertNotes, setConvertNotes] = useState<string>('');
  const [submittingConvert, setSubmittingConvert] = useState<boolean>(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await enterpriseCore4Api.getPurchaseRequests({
        outletId: activeOutlet?.id,
        status: statusFilter,
        search: searchQuery.trim() || undefined,
      });
      if (res.status === 'success' && res.data) {
        setRequests(res.data);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err: any) {
      console.error('Gagal memuat Purchase Request:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id, statusFilter, searchQuery]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Load supporting options (Suppliers, Outlets, Inventory Items)
  useEffect(() => {
    const loadPrerequisites = async () => {
      try {
        const targetOutlet = activeOutlet?.id || '';
        const [supRes, outRes, invRes] = await Promise.all([
          api.getSuppliers({ isActive: true }),
          api.getOutlets(),
          targetOutlet
            ? api.getRecipeInventoryItems(targetOutlet, 'all')
            : Promise.resolve({ status: 'success', data: [] as RecipeInventoryItem[] }),
        ]);
        if (supRes.status === 'success' && supRes.data) setSuppliers(supRes.data);
        if (outRes.status === 'success' && outRes.data) {
          setOutlets(outRes.data);
          if (!formOutletId && outRes.data.length > 0) {
            setFormOutletId(activeOutlet?.id || outRes.data[0].id);
          }
        }
        if (invRes.status === 'success' && invRes.data) {
          setInventoryItems(invRes.data);
        }
      } catch (e) {
        console.error('Gagal memuat suppliers & outlets:', e);
      }
    };
    loadPrerequisites();
  }, [activeOutlet?.id, formOutletId]);

  // Load inventory items when Create PR modal opens
  useEffect(() => {
    if (!createModalOpen) return;
    const targetOutlet = formOutletId || activeOutlet?.id;
    if (!targetOutlet) return;
    const loadItems = async () => {
      try {
        const res = await api.getRecipeInventoryItems(targetOutlet, 'all');
        if (res.status === 'success' && res.data) {
          setInventoryItems(res.data);
          if (res.data.length > 0) {
            setFormItems((prev) => {
              if (prev.length === 0) {
                return [
                  {
                    inventoryItemId: res.data[0].id,
                    quantityRequested: 1,
                    estimatedUnitCost: Number(
                      (res.data[0] as any)?.costPrice || res.data[0]?.averageCost || 0
                    ),
                    notes: '',
                  },
                ];
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error('Gagal memuat item inventori:', err);
      }
    };
    loadItems();
  }, [createModalOpen, formOutletId, activeOutlet?.id]);

  // Handler: Add Item to PR form
  const handleAddItem = () => {
    setFormItems((prev) => [
      ...prev,
      {
        inventoryItemId: inventoryItems[0]?.id || '',
        quantityRequested: 1,
        estimatedUnitCost: Number((inventoryItems[0] as any)?.costPrice || inventoryItems[0]?.averageCost || 0),
        notes: '',
      },
    ]);
  };

  // Handler: Remove Item
  const handleRemoveItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Handler: Update Item
  const handleItemChange = (index: number, field: string, value: any) => {
    setFormItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'inventoryItemId') {
        const selected = inventoryItems.find((inv) => inv.id === value);
        if (selected) {
          item.estimatedUnitCost = Number((selected as any)?.costPrice || selected.averageCost || 0);
        }
      }
      updated[index] = item;
      return updated;
    });
  };

  // Handler: Submit Create PR
  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!formOutletId) {
      setCreateError('Outlet wajib dipilih.');
      return;
    }
    if (formItems.length === 0) {
      setCreateError('Minimal 1 item bahan baku / barang wajib ditambahkan.');
      return;
    }
    for (let i = 0; i < formItems.length; i++) {
      if (!formItems[i].inventoryItemId) {
        setCreateError(`Item #${i + 1} belum memilih barang.`);
        return;
      }
      if (formItems[i].quantityRequested <= 0) {
        setCreateError(`Jumlah item #${i + 1} harus lebih dari 0.`);
        return;
      }
    }

    try {
      setSubmittingPR(true);
      const res = await enterpriseCore4Api.createPurchaseRequest({
        outletId: formOutletId,
        priority: formPriority,
        neededByDate: formNeededByDate || null,
        notes: formNotes || null,
        items: formItems.map((it) => ({
          inventoryItemId: it.inventoryItemId,
          quantityRequested: it.quantityRequested,
          estimatedUnitCost: it.estimatedUnitCost,
          notes: it.notes || null,
        })),
      });

      if (res.status === 'success') {
        setCreateModalOpen(false);
        setFormItems([]);
        setFormNotes('');
        setFormNeededByDate('');
        fetchRequests();
      } else {
        setCreateError(res.message || 'Gagal membuat Purchase Request.');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmittingPR(false);
    }
  };

  // Handler: Approve PR
  const handleApprovePR = async (pr: PurchaseRequestRecord) => {
    try {
      const res = await enterpriseCore4Api.reviewPurchaseRequest(pr.id, {
        status: 'APPROVED',
      });
      if (res.status === 'success') {
        fetchRequests();
      }
    } catch (err: any) {
      console.error('Gagal menyetujui PR:', err);
    }
  };

  // Handler: Submit Reject PR
  const handleConfirmReject = async () => {
    if (!rejectingPR) return;
    setRejectError(null);
    try {
      setSubmittingReject(true);
      const res = await enterpriseCore4Api.reviewPurchaseRequest(rejectingPR.id, {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim() || 'Ditolak oleh manajemen',
      });
      if (res.status === 'success') {
        setRejectModalOpen(false);
        setRejectingPR(null);
        setRejectionReason('');
        fetchRequests();
      } else {
        setRejectError(res.message || 'Gagal menolak PR.');
      }
    } catch (err: any) {
      setRejectError(err.message || 'Terjadi kesalahan.');
    } finally {
      setSubmittingReject(false);
    }
  };

  // Handler: Submit Convert to PO
  const handleConfirmConvert = async () => {
    if (!convertingPR) return;
    setConvertError(null);
    if (!selectedSupplierId) {
      setConvertError('Pilih supplier resmi untuk menerbitkan PO.');
      return;
    }
    try {
      setSubmittingConvert(true);
      const res = await enterpriseCore4Api.convertToPurchaseOrder(convertingPR.id, {
        supplierId: selectedSupplierId,
        expectedDeliveryDate: convertDeliveryDate || null,
        notes: convertNotes || null,
      });
      if (res.status === 'success') {
        setConvertModalOpen(false);
        setConvertingPR(null);
        setSelectedSupplierId('');
        setConvertDeliveryDate('');
        setConvertNotes('');
        fetchRequests();
      } else {
        setConvertError(res.message || 'Gagal mengonversi PR ke PO.');
      }
    } catch (err: any) {
      setConvertError(err.message || 'Terjadi kesalahan.');
    } finally {
      setSubmittingConvert(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Menunggu Approval</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{summary.submitted}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Disetujui</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.approved}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dikonversi ke PO</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{summary.converted}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-900">
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ditolak</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{summary.rejected}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-600">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filter, Create */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor PR, pengaju, atau catatan..."
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
              <option value="PENDING">Menunggu Approval</option>
              <option value="APPROVED">Disetujui</option>
              <option value="CONVERTED_TO_PO">Dikonversi ke PO</option>
              <option value="REJECTED">Ditolak</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setFormItems([]);
            if (inventoryItems.length > 0) {
              setFormItems([
                {
                  inventoryItemId: inventoryItems[0].id,
                  quantityRequested: 1,
                  estimatedUnitCost: Number((inventoryItems[0] as any)?.costPrice || inventoryItems[0].averageCost || 0),
                  notes: '',
                },
              ]);
            }
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl shadow-sm transition active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 mr-2" />
          <span>Buat Purchase Request</span>
        </button>
      </div>

      {/* List / Table PR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Memuat daftar Purchase Request...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700">Belum ada Purchase Request</p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              Ajukan permintaan pembelian bahan baku atau deterjen operasional melalui tombol di atas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((pr) => {
              const totalItems = pr.items?.length || 0;
              const totalEst =
                pr.estimatedTotal ||
                pr.items?.reduce(
                  (sum, it) => sum + Number(it.quantityRequested) * Number(it.estimatedUnitCost),
                  0
                ) ||
                0;

              return (
                <div key={pr.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{pr.prNumber || pr.code}</span>
                      {pr.priority === 'URGENT' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          URGENT
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          NORMAL
                        </span>
                      )}

                      {/* Status Badges */}
                      {pr.status === 'APPROVED' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Disetujui
                        </span>
                      )}
                      {(pr.status === 'PENDING' || pr.status === 'SUBMITTED') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Menunggu Approval
                        </span>
                      )}
                      {pr.status === 'CONVERTED_TO_PO' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-900">
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Dikonversi ke PO
                        </span>
                      )}
                      {pr.status === 'REJECTED' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          Ditolak
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Diajukan oleh: <strong className="text-slate-700">{pr.requestedByName}</strong></span>
                      <span>Outlet: <strong className="text-slate-700">{pr.outlet?.name || '-'}</strong></span>
                      <span>Item: <strong className="text-slate-700">{totalItems} jenis barang</strong></span>
                      <span>Est. Total: <strong className="text-blue-900 font-semibold">{formatRupiah(totalEst)}</strong></span>
                    </div>

                    {pr.notes && <p className="text-xs text-slate-500 italic truncate max-w-xl">"{pr.notes}"</p>}
                    {pr.rejectionReason && (
                      <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg inline-block">
                        Alasan Ditolak: {pr.rejectionReason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => {
                        setSelectedPR(pr);
                        setDetailModalOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                    >
                      Detail
                    </button>

                    {isManager && (pr.status === 'PENDING' || pr.status === 'SUBMITTED') && (
                      <>
                        <button
                          onClick={() => handleApprovePR(pr)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                        >
                          Setujui
                        </button>
                        <button
                          onClick={() => {
                            setRejectingPR(pr);
                            setRejectionReason('');
                            setRejectError(null);
                            setRejectModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition"
                        >
                          Tolak
                        </button>
                      </>
                    )}

                    {pr.status === 'APPROVED' && (
                      <button
                        onClick={() => {
                          setConvertingPR(pr);
                          setSelectedSupplierId(suppliers[0]?.id || '');
                          setConvertDeliveryDate('');
                          setConvertNotes('');
                          setConvertError(null);
                          setConvertModalOpen(true);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-sm transition inline-flex items-center gap-1"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        Konversi ke PO
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Buat Purchase Request */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-900 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Buat Purchase Request Baru</h3>
                  <p className="text-xs text-slate-500">Pengajuan restock bahan baku/kebutuhan laundry</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleCreatePR} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
                {createError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Outlet Sasaran</label>
                    <div className="relative">
                      <select
                        value={formOutletId}
                        onChange={(e) => setFormOutletId(e.target.value)}
                        className="w-full appearance-none pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900"
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

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tingkat Prioritas</label>
                    <div className="relative">
                      <select
                        value={formPriority}
                        onChange={(e) => setFormPriority(e.target.value as any)}
                        className="w-full appearance-none pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900"
                      >
                        <option value="NORMAL">NORMAL (Reguler)</option>
                        <option value="URGENT">URGENT (Stok Kritis / Darurat)</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Dibutuhkan Tanggal (Opsional)</label>
                  <input
                    type="date"
                    value={formNeededByDate}
                    onChange={(e) => setFormNeededByDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>

                {/* Items Section */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Daftar Item Barang ({formItems.length})
                    </label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-900 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-600">Barang #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-red-500 hover:text-red-700 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2 relative">
                            <select
                              value={item.inventoryItemId}
                              onChange={(e) => handleItemChange(idx, 'inventoryItemId', e.target.value)}
                              className="w-full appearance-none pl-3 pr-10 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            >
                              {inventoryItems.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.name} ({inv.itemCode || (inv as any).sku || 'ITEM'})
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                          </div>

                          <div>
                            <input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={item.quantityRequested}
                              onChange={(e) => handleItemChange(idx, 'quantityRequested', Number(e.target.value))}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0"
                            placeholder="Est. Harga Satuan"
                            value={item.estimatedUnitCost}
                            onChange={(e) => handleItemChange(idx, 'estimatedUnitCost', Number(e.target.value))}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Catatan item (opsional)"
                            value={item.notes}
                            onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Catatan Pengajuan (Opsional)</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Tulis alasan atau keterangan tambahan pengajuan..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              {/* Sticky Action Footer */}
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
                  disabled={submittingPR}
                  className="px-5 py-2 text-xs font-medium text-white bg-blue-900 hover:bg-blue-800 disabled:opacity-50 rounded-xl shadow-sm transition"
                >
                  {submittingPR ? 'Menyimpan...' : 'Kirim Pengajuan PR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Detail PR */}
      {detailModalOpen && selectedPR && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 text-sm">
                Rincian Purchase Request #{selectedPR.prNumber || selectedPR.code}
              </h3>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400">Pengaju:</span>
                  <p className="font-semibold text-slate-800">{selectedPR.requestedByName}</p>
                </div>
                <div>
                  <span className="text-slate-400">Outlet:</span>
                  <p className="font-semibold text-slate-800">{selectedPR.outlet?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>
                  <p className="font-semibold text-slate-800">{selectedPR.status}</p>
                </div>
                <div>
                  <span className="text-slate-400">Prioritas:</span>
                  <p className="font-semibold text-slate-800">{selectedPR.priority}</p>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-700 uppercase tracking-wider mb-2">Item Barang</p>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedPR.items?.map((it) => (
                    <div key={it.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{it.inventoryItem?.name || 'Item'}</p>
                        <p className="text-slate-400">
                          {Number(it.quantityRequested)} {it.inventoryItem?.unit || it.inventoryItem?.canonicalUom || 'UOM'} x{' '}
                          {formatRupiah(Number(it.estimatedUnitCost))}
                        </p>
                      </div>
                      <p className="font-bold text-slate-900">
                        {formatRupiah(Number(it.quantityRequested) * Number(it.estimatedUnitCost))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPR.notes && (
                <div>
                  <p className="text-slate-400">Catatan:</p>
                  <p className="p-2 bg-slate-50 rounded-lg text-slate-700 mt-1">{selectedPR.notes}</p>
                </div>
              )}
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

      {/* MODAL 3: Reject PR Confirmation */}
      {rejectModalOpen && rejectingPR && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 text-sm">Tolak Purchase Request</h3>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-3">
              {rejectError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{rejectError}</span>
                </div>
              )}
              <p className="text-xs text-slate-600">
                Apakah Anda yakin ingin menolak pengajuan <strong>#{rejectingPR.prNumber || rejectingPR.code}</strong>?
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Alasan Penolakan</label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Misal: Stok di gudang utama masih mencukupi..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={submittingReject}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-sm transition"
              >
                {submittingReject ? 'Memproses...' : 'Tolak Pengajuan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Convert PR to PO */}
      {convertModalOpen && convertingPR && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 text-sm">
                Konversi PR ke Purchase Order (PO)
              </h3>
              <button
                onClick={() => setConvertModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4 text-xs">
              {convertError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{convertError}</span>
                </div>
              )}

              <p className="text-slate-600">
                Pilih pemasok resmi untuk menerbitkan dokumen Purchase Order resmi dari{' '}
                <strong>#{convertingPR.prNumber || convertingPR.code}</strong>.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Supplier Resmi</label>
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

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Pengiriman (Opsional)</label>
                <input
                  type="date"
                  value={convertDeliveryDate}
                  onChange={(e) => setConvertDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan PO (Opsional)</label>
                <textarea
                  rows={2}
                  value={convertNotes}
                  onChange={(e) => setConvertNotes(e.target.value)}
                  placeholder="Keterangan tambahan untuk purchase order resmi..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setConvertModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmConvert}
                disabled={submittingConvert}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-900 hover:bg-blue-800 disabled:opacity-50 rounded-xl shadow-sm transition"
              >
                {submittingConvert ? 'Menerbitkan PO...' : 'Terbitkan Purchase Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
