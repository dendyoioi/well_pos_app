import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Send,
  ExternalLink,
  X,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import type { Outlet } from '../../types/outlet';
import { TablePagination } from '../TablePagination';
import { TableSkeleton, EmptyState } from '../ui';
import { useDialog } from '../../context/DialogContext';
import { formatRupiah } from '../../utils/currency';

interface LaundryCustomerWinbackTabProps {
  activeOutlet?: Outlet | null;
}

interface DormantCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  tier?: string;
  totalSpent: number;
  visitCount: number;
  lastOrderAt?: string | null;
  lastInvoiceNumber?: string | null;
  lastWinbackSentAt?: string | null;
  daysInactive: number;
}

export const LaundryCustomerWinbackTab: React.FC<LaundryCustomerWinbackTabProps> = ({ activeOutlet }) => {
  const dialog = useDialog();

  const [inactiveDaysFilter, setInactiveDaysFilter] = useState<number>(30);
  const [search, setSearch] = useState<string>('');
  const [customers, setCustomers] = useState<DormantCustomer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Win-back Send Modal
  const [selectedCustomer, setSelectedCustomer] = useState<DormantCustomer | null>(null);
  const [customDiscountText, setCustomDiscountText] = useState<string>('Diskon 10% untuk cuci berikutnya');
  const [sendingWinback, setSendingWinback] = useState<boolean>(false);

  const fetchDormantCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.getDormantLaundryCustomers({
        outletId: activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.id : undefined,
        inactiveDays: inactiveDaysFilter,
      });

      const rawList: any[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as any)?.customers)
        ? (res.data as any).customers
        : [];

      const normalized: DormantCustomer[] = rawList.map((r) => ({
        id: r.id || r.customerId,
        name: r.name,
        phone: r.phone,
        email: r.email,
        tier: r.tier,
        totalSpent: Number(r.totalSpent || 0),
        visitCount: Number(r.visitCount || r.totalOrders || 0),
        lastOrderAt: r.lastOrderAt,
        lastInvoiceNumber: r.lastInvoiceNumber,
        lastWinbackSentAt: r.lastWinbackSentAt,
        daysInactive: Number(r.daysInactive || r.daysSinceLastOrder || 0),
      }));

      setCustomers(normalized);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDormantCustomers();
    setCurrentPage(1);
  }, [activeOutlet?.id, inactiveDaysFilter]);

  // Filter Search
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.lastInvoiceNumber && c.lastInvoiceNumber.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  const getCooldownInfo = (lastWinbackSentAt?: string | null) => {
    if (!lastWinbackSentAt) return { isCooldown: false, daysAgo: 0, text: 'Siap Dikirim' };
    const sentDate = new Date(lastWinbackSentAt).getTime();
    const now = Date.now();
    const diffDays = Math.floor((now - sentDate) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return {
        isCooldown: true,
        daysAgo: diffDays,
        text: `Terkirim ${diffDays === 0 ? 'hari ini' : `${diffDays} hari lalu`} (Cooldown 7 hari)`,
      };
    }
    return {
      isCooldown: false,
      daysAgo: diffDays,
      text: `Pernah dikirim ${diffDays} hari lalu`,
    };
  };

  const handleOpenSendModal = (customer: DormantCustomer) => {
    setSelectedCustomer(customer);
    setCustomDiscountText('Diskon 10% untuk cuci berikutnya');
  };

  const handleSendViaGateway = async () => {
    if (!selectedCustomer) return;
    try {
      setSendingWinback(true);
      const res = await api.sendCustomerWinback(selectedCustomer.id, {
        outletId: activeOutlet?.id,
        customMessage: customDiscountText.trim() ? `Voucher Spesial: ${customDiscountText.trim()}` : undefined,
      });

      if (res.status === 'success') {
        dialog.toast(res.message || 'Pesan win-back berhasil dikirim via WhatsApp Gateway!', 'success');
        setSelectedCustomer(null);
        fetchDormantCustomers();
      } else {
        dialog.toast(res.message || 'Gagal mengirim pesan WhatsApp Gateway', 'error');
      }
    } catch {
      dialog.toast('Terjadi kesalahan saat memproses WhatsApp Gateway', 'error');
    } finally {
      setSendingWinback(false);
    }
  };

  const handleSendViaWebWa = () => {
    if (!selectedCustomer || !selectedCustomer.phone) {
      dialog.toast('Nomor telepon pelanggan tidak tersedia', 'error');
      return;
    }

    let phone = selectedCustomer.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

    const storeName = activeOutlet?.name || 'Well POS Laundry';
    const promoNote = customDiscountText.trim() ? `\n\n🎁 *Promo Spesial Untuk Anda:*\n${customDiscountText.trim()}` : '';

    const text = `Halo Kak *${selectedCustomer.name}*! 👋

Sudah lama nih pakaian Kakak tidak mampir di *${storeName}* (${selectedCustomer.daysInactive} hari lalu terakhir berkunjung). Kami rindu memberikan cucian wangi & rapi untuk Kakak! ✨${promoNote}

Yuk laundry pakaian Kakak hari ini. Kami siap melayani dengan sepenuh hati! 🧺

*${storeName}*`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    setSelectedCustomer(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header Banner Win-Back */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-amber-50 text-amber-700 font-black">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Pelanggan Pasif &amp; Win-Back CRM
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Identifikasi pelanggan yang sudah lama tidak berkunjung. Sapa kembali secara personal via WhatsApp resmi toko dengan voucher diskon agar tidak beralih ke laundry lain.
          </p>
        </div>

        {/* Filter Preset Hari */}
        <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0 self-start md:self-auto">
          {[
            { days: 14, label: '> 14 Hari', color: 'text-amber-700' },
            { days: 30, label: '> 30 Hari', color: 'text-orange-700' },
            { days: 60, label: '> 60 Hari', color: 'text-rose-700' },
          ].map((preset) => (
            <button
              key={preset.days}
              type="button"
              onClick={() => setInactiveDaysFilter(preset.days)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                inactiveDaysFilter === preset.days
                  ? 'bg-blue-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama pelanggan, nomor WhatsApp, nomor nota..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-900 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-600 shrink-0">
          <span>Ditemukan:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 font-mono font-black border border-blue-200">
            {filteredCustomers.length} Pelanggan Pasif
          </span>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Users className="w-8 h-8 text-slate-400" />}
              title="Tidak Ada Pelanggan Pasif"
              description={`Semua pelanggan aktif mencuci dalam kurun waktu ${inactiveDaysFilter} hari terakhir. Bagus sekali!`}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Pelanggan</th>
                    <th className="py-3 px-4">Terakhir Cuci</th>
                    <th className="py-3 px-4">Hari Pasif</th>
                    <th className="py-3 px-4">Total Belanja</th>
                    <th className="py-3 px-4">Status Win-Back</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCustomers.map((c) => {
                    const cooldown = getCooldownInfo(c.lastWinbackSentAt);
                    const isOverdueAlert = c.daysInactive >= 60;
                    const isWarningAlert = c.daysInactive >= 30;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            {c.phone ? (
                              <span className="font-mono text-slate-600">{c.phone}</span>
                            ) : (
                              <span className="text-slate-400 italic">Tanpa Nomor WA</span>
                            )}
                            {c.tier && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-blue-100 text-blue-900">
                                {c.tier}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700">
                          {c.lastOrderAt ? (
                            <div>
                              <div className="font-bold">
                                {new Date(c.lastOrderAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Nota {c.lastInvoiceNumber || '-'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Belum ada nota</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black ${
                              isOverdueAlert
                                ? 'bg-rose-100 text-rose-800'
                                : isWarningAlert
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>{c.daysInactive} Hari</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-mono font-black text-slate-900">
                            {formatRupiah(c.totalSpent)}
                          </div>
                          <div className="text-[10px] text-slate-400">{c.visitCount}x Transaksi</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                              cooldown.isCooldown ? 'text-amber-700' : 'text-slate-600'
                            }`}
                          >
                            {cooldown.isCooldown ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                            <span>{cooldown.text}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenSendModal(c)}
                            disabled={!c.phone}
                            className={`px-3 py-1.5 rounded-xl font-black text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                              cooldown.isCooldown
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'bg-blue-900 hover:bg-blue-800 text-white shadow-2xs active:scale-95'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                            title={
                              cooldown.isCooldown
                                ? 'Pelanggan sudah disapa baru-baru ini. Buka untuk opsi paksa kirim / wa.me.'
                                : 'Kirim pesan sapaan & voucher win-back'
                            }
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{cooldown.isCooldown ? 'Kirim Ulang' : 'Kirim WA'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Standard */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/50">
              <TablePagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filteredCustomers.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Kirim Pesan Win-Back (Responsive Bottom Sheet & Sticky Footer) */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-black">
                  <MessageSquare className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Sapa Pelanggan (Win-Back)</h3>
                  <p className="text-xs text-slate-500">
                    {selectedCustomer.name} ({selectedCustomer.daysInactive} hari pasif)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
              {getCooldownInfo(selectedCustomer.lastWinbackSentAt).isCooldown && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black block">Perlindungan Anti-Spam:</span>
                    <span>
                      Pelanggan ini baru saja disapa {getCooldownInfo(selectedCustomer.lastWinbackSentAt).daysAgo} hari yang lalu. Hindari pengiriman pesan terlalu sering agar pelanggan tidak merasa terganggu.
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Voucher / Promo Spesial untuk Pelanggan (Opsional):
                </label>
                <input
                  type="text"
                  value={customDiscountText}
                  onChange={(e) => setCustomDiscountText(e.target.value)}
                  placeholder="Contoh: Diskon 10% atau Gratis Antar-Jemput..."
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-900"
                />
              </div>

              {/* Preview Bubble Pesan WA */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-600">Pratinjau Pesan WhatsApp:</span>
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl text-[11px] text-slate-800 space-y-2 leading-relaxed">
                  <p>
                    Halo Kak <strong>{selectedCustomer.name}</strong>! 👋
                  </p>
                  <p>
                    Sudah lama nih pakaian Kakak tidak mampir di <strong>{activeOutlet?.name || 'Well POS Laundry'}</strong> ({selectedCustomer.daysInactive} hari lalu terakhir berkunjung). Kami rindu memberikan cucian wangi &amp; rapi untuk Kakak! ✨
                  </p>
                  {customDiscountText.trim() && (
                    <div className="p-2 bg-white rounded-xl border border-emerald-200 text-emerald-900 font-bold">
                      🎁 Promo Spesial: {customDiscountText.trim()}
                    </div>
                  )}
                  <p>Yuk laundry pakaian Kakak hari ini. Kami siap melayani dengan sepenuh hati! 🧺</p>
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer text-center"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSendViaWebWa}
                className="px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                <span>Buka wa.me</span>
              </button>

              <button
                type="button"
                onClick={handleSendViaGateway}
                disabled={sendingWinback}
                className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingWinback ? 'Mengirim...' : 'Kirim via Gateway'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
