import React, { useState, useRef, useEffect } from 'react';
import {
  Store,
  Clock,
  Lock,
  FileText,
  Bookmark,
  Shield,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  QrCode,
  Globe,
  ChevronDown,
  ArrowDownCircle,
  Smartphone,
} from 'lucide-react';
import type { Outlet, SalesChannelConfig } from '../../types/outlet';
import { normalizeSalesChannels } from '../../types/outlet';
import type { Shift } from '../../types/shift';
import type { OrderChannel } from '../../types/order';
import { Button, Badge } from '../ui';

export interface PosHeaderProps {
  activeOutlet?: Outlet | null;
  currentShift: Shift | null;
  orderChannel: OrderChannel;
  onChangeOrderChannel: (channel: OrderChannel) => void;
  heldOrdersCount: number;
  onOpenHeldOrders: () => void;
  openTabsCount?: number;
  onOpenOpenTabs?: () => void;
  qrOrdersCount?: number;
  onOpenQrOrders?: () => void;
  onOpenStartShift: () => void;
  onOpenCloseShift: () => void;
  onOpenXReport: () => void;
  onOpenCashExpense?: () => void;
  onOpenSupervisorFees?: () => void;
  currentUserRole?: string;
  channelsConfig?: SalesChannelConfig[];
  onToggleHandheldMode?: () => void;
}

