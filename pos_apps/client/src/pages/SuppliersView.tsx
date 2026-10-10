import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Clock,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { api } from '../services/api';
import type { Supplier, SupplierFormData } from '../types/supplier';
import { ConfirmModal } from '../components/ConfirmModal';
import { TablePagination } from '../components/TablePagination';
import { WhatsAppInput, EmptyState, TableSkeleton } from '../components/ui';
import { useDialog } from '../context/DialogContext';

export const SuppliersView: React.FC = () => {
  const dialog = useDialog();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<SupplierFormData>({
    code: '',
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    paymentTermsDays: 0,
    isActive: true,
  });

  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.getSuppliers();
      if (res.status === 'success' && res.data) {
        setSuppliers(res.data);
      }
    } catch (err) {
      console.error('Gagal mengambil daftar pemasok:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingSupplier(null);
    const nextNum = suppliers.length + 1;
    const suggestedCode = `SUP-${String(nextNum).padStart(3, '0')}`;
    setFormData({
      code: suggestedCode,
      name: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
      taxId: '',
      paymentTermsDays: 0,
      isActive: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormData({
      code: sup.code,
      name: sup.name,
      contactName: sup.contactName || '',
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || '',
      taxId: sup.taxId || '',
      paymentTermsDays: sup.paymentTermsDays || 0,
      isActive: sup.isActive,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Nama pemasok wajib diisi.');
      return;
    }
    if (!formData.code.trim()) {
      setFormError('Kode pemasok wajib diisi.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editingSupplier) {
        const res = await api.updateSupplier(editingSupplier.id, formData);
        if (res.status === 'success') {
          setModalOpen(false);
          dialog.toast('Data pemasok berhasil diperbarui!', 'success');
          fetchSuppliers();
        } else {
          setFormError(res.message || 'Gagal memperbarui pemasok.');
        }
      } else {
        const res = await api.createSupplier(formData);
        if (res.status === 'success') {
          setModalOpen(false);
          dialog.toast('Pemasok baru berhasil didaftarkan!', 'success');
          fetchSuppliers();
        } else {
          setFormError(res.message || 'Gagal menambahkan pemasok.');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan saat menyimpan pemasok.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    setDeleting(true);
    try {
      const res = await api.deleteSupplier(deletingSupplier.id);
      if (res.status === 'success') {
        setDeleteConfirmOpen(false);
        setDeletingSupplier(null);
        fetchSuppliers();
        dialog.toast('Pemasok berhasil dihapus', 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menghapus Pemasok',
          message: res.message || 'Gagal menghapus pemasok.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Gagal menghapus pemasok.',
        variant: 'danger',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Filtered Suppliers
  const filteredSuppliers = suppliers.filter((sup) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      sup.name.toLowerCase().includes(q) ||
      sup.code.toLowerCase().includes(q) ||
      (sup.contactName && sup.contactName.toLowerCase().includes(q)) ||
      (sup.phone && sup.phone.includes(q));

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && sup.isActive) ||
      (statusFilter === 'INACTIVE' && !sup.isActive);

    return matchSearch && matchStatus;
  });

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedSuppliers = filteredSuppliers.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const activeCount = suppliers.filter((s) => s.isActive).length;
  const avgTerms = suppliers.length > 0
    ? Math.round(suppliers.reduce((acc, curr) => acc + (curr.paymentTermsDays || 0), 0) / suppliers.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-900" />
            <span>Pemasok &amp; Vendor Bahan Baku</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Kelola data mitra vendor penyuplai bahan mentah (kopi, susu, sirup, kemasan) serta syarat pembayaran tagihan PO.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="h-10 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Tambah Pemasok</span>
          </button>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Total Pemasok</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900">{suppliers.length} Vendor</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Mitra rantai pasok terdaftar</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Pemasok Aktif</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-700">{activeCount} Vendor</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Siap menerima pesanan restock PO</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Rata-rata Tempo Bayar</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900">{avgTerms} Hari</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Termin jatuh tempo pelunasan tagihan</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama vendor, kode, telepon..."
              className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all outline-hidden"
            />
          </div>

          <div className="relative w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full sm:w-auto h-10 pl-3.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-blue-900 outline-hidden cursor-pointer appearance-none"
            >
              <option value="ALL">Semua Status ({suppliers.length})</option>
              <option value="ACTIVE">Aktif Saja ({activeCount})</option>
              <option value="INACTIVE">Nonaktif Saja ({suppliers.length - activeCount})</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="text-xs text-slate-400 font-semibold self-end sm:self-auto">
          Menampilkan {filteredSuppliers.length} dari {suppliers.length} vendor
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 min-w-[1050px]">
            <thead className="bg-slate-50/80 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200 tracking-wider">
              <tr>
                <th className="px-5 py-3.5 pl-6 min-w-[110px] whitespace-nowrap">Kode</th>
                <th className="px-4 py-3.5 min-w-[200px] whitespace-nowrap">Nama Vendor / Perusahaan</th>
                <th className="px-4 py-3.5 min-w-[140px] whitespace-nowrap">Kontak Person (PIC)</th>
                <th className="px-4 py-3.5 min-w-[160px] whitespace-nowrap">Telepon &amp; Email</th>
                <th className="px-4 py-3.5 min-w-[180px] whitespace-nowrap">Alamat Gudang / Kantor</th>
                <th className="px-4 py-3.5 min-w-[130px] text-center whitespace-nowrap">Termin Bayar</th>
                <th className="px-4 py-3.5 min-w-[110px] text-center whitespace-nowrap">Status</th>
                <th className="px-5 py-3.5 pr-6 min-w-[110px] text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <TableSkeleton rows={5} columns={8} actionCol />
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    <EmptyState
                      icon={<Truck className="w-7 h-7 text-blue-900" />}
                      title={suppliers.length === 0 ? 'Belum Ada Data Pemasok' : 'Tidak Ada Pemasok Ditemukan'}
                      description={
                        suppliers.length === 0
                          ? 'Daftarkan pemasok/vendor bahan baku pertama untuk mempermudah pencatatan Purchase Order dan mutasi stok.'
                          : 'Tidak ada data vendor yang cocok dengan filter atau kata kunci pencarian aktif.'
                      }
                      actionLabel={suppliers.length === 0 ? '+ Daftarkan Pemasok Pertama' : undefined}
                      onAction={suppliers.length === 0 ? handleOpenCreateModal : undefined}
                    />
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 pl-6 font-mono font-bold text-blue-950 text-xs whitespace-nowrap">
                      {sup.code}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-extrabold text-slate-900 text-sm block">
                        {sup.name}
                      </span>
                      {sup.taxId && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          NPWP: {sup.taxId}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {sup.contactName || '-'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {sup.phone ? (
                        <a
                          href={`https://wa.me/${sup.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:underline font-bold block flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{sup.phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs block">-</span>
                      )}
                      {sup.email && (
                        <span className="text-slate-400 text-[10px] flex items-center gap-1 mt-0.5">
                          <Mail className="w-2.5 h-2.5" />
                          <span>{sup.email}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate">
                      {sup.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{sup.address}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap font-mono">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-[11px] text-slate-700">
                        {sup.paymentTermsDays === 0 ? 'Tunai (0 Hari)' : `Tempo ${sup.paymentTermsDays} Hari`}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {sup.isActive ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                          Non-aktif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 pr-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(sup)}
                          className="w-8 h-8 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                          title="Edit Pemasok"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingSupplier(sup);
                            setDeleteConfirmOpen(true);
                          }}
                          className="w-8 h-8 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                          title="Hapus Pemasok"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Pemasok */}
        {!loading && filteredSuppliers.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={filteredSuppliers.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="vendor"
          />
        )}
      </div>

      {/* Modal Tambah / Edit Pemasok */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-900" />
                <span>{editingSupplier ? 'Ubah Data Pemasok' : 'Tambah Pemasok Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kode Pemasok <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="SUP-001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase focus:bg-white focus:border-blue-900 outline-hidden"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Vendor / Toko <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: PT Sumber Biji Kopi Nusantara"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-900 outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Kontak (PIC)
                  </label>
                  <input
                    type="text"
                    value={formData.contactName || ''}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Contoh: Bpk. Bambang"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-900 outline-hidden"
                  />
                </div>

                <div>
                  <WhatsAppInput
                    label="No. Telepon / WhatsApp"
                    value={formData.phone || ''}
                    onChange={(val) => setFormData({ ...formData, phone: val })}
                    placeholder="8123456789"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Vendor
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="sales@vendor.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Termin Bayar (Hari)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={formData.paymentTermsDays || 0}
                    onChange={(e) => setFormData({ ...formData, paymentTermsDays: parseInt(e.target.value, 10) || 0 })}
                    placeholder="0 = Tunai, 14, 30"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-900 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Kantor / Gudang
                </label>
                <textarea
                  rows={2}
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Jl. Perdagangan No. 12, Jakarta"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-900 outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="supplierIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded-sm border-slate-300 text-blue-900 focus:ring-blue-900 cursor-pointer"
                />
                <label htmlFor="supplierIsActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Pemasok ini aktif (dapat dipilih saat penerimaan stok PO)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-5 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-900/20 cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Pemasok</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Hapus Pemasok"
        message={`Apakah Anda yakin ingin menghapus data pemasok "${deletingSupplier?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus Pemasok"
        cancelText="Batal"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteSupplier}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingSupplier(null);
        }}
      />
    </div>
  );
};
