import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Plus,
  Printer,
  Edit2,
  Trash2,
  Users,
  Copy,
  Check,
  Search,
  RefreshCw,
  Store,
  Eye,
  X,
  AlertCircle,
  ExternalLink,
  Download,
} from 'lucide-react';
import { api } from '../services/api';
import type { QrTable } from '../types/qr_menu';
import type { Outlet } from '../types/outlet';
import { generateQrPngUri } from '../utils/qrCode';
import { TablePagination } from '../components/TablePagination';
import { useDialog } from '../context/DialogContext';

interface QrTablesViewProps {
  activeOutlet: Outlet | null;
}

export const QrTablesView: React.FC<QrTablesViewProps> = ({ activeOutlet }) => {
  const dialog = useDialog();
  const [tables, setTables] = useState<QrTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Form Mode: 'LIST' | 'FORM'
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<QrTable | null>(null);
  const [formData, setFormData] = useState({
    tableNumber: '',
    name: '',
    section: 'Indoor',
    capacity: 4,
    status: 'AVAILABLE' as 'AVAILABLE' | 'OCCUPIED' | 'RESERVED',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Tent Card Preview Mode
  const [previewTable, setPreviewTable] = useState<QrTable | null>(null);
  const [isPrintAllMode, setIsPrintAllMode] = useState(false);

  const fetchTables = async () => {
    if (!activeOutlet) return;
    setLoading(true);
    try {
      const res = await api.getQrTables(activeOutlet.id);
      if (res.status === 'success' && res.data) {
        setTables(res.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data meja:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [activeOutlet?.id]);

  const handleOpenCreateForm = () => {
    setEditingTable(null);
    const nextNumber = String(tables.length + 1).padStart(2, '0');
    setFormData({
      tableNumber: nextNumber,
      name: `Meja ${nextNumber}`,
      section: 'Indoor',
      capacity: 4,
      status: 'AVAILABLE',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (tbl: QrTable) => {
    setEditingTable(tbl);
    setFormData({
      tableNumber: tbl.tableNumber,
      name: tbl.name,
      section: tbl.section,
      capacity: tbl.capacity,
      status: tbl.status,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet) return;
    setFormError(null);

    if (!formData.tableNumber.trim()) {
      return setFormError('Nomor meja wajib diisi');
    }

    setSubmitting(true);
    try {
      if (editingTable) {
        const res = await api.updateQrTable(editingTable.id, {
          tableNumber: formData.tableNumber.trim(),
          name: formData.name.trim(),
          section: formData.section.trim(),
          capacity: Number(formData.capacity) || 4,
          status: formData.status,
        });
        if (res.status === 'success') {
          await fetchTables();
          setIsFormOpen(false);
        } else {
          setFormError(res.message || 'Gagal mengubah meja');
        }
      } else {
        const res = await api.createQrTable({
          outletId: activeOutlet.id,
          tableNumber: formData.tableNumber.trim(),
          name: formData.name.trim(),
          section: formData.section.trim(),
          capacity: Number(formData.capacity) || 4,
        });
        if (res.status === 'success') {
          await fetchTables();
          setIsFormOpen(false);
        } else {
          setFormError(res.message || 'Gagal membuat meja');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTable = async (tbl: QrTable) => {
    const ok = await dialog.confirm({
      title: 'Hapus Meja QR',
      message: `Yakin ingin menghapus ${tbl.name} (${tbl.tableNumber})? Barcode QR meja ini tidak akan dapat diakses lagi oleh pelanggan.`,
      variant: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
    });
    if (!ok) return;

    try {
      const res = await api.deleteQrTable(tbl.id);
      if (res.status === 'success') {
        fetchTables();
        dialog.toast('Meja QR berhasil dihapus', 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menghapus Meja',
          message: res.message || 'Gagal menghapus meja.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Gagal menghubungi server.',
        variant: 'danger',
      });
    }
  };

  const handleToggleStatus = async (tbl: QrTable, newStatus: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED') => {
    try {
      const res = await api.updateQrTable(tbl.id, { status: newStatus });
      if (res.status === 'success') {
        setTables((prev) => prev.map((t) => (t.id === tbl.id ? { ...t, status: newStatus } : t)));
      }
    } catch (err) {
      console.error('Gagal memperbarui status meja:', err);
    }
  };

  const getTableMenuUrl = (tbl: QrTable) => {
    const origin = window.location.origin;
    return `${origin}/#menu?outletId=${tbl.outletId}&table=${tbl.tableNumber}`;
  };

  const handleCopyLink = (tbl: QrTable) => {
    const url = getTableMenuUrl(tbl);
    navigator.clipboard.writeText(url);
    setCopiedId(tbl.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter sections
  const sections = ['ALL', ...Array.from(new Set(tables.map((t) => t.section || 'Utama')))];
  const filteredTables = tables.filter((t) => {
    const matchQuery =
      t.tableNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.section.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSection = sectionFilter === 'ALL' || t.section === sectionFilter;
    return matchQuery && matchSection;
  });

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sectionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTables.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedTables = filteredTables.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const availableCount = tables.filter((t) => t.status === 'AVAILABLE').length;
  const occupiedCount = tables.filter((t) => t.status === 'OCCUPIED').length;
  const reservedCount = tables.filter((t) => t.status === 'RESERVED').length;

  if (!activeOutlet) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
        <Store className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="text-base font-black text-blue-950">Pilih Outlet Toko Terlebih Dahulu</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Silakan pilih outlet toko pada bilah navigasi atas untuk mengelola meja dan barcode QR.
        </p>
      </div>
    );
  }

  // ==========================================
  // RENDER: PRINT PREVIEW MODAL / OVERLAY
  // ==========================================
  if (previewTable) {
    const tableUrl = getTableMenuUrl(previewTable);
    const qrImage = generateQrPngUri(tableUrl, 320);

    return (
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col p-5 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
            <div>
              <h3 className="text-base font-black text-blue-950">Pratinjau Tent Card Meja</h3>
              <p className="text-xs text-slate-500">Format cetak kartu meja untuk ditempatkan di atas meja resto.</p>
            </div>
            <button
              onClick={() => setPreviewTable(null)}
              className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Printable Tent Card Container with smooth scroll */}
          <div className="flex-1 overflow-y-auto overscroll-contain py-4 pr-1">
            <div
              id="tent-card-print"
              className="border-2 border-blue-900 rounded-3xl p-6 text-center bg-radial from-white to-blue-50/50 shadow-inner space-y-4"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900 text-white text-[11px] font-black uppercase tracking-wider mb-2">
                  <span>{activeOutlet.name}</span>
                </div>
                <h2 className="text-3xl font-black text-blue-950 tracking-tight">{previewTable.name}</h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Area: {previewTable.section}</p>
              </div>

              {/* QR Code Container */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 inline-block mx-auto">
                <img src={qrImage} alt="QR Meja" className="w-44 h-44 sm:w-56 sm:h-56 mx-auto object-contain" />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-black text-blue-950">SCAN QR UNTUK PESAN</div>
                <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  Arahkan kamera smartphone Anda ke kode QR di atas untuk melihat buku menu & memesan langsung.
                </p>
              </div>

              <div className="pt-3 border-t border-blue-100 text-[11px] text-blue-900 font-bold flex items-center justify-center gap-2">
                <span>💵 Pesan Mandiri • Bayar di Kasir</span>
              </div>
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 shrink-0">
            <a
              href={tableUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 hover:underline self-start sm:self-auto"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Coba Buka Menu Tamu</span>
            </a>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={qrImage}
                download={`QR-${previewTable.tableNumber}.png`}
                className="flex-1 sm:flex-initial justify-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Simpan</span>
              </a>

              <button
                onClick={() => window.print()}
                className="flex-1 sm:flex-initial justify-center px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Kartu</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: PRINT ALL TABLES OVERLAY
  // ==========================================
  if (isPrintAllMode) {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-y-auto p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div>
            <h2 className="text-xl font-black text-blue-950">Lembar Cetak Semua Barcode Meja</h2>
            <p className="text-xs text-slate-500">
              Total {tables.length} meja siap dicetak untuk pemotongan dan laminating stiker/tent card.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPrintAllMode(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
            >
              Tutup
            </button>
            <button
              onClick={() => window.print()}
              className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {tables.map((tbl) => {
            const tableUrl = getTableMenuUrl(tbl);
            const qrImage = generateQrPngUri(tableUrl, 200);

            return (
              <div
                key={tbl.id}
                className="border-2 border-slate-300 rounded-2xl p-4 text-center space-y-2 bg-white break-inside-avoid"
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-blue-900">
                  {activeOutlet.name}
                </div>
                <div className="text-xl font-black text-blue-950">{tbl.name}</div>
                <div className="text-[10px] text-slate-500">Area: {tbl.section}</div>
                <img src={qrImage} alt="QR Meja" className="w-32 h-32 mx-auto object-contain my-1" />
                <div className="text-[11px] font-extrabold text-slate-900">Scan untuk Pesan</div>
                <div className="text-[9px] text-slate-500">Pesan Mandiri • Bayar di Kasir</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: FORM TAMBAH / UBAH MEJA (IN-PAGE)
  // ==========================================
  if (isFormOpen) {
    return (
      <div className="space-y-6 max-w-xl mx-auto pb-12">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsFormOpen(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors shadow-xs"
          >
            <span>&larr; Kembali ke Daftar Meja</span>
          </button>
          <div className="text-xs font-semibold text-slate-400">
            Meja / <span className="text-blue-950 font-bold">{editingTable ? 'Ubah Meja' : 'Tambah Meja'}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-xl font-black text-blue-950">
              {editingTable ? 'Ubah Data Meja' : 'Tambah Meja Baru'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kode meja akan otomatis terhubung ke link pemesanan tamu dan kode QR.
            </p>
          </div>

          {formError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nomor / Kode Meja <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.tableNumber}
                onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
                placeholder="Contoh: 01, 02, VIP-1, Outdoor-A"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama / Label Meja
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Meja 01 (Sofa Depan)"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Zona / Area Meja
                </label>
                <select
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 cursor-pointer"
                >
                  <option value="Indoor">Indoor (Dalam Ruangan)</option>
                  <option value="Outdoor">Outdoor (Luar Ruangan)</option>
                  <option value="Lantai 2">Lantai 2 (Rooftop/Balkon)</option>
                  <option value="VIP Room">VIP Room (Private)</option>
                  <option value="Bar">Bar / Counter</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kapasitas Tamu
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                />
              </div>
            </div>

            {editingTable && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Meja
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 cursor-pointer"
                >
                  <option value="AVAILABLE">Tersedia (Kosong)</option>
                  <option value="OCCUPIED">Terisi (Sedang Makan)</option>
                  <option value="RESERVED">Dipesan (Reserved)</option>
                </select>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-extrabold text-xs rounded-xl shadow-md disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Meja'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN LIST VIEW
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold mb-2">
            <QrCode className="w-3.5 h-3.5" />
            <span>Buku Menu QR Resto &bull; Toko: {activeOutlet.name}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-blue-950 tracking-tight flex items-center gap-2">
            <span>Manajemen Meja & Barcode QR</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Atur denah meja kafe/resto Anda, cetak tent card meja dengan barcode QR, dan biarkan tamu memesan langsung.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <a
            href={`/#menu?outletId=${activeOutlet?.id || ''}&table=${tables[0]?.tableNumber || '01'}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold rounded-2xl text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-2"
            title="Uji coba tampilan menu digital pelanggan di tab baru"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Pratinjau Menu Tamu</span>
          </a>

          <button
            onClick={() => setIsPrintAllMode(true)}
            disabled={tables.length === 0}
            className="px-4 py-3 bg-slate-50 hover:bg-slate-100 text-blue-950 border border-slate-200 font-bold rounded-2xl text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-blue-900" />
            <span>Cetak Semua Meja</span>
          </button>

          <button
            onClick={handleOpenCreateForm}
            className="px-5 py-3 bg-blue-900 hover:bg-blue-950 text-white font-extrabold rounded-2xl text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Meja</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-500 uppercase truncate block">Total Meja</span>
            <div className="text-2xl font-black text-blue-950 mt-1">{tables.length}</div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">Semua area terdata</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold shrink-0">
            <QrCode className="w-5 h-5 shrink-0" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-500 uppercase truncate block">Meja Kosong</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">{availableCount}</div>
            <p className="text-[11px] text-emerald-600 mt-0.5 truncate">Siap menerima tamu</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
            ✓
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-500 uppercase truncate block">Sedang Terisi</span>
            <div className="text-2xl font-black text-blue-900 mt-1">{occupiedCount}</div>
            <p className="text-[11px] text-blue-600 mt-0.5 truncate">Tamu sedang makan</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold shrink-0">
            <Users className="w-5 h-5 shrink-0" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-500 uppercase truncate block">Dipesan (Reserved)</span>
            <div className="text-2xl font-black text-amber-700 mt-1">{reservedCount}</div>
            <p className="text-[11px] text-amber-600 mt-0.5 truncate">Reservasi tamu</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
            ★
          </div>
        </div>
      </div>

      {/* Toolbar Filter & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor meja, nama, atau zona..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {sections.map((sec) => (
            <button
              key={sec}
              onClick={() => setSectionFilter(sec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                sectionFilter === sec
                  ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {sec === 'ALL' ? 'Semua Zona' : sec}
            </button>
          ))}

          <button
            onClick={fetchTables}
            title="Refresh Data"
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
          <div className="inline-block w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="font-semibold text-xs">Memuat daftar meja...</p>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <QrCode className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-sm text-slate-700">Tidak ada meja ditemukan</p>
          <p className="text-xs text-slate-400 mt-1">Tambahkan meja baru untuk mengaktifkan pemesanan QR.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {paginatedTables.map((tbl) => {
            const tableUrl = getTableMenuUrl(tbl);
            const qrImage = generateQrPngUri(tableUrl, 160);

            const statusBadge =
              tbl.status === 'AVAILABLE'
                ? { label: 'Tersedia', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                : tbl.status === 'OCCUPIED'
                ? { label: 'Terisi', color: 'bg-blue-50 text-blue-900 border-blue-200' }
                : { label: 'Dipesan', color: 'bg-amber-50 text-amber-700 border-amber-200' };

            return (
              <div
                key={tbl.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2.5 py-1 rounded-xl bg-blue-50 text-blue-950 font-black text-sm border border-blue-200">
                      Meja {tbl.tableNumber}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1.5">{tbl.name}</h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>Area: {tbl.section}</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-0.5">
                        <Users className="w-3 h-3" /> {tbl.capacity} Org
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${statusBadge.color}`}>
                    {statusBadge.label}
                  </span>
                </div>

                {/* QR Preview & Action Area */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setPreviewTable(tbl)}
                    className="group relative block shrink-0"
                    title="Klik untuk Pratinjau Tent Card & Cetak"
                  >
                    <img
                      src={qrImage}
                      alt="QR Code"
                      className="w-16 h-16 rounded-xl border border-slate-200 bg-white p-1 group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-blue-900/20 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <button
                      onClick={() => setPreviewTable(tbl)}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-blue-900 border border-slate-200 hover:border-blue-200 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Tent Card</span>
                    </button>

                    <button
                      onClick={() => handleCopyLink(tbl)}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      title="Salin Link Menu Meja"
                    >
                      {copiedId === tbl.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === tbl.id ? 'Tersalin!' : 'Salin Link'}</span>
                    </button>

                    <a
                      href={tableUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full text-left px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Uji coba buka menu meja ini di browser"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Menu</span>
                    </a>
                  </div>
                </div>

                {/* Quick Status Toggle & Card Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {tbl.status !== 'AVAILABLE' && (
                      <button
                        onClick={() => handleToggleStatus(tbl, 'AVAILABLE')}
                        className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition-colors"
                        title="Kosongkan Meja"
                      >
                        Kosongkan
                      </button>
                    )}
                    {tbl.status !== 'OCCUPIED' && (
                      <button
                        onClick={() => handleToggleStatus(tbl, 'OCCUPIED')}
                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 text-[11px] font-bold transition-colors"
                        title="Tandai Terisi"
                      >
                        Isi
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditForm(tbl)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-900 text-slate-600 transition-colors"
                      title="Ubah Meja"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTable(tbl)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 transition-colors"
                      title="Hapus Meja"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* Pagination Meja QR */}
          {!loading && filteredTables.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <TablePagination
                currentPage={safeCurrentPage}
                pageSize={pageSize}
                totalItems={filteredTables.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="meja"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
