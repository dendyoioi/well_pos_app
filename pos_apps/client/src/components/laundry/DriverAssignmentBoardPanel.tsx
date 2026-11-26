import React, { useState, useEffect } from 'react';
import {
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  User,
  Search,
  X,
  AlertCircle,
  Package,
  ChevronDown,
  Info,
} from 'lucide-react';
import { laundryCore3Api } from '../../services/api';
import type {
  DriverBoardResponse,
  LaundryPickupRequestRecord,
  DriverBoardDeliveryTask,
  PickupRequestStatus,
} from '../../types/laundry_core3';

interface DriverAssignmentBoardPanelProps {
  activeOutlet?: { id: string; name: string } | null;
}

export const DriverAssignmentBoardPanel: React.FC<DriverAssignmentBoardPanelProps> = ({
  activeOutlet,
}) => {
  const [boardData, setBoardData] = useState<DriverBoardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<'pickups' | 'deliveries'>('pickups');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Mini Modal: Tugaskan Kurir
  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean;
    pickup: LaundryPickupRequestRecord | null;
    courierName: string;
    courierPhone: string;
    routeOrder: string;
    status: PickupRequestStatus;
    submitting: boolean;
  }>({
    isOpen: false,
    pickup: null,
    courierName: '',
    courierPhone: '',
    routeOrder: '1',
    status: 'DRIVER_ASSIGNED',
    submitting: false,
  });

  // Mini Modal: Gagal Jemput
  const [failedPickupModal, setFailedPickupModal] = useState<{
    isOpen: boolean;
    pickup: LaundryPickupRequestRecord | null;
    reason: string;
    rescheduledAt: string;
    submitting: boolean;
  }>({
    isOpen: false,
    pickup: null,
    reason: '',
    rescheduledAt: '',
    submitting: false,
  });

  // Mini Modal: Gagal Antar Pesanan
  const [failedDeliveryModal, setFailedDeliveryModal] = useState<{
    isOpen: boolean;
    delivery: DriverBoardDeliveryTask | null;
    reason: string;
    rescheduledAt: string;
    submitting: boolean;
  }>({
    isOpen: false,
    delivery: null,
    reason: '',
    rescheduledAt: '',
    submitting: false,
  });

  const loadBoard = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await laundryCore3Api.getDriverBoard(activeOutlet?.id);
      if (res.status === 'success' && res.data) {
        setBoardData(res.data);
      } else {
        setErrorMsg(res.message || 'Gagal memuat papan tugas kurir.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan saat memuat papan kurir.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [activeOutlet?.id]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Handler Simpan Penugasan Kurir
  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!assignModal.pickup) return;

    try {
      setAssignModal((prev) => ({ ...prev, submitting: true }));
      const payload = {
        courierName: assignModal.courierName.trim() || null,
        courierPhone: assignModal.courierPhone.trim() || null,
        routeOrder: assignModal.routeOrder ? parseInt(assignModal.routeOrder, 10) : null,
        status: assignModal.status,
      };

      const res = await laundryCore3Api.assignPickupRequest(assignModal.pickup.id, payload);
      if (res.status === 'success') {
        showToast(`Penugasan kurir untuk #${assignModal.pickup.requestCode} berhasil disimpan!`);
        setModalError(null);
        setAssignModal({
          isOpen: false,
          pickup: null,
          courierName: '',
          courierPhone: '',
          routeOrder: '1',
          status: 'DRIVER_ASSIGNED',
          submitting: false,
        });
        loadBoard();
      } else {
        setModalError(res.message || 'Gagal menyimpan penugasan kurir');
      }
    } catch {
      setModalError('Terjadi kesalahan koneksi saat menugaskan kurir.');
    } finally {
      setAssignModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Handler Simpan Gagal Jemput
  const handleSaveFailedPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!failedPickupModal.pickup) return;
    if (!failedPickupModal.reason.trim()) {
      setModalError('Alasan kegagalan jemput wajib diisi.');
      return;
    }

    try {
      setFailedPickupModal((prev) => ({ ...prev, submitting: true }));
      const payload = {
        reason: failedPickupModal.reason.trim(),
        rescheduledAt: failedPickupModal.rescheduledAt
          ? new Date(failedPickupModal.rescheduledAt).toISOString()
          : null,
      };

      const res = await laundryCore3Api.markPickupFailedAttempt(failedPickupModal.pickup.id, payload);
      if (res.status === 'success') {
        showToast(`Percobaan gagal jemput #${failedPickupModal.pickup.requestCode} berhasil dicatat.`);
        setModalError(null);
        setFailedPickupModal({
          isOpen: false,
          pickup: null,
          reason: '',
          rescheduledAt: '',
          submitting: false,
        });
        loadBoard();
      } else {
        setModalError(res.message || 'Gagal mencatat percobaan');
      }
    } catch {
      setModalError('Terjadi kesalahan saat mencatat kegagalan jemput.');
    } finally {
      setFailedPickupModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Handler Simpan Gagal Antar Pesanan
  const handleSaveFailedDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!failedDeliveryModal.delivery) return;
    if (!failedDeliveryModal.reason.trim()) {
      setModalError('Alasan gagal antar wajib diisi.');
      return;
    }

    try {
      setFailedDeliveryModal((prev) => ({ ...prev, submitting: true }));
      const payload = {
        reason: failedDeliveryModal.reason.trim(),
        rescheduledAt: failedDeliveryModal.rescheduledAt
          ? new Date(failedDeliveryModal.rescheduledAt).toISOString()
          : null,
      };

      const res = await laundryCore3Api.markOrderDeliveryFailed(failedDeliveryModal.delivery.id, payload);
      if (res.status === 'success') {
        showToast(`Percobaan gagal antar #${failedDeliveryModal.delivery.invoiceNumber} berhasil dicatat.`);
        setModalError(null);
        setFailedDeliveryModal({
          isOpen: false,
          delivery: null,
          reason: '',
          rescheduledAt: '',
          submitting: false,
        });
        loadBoard();
      } else {
        setModalError(res.message || 'Gagal mencatat percobaan gagal antar');
      }
    } catch {
      setModalError('Terjadi kesalahan koneksi saat mencatat pengantaran gagal.');
    } finally {
      setFailedDeliveryModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Menunggu</span>;
      case 'CONFIRMED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Dikonfirmasi</span>;
      case 'DRIVER_ASSIGNED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">Kurir Ditugaskan</span>;
      case 'PICKED_UP':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Dijemput</span>;
      case 'FAILED_ATTEMPT':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Percobaan Gagal</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">Batal</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  // Filter tasks
  const filteredPickups = (boardData?.pickupTasks || []).filter((task) => {
    const matchesSearch =
      task.requestCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.pickupAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.courierName && task.courierName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredDeliveries = (boardData?.deliveryTasks || []).filter((task) => {
    const matchesSearch =
      task.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.customer?.name && task.customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.customer?.address && task.customer.address.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* TOAST NOTIFIKASI */}
      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 4 KPI METRICS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jemput Menunggu</p>
            <p className="text-xl sm:text-2xl font-black text-amber-900 leading-tight">
              {boardData?.summary?.totalPendingPickups || 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kurir Ditugaskan</p>
            <p className="text-xl sm:text-2xl font-black text-blue-900 leading-tight">
              {boardData?.summary?.totalAssignedPickups || 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Antar Aktif</p>
            <p className="text-xl sm:text-2xl font-black text-indigo-900 leading-tight">
              {boardData?.summary?.totalActiveDeliveries || 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gagal Jemput/Antar</p>
            <p className="text-xl sm:text-2xl font-black text-rose-800 leading-tight">
              {boardData?.summary?.totalFailedAttempts || 0}
            </p>
          </div>
        </div>
      </div>

      {/* FILTER & SUBTAB TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Subtab Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setSubTab('pickups')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                subTab === 'pickups'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Permintaan Jemput ({boardData?.pickupTasks?.length || 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('deliveries')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                subTab === 'deliveries'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Antar Pesanan ({boardData?.deliveryTasks?.length || 0})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode, nama, atau alamat..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900 bg-slate-50"
              />
            </div>

            {subTab === 'pickups' && (
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="PENDING">Menunggu</option>
                  <option value="DRIVER_ASSIGNED">Kurir Ditugaskan</option>
                  <option value="FAILED_ATTEMPT">Gagal Jemput</option>
                  <option value="PICKED_UP">Dijemput</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LIST KARTU TUGAS */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
          <span>Memuat tugas kurir...</span>
        </div>
      ) : subTab === 'pickups' ? (
        <div className="space-y-3">
          {filteredPickups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Tidak ada data permintaan penjemputan yang cocok.
            </div>
          ) : (
            filteredPickups.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-sm text-blue-900">#{task.requestCode}</span>
                    {renderStatusBadge(task.status)}
                    {task.serviceCategory && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {task.serviceCategory}
                      </span>
                    )}
                    {task.attemptCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                        Percobaan {task.attemptCount}x
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                    <span className="font-bold flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {task.customerName}
                    </span>
                    <a
                      href={`https://wa.me/${task.customerPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 hover:underline flex items-center gap-1 font-mono"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {task.customerPhone}
                    </a>
                    {task.estimatedWeightKg && (
                      <span className="text-slate-500">Estimasi: {task.estimatedWeightKg} Kg</span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{task.pickupAddress}</span>
                  </p>

                  {task.pickupNotes && (
                    <p className="text-xs text-slate-500 italic pl-5">
                      Catatan: "{task.pickupNotes}"
                    </p>
                  )}

                  {task.courierName && (
                    <div className="text-xs text-blue-950 font-medium bg-blue-50/70 border border-blue-100 rounded-lg px-2.5 py-1.5 flex items-center gap-2 mt-2">
                      <Truck className="w-3.5 h-3.5 text-blue-900" />
                      <span>
                        Kurir: <strong>{task.courierName}</strong>{' '}
                        {task.courierPhone ? `(${task.courierPhone})` : ''}
                        {task.routeOrder ? ` • Rute ke-${task.routeOrder}` : ''}
                      </span>
                    </div>
                  )}

                  {task.status === 'FAILED_ATTEMPT' && (
                    <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2.5 mt-2 space-y-0.5">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Percobaan Penjemputan Gagal</span>
                      </div>
                      <p>Alasan: {task.lastFailureReason || 'Penerima tidak berada di lokasi'}</p>
                      {task.rescheduledAt && (
                        <p className="font-semibold text-rose-950">
                          Jadwal Ulang: {new Date(task.rescheduledAt).toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Tombol Aksi */}
                <div className="flex sm:flex-col gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setModalError(null);
                      setAssignModal({
                        isOpen: true,
                        pickup: task,
                        courierName: task.courierName || '',
                        courierPhone: task.courierPhone || '',
                        routeOrder: task.routeOrder ? String(task.routeOrder) : '1',
                        status: task.status === 'PENDING' ? 'DRIVER_ASSIGNED' : ((task.status as any) || 'DRIVER_ASSIGNED'),
                        submitting: false,
                      });
                    }}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Tugaskan Kurir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalError(null);
                      setFailedPickupModal({
                        isOpen: true,
                        pickup: task,
                        reason: '',
                        rescheduledAt: '',
                        submitting: false,
                      });
                    }}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Gagal Jemput</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* LIST DELIVERY PESANAN */
        <div className="space-y-3">
          {filteredDeliveries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Tidak ada order yang sedang dalam antrean pengantaran.
            </div>
          ) : (
            filteredDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      #{delivery.invoiceNumber}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-900">
                      Antar: {delivery.laundryDetail?.deliveryStatus || 'PENDING'}
                    </span>
                    {(delivery.laundryDetail?.deliveryAttemptCount || 0) > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                        Gagal Antar {delivery.laundryDetail?.deliveryAttemptCount}x
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                    <span className="font-bold">{delivery.customer?.name || 'Pelanggan'}</span>
                    {delivery.customer?.phone && (
                      <span className="text-slate-500 font-mono">{delivery.customer.phone}</span>
                    )}
                    <span className="text-blue-900 font-semibold">
                      Rp {Number(delivery.totalAmount).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {delivery.customer?.address && (
                    <p className="text-xs text-slate-600 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{delivery.customer.address}</span>
                    </p>
                  )}

                  {delivery.laundryDetail?.deliveryStatus === 'FAILED_ATTEMPT' && (
                    <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2.5 mt-2 space-y-0.5">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Percobaan Pengantaran Terkendala</span>
                      </div>
                      <p>Alasan: {delivery.laundryDetail.deliveryLastFailureReason || 'Penerima tidak ada'}</p>
                      {delivery.laundryDetail.deliveryRescheduledAt && (
                        <p className="font-semibold text-rose-950">
                          Jadwal Ulang: {new Date(delivery.laundryDetail.deliveryRescheduledAt).toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setModalError(null);
                      setFailedDeliveryModal({
                        isOpen: true,
                        delivery,
                        reason: '',
                        rescheduledAt: '',
                        submitting: false,
                      });
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Gagal Antar</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TUGASKAN KURIR (ASSIGNMENT)                                      */}
      {/* ========================================================================= */}
      {assignModal.isOpen && assignModal.pickup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-xl flex flex-col flex-1 min-h-0 overflow-hidden animate-slideUp sm:animate-zoomIn">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Tugaskan Kurir Penjemputan</h3>
                <p className="text-xs text-slate-500 font-mono">Kode #{assignModal.pickup.requestCode}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setAssignModal({ ...assignModal, isOpen: false });
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssign} className="flex-1 flex flex-col min-h-0">
              <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Kurir / Supir *
                  </label>
                  <input
                    type="text"
                    value={assignModal.courierName}
                    onChange={(e) => setAssignModal({ ...assignModal, courierName: e.target.value })}
                    placeholder="Contoh: Dani Express"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nomor WhatsApp / HP Kurir
                  </label>
                  <input
                    type="tel"
                    value={assignModal.courierPhone}
                    onChange={(e) => setAssignModal({ ...assignModal, courierPhone: e.target.value })}
                    placeholder="Contoh: +628..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Urutan Rute
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={assignModal.routeOrder}
                      onChange={(e) => setAssignModal({ ...assignModal, routeOrder: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Status Tugas
                    </label>
                    <div className="relative">
                      <select
                        value={assignModal.status}
                        onChange={(e) => setAssignModal({ ...assignModal, status: e.target.value as any })}
                        className="w-full appearance-none pr-9 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white"
                      >
                        <option value="CONFIRMED">Dikonfirmasi</option>
                        <option value="DRIVER_ASSIGNED">Kurir Ditugaskan</option>
                        <option value="PICKED_UP">Sudah Dijemput</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Menyimpan penugasan akan otomatis memicu pesan notifikasi WhatsApp/In-App konfirmasi jemput kepada pelanggan.
                  </span>
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setAssignModal({ ...assignModal, isOpen: false });
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={assignModal.submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  {assignModal.submitting ? 'Menyimpan...' : 'Simpan Penugasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: GAGAL JEMPUT (FAILED PICKUP ATTEMPT)                            */}
      {/* ========================================================================= */}
      {failedPickupModal.isOpen && failedPickupModal.pickup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-xl flex flex-col flex-1 min-h-0 overflow-hidden animate-slideUp sm:animate-zoomIn">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-rose-800 text-sm sm:text-base">Catat Percobaan Gagal Jemput</h3>
                <p className="text-xs text-slate-500 font-mono">Kode #{failedPickupModal.pickup.requestCode}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setFailedPickupModal({ ...failedPickupModal, isOpen: false });
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFailedPickup} className="flex-1 flex flex-col min-h-0">
              <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Alasan Kegagalan Penjemputan *
                  </label>
                  <textarea
                    rows={3}
                    value={failedPickupModal.reason}
                    onChange={(e) => setFailedPickupModal({ ...failedPickupModal, reason: e.target.value })}
                    placeholder="Contoh: Pagar terkunci, telepon tidak diangkat setelah 3x dihubungi..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-800"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Jadwal Ulang Penjemputan (Opsional)
                  </label>
                  <input
                    type="datetime-local"
                    value={failedPickupModal.rescheduledAt}
                    onChange={(e) =>
                      setFailedPickupModal({ ...failedPickupModal, rescheduledAt: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-800 bg-white"
                  />
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Percobaan gagal akan bertambah 1x dan sistem otomatis mengirimkan notifikasi permohonan maaf serta jadwal ulang ke WhatsApp pelanggan.
                  </span>
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setFailedPickupModal({ ...failedPickupModal, isOpen: false });
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={failedPickupModal.submitting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  {failedPickupModal.submitting ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: GAGAL ANTAR (FAILED DELIVERY ATTEMPT)                            */}
      {/* ========================================================================= */}
      {failedDeliveryModal.isOpen && failedDeliveryModal.delivery && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-xl flex flex-col flex-1 min-h-0 overflow-hidden animate-slideUp sm:animate-zoomIn">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-rose-800 text-sm sm:text-base">Catat Percobaan Gagal Antar Pesanan</h3>
                <p className="text-xs text-slate-500 font-mono">Invoice #{failedDeliveryModal.delivery.invoiceNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setFailedDeliveryModal({ ...failedDeliveryModal, isOpen: false });
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFailedDelivery} className="flex-1 flex flex-col min-h-0">
              <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Alasan Gagal Antar *
                  </label>
                  <textarea
                    rows={3}
                    value={failedDeliveryModal.reason}
                    onChange={(e) =>
                      setFailedDeliveryModal({ ...failedDeliveryModal, reason: e.target.value })
                    }
                    placeholder="Contoh: Penerima sedang di luar kota, rumah kosong..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-800"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Jadwal Ulang Pengantaran (Opsional)
                  </label>
                  <input
                    type="datetime-local"
                    value={failedDeliveryModal.rescheduledAt}
                    onChange={(e) =>
                      setFailedDeliveryModal({ ...failedDeliveryModal, rescheduledAt: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-800 bg-white"
                  />
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setFailedDeliveryModal({ ...failedDeliveryModal, isOpen: false });
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={failedDeliveryModal.submitting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  {failedDeliveryModal.submitting ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverAssignmentBoardPanel;
