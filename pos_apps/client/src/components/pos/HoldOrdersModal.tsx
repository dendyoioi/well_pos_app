import React from 'react';
import { Bookmark, Clock, Trash2, ArrowRight } from 'lucide-react';
import type { HoldOrder } from '../../types/order';
import { Modal, Button, Badge } from '../ui';

export interface HoldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldOrders: HoldOrder[];
  onResumeOrder: (order: HoldOrder) => void;
  onDeleteHeldOrder: (orderId: string) => void;
}

export const HoldOrdersModal: React.FC<HoldOrdersModalProps> = ({
  isOpen,
  onClose,
  heldOrders,
  onResumeOrder,
  onDeleteHeldOrder,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daftar Pesanan Ditahan (Hold Orders)"
      subtitle="Pilih pesanan pelanggan yang tertunda untuk melanjutkan proses pembayaran kasir."
      size="xl"
    >
      <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
        {heldOrders.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Bookmark className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">Tidak ada antrean pesanan yang ditahan</p>
            <p className="text-xs text-slate-400 mt-1">
              Gunakan tombol "Tahan Antrean" di keranjang kasir untuk menyimpan pesanan sementara.
            </p>
          </div>
        ) : (
          heldOrders.map((order) => {
            const totalItems = (order.items || []).reduce((acc, item) => acc + item.quantity, 0);
            const totalAmount = order.totalAmount || (order.items || []).reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
            const timeAgo = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }) : '-';

            return (
              <div
                key={order.id}
                className="p-4 bg-white border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 hover:border-blue-900/30 hover:shadow-xs transition-all"
              >
                <div className="min-w-0 space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {order.customerName || 'Pelanggan Tanpa Nama'}
                    </h4>
                    {order.channel && (
                      <Badge variant="primary" size="sm">
                        {order.channel}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium flex-wrap">
                    <span className="flex items-center gap-1 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {timeAgo}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span>{totalItems} item menu</span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="font-bold text-blue-950">
                      Rp {totalAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                  {order.note && (
                    <p className="text-[11px] text-amber-800 bg-amber-50/60 border border-amber-200/60 rounded-lg px-2.5 py-1 font-medium">
                      Catatan: {order.note}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => onDeleteHeldOrder(order.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Hapus Antrean"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                    iconPosition="right"
                    onClick={() => {
                      onResumeOrder(order);
                      onClose();
                    }}
                    className="text-xs font-bold"
                  >
                    Lanjutkan
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
