import React from 'react';
import { UtensilsCrossed, Clock, Trash2, CreditCard } from 'lucide-react';
import type { OpenTabOrder } from '../../types/order';
import { Modal, Button } from '../ui';
import { formatRupiah } from '../../utils/currency';
import { useDialog } from '../../context/DialogContext';

export interface OpenTabsModalProps {
  isOpen: boolean;
  onClose: () => void;
  openTabs: OpenTabOrder[];
  onPullOpenTab: (tab: OpenTabOrder, openPaymentImmediately?: boolean) => void;
  onCancelOpenTab: (tabId: string) => void;
}

export const OpenTabsModal: React.FC<OpenTabsModalProps> = ({
  isOpen,
  onClose,
  openTabs,
  onPullOpenTab,
  onCancelOpenTab,
}) => {
  const dialog = useDialog();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daftar Tagihan Meja Terbuka (Open Tabs)"
      subtitle="Kelola pesanan pelanggan meja yang bayar belakangan. Anda dapat menambah menu atau melakukan pelunasan tagihan."
      size="xl"
    >
      <div className="space-y-3.5">
        {openTabs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-1" />
            <p className="text-sm font-bold text-slate-700">Tidak ada tagihan meja yang terbuka</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Saat customer memesan makan di tempat (Dine In), gunakan tombol{' '}
              <span className="font-semibold text-blue-900">"Simpan &amp; Kirim Dapur (Bayar Nanti)"</span> di keranjang kasir untuk mencatat tagihan meja.
            </p>
          </div>
        ) : (
          openTabs.map((tab) => {
            const totalItems = (tab.items || []).reduce((acc, item) => acc + item.quantity, 0);
            const timeAgo = tab.createdAt
              ? new Date(tab.createdAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '-';

            return (
              <div
                key={tab.id}
                className="p-4 bg-white border border-slate-200/90 rounded-2xl flex flex-col gap-3 hover:border-blue-900/30 hover:shadow-xs transition-all"
              >
                {/* 1. Header Kartu: Status Meja, Nama Pelanggan, Faktur, Waktu & Batal */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                    {tab.queueNumber !== undefined && tab.queueNumber !== null && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 border border-amber-300 font-black text-xs shrink-0">
                        #{String(tab.queueNumber).padStart(2, '0')}
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-xl bg-blue-900 text-white font-black text-xs shadow-xs shrink-0">
                      {tab.tableNumber ? `Meja ${tab.tableNumber}` : 'Tanpa Meja'}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {tab.customerName || 'Pelanggan'}
                    </h4>
                    <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                      #{tab.invoiceNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {timeAgo}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await dialog.confirm({
                          title: 'Batalkan Tagihan Meja',
                          message: `Batalkan tagihan ${tab.tableNumber ? `Meja ${tab.tableNumber}` : 'Tanpa Meja'} (#${tab.invoiceNumber})?`,
                          variant: 'danger',
                          confirmText: 'Ya, Batalkan',
                          cancelText: 'Kembali',
                        });
                        if (ok) {
                          onCancelOpenTab(tab.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Batalkan Tagihan Meja"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 2. Body Kartu: Daftar Item Menu yang Lapang & Tidak Terpotong */}
                {tab.items && tab.items.length > 0 && (
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100/90 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>Rincian Pesanan:</span>
                      <span className="font-bold text-slate-600">{totalItems} item</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {tab.items.map((i, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-slate-200/80 text-xs font-medium text-slate-700 shadow-2xs"
                        >
                          <strong className="text-blue-900 font-black mr-1.5">{i.quantity}x</strong>
                          <span>{i.productName}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Catatan Pesanan (jika ada) */}
                {tab.notes && (
                  <div className="text-xs text-amber-900 bg-amber-50/70 border border-amber-200/70 rounded-xl px-3 py-2 font-medium">
                    <span className="font-bold">Catatan:</span> {tab.notes}
                  </div>
                )}

                {/* 4. Footer Kartu: Total Tagihan & Tombol Aksi */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 gap-3 flex-wrap">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Total Tagihan
                    </span>
                    <span className="font-black text-blue-950 text-base sm:text-lg">
                      {formatRupiah(tab.grandTotal)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onPullOpenTab(tab, false);
                        onClose();
                      }}
                      title="Tarik ke kasir untuk melihat rincian atau menambah pesanan menu baru"
                      className="text-xs font-bold"
                    >
                      <span>Tarik ke Kasir</span>
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      icon={<CreditCard className="w-3.5 h-3.5" />}
                      onClick={() => {
                        onPullOpenTab(tab, true);
                        onClose();
                      }}
                      title="Langsung buka pembayaran untuk pelunasan tagihan meja"
                      className="text-xs font-black shadow-xs shadow-blue-900/20"
                    >
                      <span>Bayar / Pelunasan</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
};
