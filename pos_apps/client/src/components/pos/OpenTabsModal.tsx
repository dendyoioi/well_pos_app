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
      size="lg"
    >
      <div className="space-y-3">
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
                className="p-4 bg-white border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-blue-900/30 hover:shadow-xs transition-all"
              >
                {/* Left: Table & Customer Info */}
                <div className="min-w-0 space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {tab.queueNumber !== undefined && tab.queueNumber !== null && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 border border-amber-300 font-black text-xs">
                        #{String(tab.queueNumber).padStart(2, '0')}
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-xl bg-blue-900 text-white font-black text-xs shadow-xs">
                      {tab.tableNumber ? `Meja ${tab.tableNumber}` : 'Tanpa Meja'}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {tab.customerName || 'Pelanggan'}
                    </h4>
                    <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      #{tab.invoiceNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                    <span className="flex items-center gap-1 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {timeAgo}
                    </span>
                    <span>&bull;</span>
                    <span>{totalItems} item pesanan</span>
                    <span>&bull;</span>
                    <span className="font-black text-blue-900 text-sm">
                      {formatRupiah(tab.grandTotal)}
                    </span>
                  </div>

                  {/* Items snapshot summary */}
                  {tab.items && tab.items.length > 0 && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 rounded-xl px-2.5 py-1.5 border border-slate-100 line-clamp-1">
                      {tab.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                    </div>
                  )}

                  {tab.notes && (
                    <p className="text-[11px] text-amber-700 font-medium">
                      Catatan: {tab.notes}
                    </p>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await dialog.confirm({
                        title: 'Batalkan Tagihan Meja',
                        message: `Batalkan tagihan Meja ${tab.tableNumber || ''} (#${tab.invoiceNumber})?`,
                        variant: 'danger',
                        confirmText: 'Ya, Batalkan',
                        cancelText: 'Kembali',
                      });
                      if (ok) {
                        onCancelOpenTab(tab.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Batalkan Tagihan Meja"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onPullOpenTab(tab, false);
                      onClose();
                    }}
                    title="Tarik ke kasir untuk melihat rincian atau menambah pesanan menu baru"
                    className="text-xs"
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
            );
          })
        )}
      </div>
    </Modal>
  );
};