export const PosHeader: React.FC<PosHeaderProps> = ({
  activeOutlet,
  currentShift,
  orderChannel,
  onChangeOrderChannel,
  heldOrdersCount,
  onOpenHeldOrders,
  openTabsCount = 0,
  onOpenOpenTabs,
  qrOrdersCount = 0,
  onOpenQrOrders,
  onOpenStartShift,
  onOpenCloseShift,
  onOpenXReport,
  onOpenCashExpense,
  onOpenSupervisorFees,
  currentUserRole,
  channelsConfig,
  onToggleHandheldMode,
}) => {
  const [onlineDropdownOpen, setOnlineDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOnlineDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const allChannels: SalesChannelConfig[] = normalizeSalesChannels(
    channelsConfig && channelsConfig.length > 0 ? channelsConfig : activeOutlet?.channelsConfig
  );

  const directChannels = allChannels.filter(
    (c) => c.group === 'OFFLINE_DIRECT' && c.isActive
  );

  const onlineChannels = allChannels.filter(
    (c) => c.group === 'ONLINE_DELIVERY' && c.isActive
  );

  const isOnlineSelected = onlineChannels.some((c) => c.code === orderChannel);
  const activeOnlineChannel = onlineChannels.find((c) => c.code === orderChannel);

  const channelIcons: Record<string, React.ReactNode> = {
    DINE_IN: <UtensilsCrossed className="w-3.5 h-3.5" />,
    TAKEAWAY: <ShoppingBag className="w-3.5 h-3.5" />,
    DELIVERY: <Bike className="w-3.5 h-3.5" />,
    GOFOOD: <Bike className="w-3.5 h-3.5 text-rose-500" />,
    GRABFOOD: <Bike className="w-3.5 h-3.5 text-emerald-500" />,
    SHOPEEFOOD: <Bike className="w-3.5 h-3.5 text-orange-500" />,
    QR_MENU: <QrCode className="w-3.5 h-3.5" />,
  };

  const isSupervisorOrAbove = ['SUPERADMIN', 'OWNER', 'MANAGER', 'SUPERVISOR'].includes(
    currentUserRole?.toUpperCase() || ''
  );

  return (
    <div className="bg-white border-b border-slate-200/80 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
      {/* Left: Outlet Identity & Shift Status */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shadow-xs">
          <Store className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-900 tracking-tight">
              {activeOutlet?.name || 'Outlet Utama'}
            </h2>
            {currentShift ? (
              <Badge variant="success" size="sm" dot>
                Shift Aktif
              </Badge>
            ) : (
              <Badge variant="warning" size="sm" dot>
                Shift Tutup
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {currentShift
              ? `Modal Awal: Rp ${(currentShift.startingCash || 0).toLocaleString('id-ID')}`
              : 'Kasir belum membuka shift'}
          </p>
        </div>
      </div>

      {/* Middle: Order Channel Selector (Penjualan Langsung & Mitra Online Delivery) */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
        {/* Direct Channels */}
        {directChannels.map((ch) => {
          const isSelected = orderChannel === ch.code;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => {
                setOnlineDropdownOpen(false);
                onChangeOrderChannel(ch.code as OrderChannel);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-blue-900 text-white shadow-xs shadow-blue-900/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {channelIcons[ch.code] || <UtensilsCrossed className="w-3.5 h-3.5" />}
              <span>{ch.name.split(' (')[0]}</span>
            </button>
          );
        })}

        {/* Separator */}
        {onlineChannels.length > 0 && <div className="h-4 w-px bg-slate-300 mx-0.5" />}

        {/* Mitra Online Delivery Dropdown */}
        {onlineChannels.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setOnlineDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isOnlineSelected
                  ? 'bg-blue-900 text-white shadow-xs shadow-blue-900/20'
                  : 'text-blue-900 hover:bg-blue-50/80 bg-white/70 border border-blue-200/60'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>
                {isOnlineSelected && activeOnlineChannel
                  ? `Mitra: ${activeOnlineChannel.name}`
                  : 'Mitra Online'}
              </span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  onlineDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {onlineDropdownOpen && (
              <div className="absolute top-full right-0 sm:left-auto mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Pilih Mitra Online Delivery
                </div>
                {onlineChannels.map((partner) => {
                  const isCurSelected = orderChannel === partner.code;
                  return (
                    <button
                      key={partner.id}
                      type="button"
                      onClick={() => {
                        onChangeOrderChannel(partner.code as OrderChannel);
                        setOnlineDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left ${
                        isCurSelected
                          ? 'bg-blue-50 text-blue-950 font-black'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: partner.color || '#2563eb' }}
                        />
                        <span className="truncate">{partner.name}</span>
                      </div>
                      {partner.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                          {partner.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Open Tabs / Tagihan Meja Terbuka */}
        {onOpenOpenTabs && (
          <Button
            variant={openTabsCount > 0 ? 'amber' : 'outline'}
            size="sm"
            icon={<UtensilsCrossed className="w-3.5 h-3.5" />}
            onClick={onOpenOpenTabs}
            className="relative text-xs"
            title="Daftar Tagihan Meja Terbuka (Bayar Nanti)"
          >
            <span>Tagihan Meja</span>
            {openTabsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs">
                {openTabsCount}
              </span>
            )}
          </Button>
        )}

        {/* QR Orders from Tables Toggle */}
        {onOpenQrOrders && (
          <Button
            variant={qrOrdersCount > 0 ? 'primary' : 'outline'}
            size="sm"
            icon={<QrCode className="w-3.5 h-3.5" />}
            onClick={onOpenQrOrders}
            className={`relative text-xs ${qrOrdersCount > 0 ? 'animate-pulse' : ''}`}
            title="Tarik Pesanan Pelanggan dari Meja QR"
          >
            <span>Pesanan QR Meja</span>
            {qrOrdersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-blue-900 text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs">
                {qrOrdersCount}
              </span>
            )}
          </Button>
        )}

        {/* Held Orders Drawer Toggle */}
        <Button
          variant={heldOrdersCount > 0 ? 'amber' : 'outline'}
          size="sm"
          icon={<Bookmark className="w-3.5 h-3.5" />}
          onClick={onOpenHeldOrders}
          className="relative text-xs"
        >
          <span>Tahan Pesanan</span>
          {heldOrdersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-slate-950 text-amber-400 text-[10px] font-black flex items-center justify-center shrink-0">
              {heldOrdersCount}
            </span>
          )}
        </Button>

        {/* Supervisor Fees Toggle */}
        {isSupervisorOrAbove && onOpenSupervisorFees && (
          <Button
            variant="outline"
            size="sm"
            icon={<Shield className="w-3.5 h-3.5 text-blue-900" />}
            onClick={onOpenSupervisorFees}
            className="text-xs"
            title="Kelola Pajak, Service Charge, & Biaya Antar"
          >
            <span className="hidden sm:inline">Biaya &amp; Pajak</span>
          </Button>
        )}

        {/* Toggle Mode Handheld / HP */}
        {onToggleHandheldMode && (
          <Button
            variant="outline"
            size="sm"
            icon={<Smartphone className="w-3.5 h-3.5 text-blue-900" />}
            onClick={onToggleHandheldMode}
            className="text-xs"
            title="Beralih ke Tampilan Handheld Smartphone (6.8 Inch)"
          >
            <span className="hidden sm:inline">Mode HP</span>
          </Button>
        )}

        {/* Shift Actions */}
        {currentShift ? (
          <>
            {onOpenCashExpense && (
              <Button
                variant="outline"
                size="sm"
                icon={<ArrowDownCircle className="w-3.5 h-3.5 text-rose-600" />}
                onClick={onOpenCashExpense}
                className="text-xs border-rose-200 hover:bg-rose-50 text-rose-700 font-bold"
                title="Catat Pengeluaran Uang Kasir (Petty Cash Out)"
              >
                <span>Kas Keluar</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={<FileText className="w-3.5 h-3.5 text-slate-600" />}
              onClick={onOpenXReport}
              className="text-xs"
            >
              <span className="hidden sm:inline">X-Report</span>
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Lock className="w-3.5 h-3.5" />}
              onClick={onOpenCloseShift}
              className="text-xs"
            >
              <span>Tutup Shift</span>
            </Button>
          </>
        ) : (
          <Button
            variant="success"
            size="sm"
            icon={<Clock className="w-3.5 h-3.5 text-emerald-100" />}
            onClick={onOpenStartShift}
            className="text-xs"
          >
            <span>Buka Shift</span>
          </Button>
        )}
      </div>
    </div>
  );
};
