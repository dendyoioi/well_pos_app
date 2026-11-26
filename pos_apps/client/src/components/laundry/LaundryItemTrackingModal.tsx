import React, { useState, useEffect } from 'react';
import {
  X,
  Tag,
  Plus,
  Check,
  Printer,
  ChevronDown,
  Send,
  AlertCircle,
  PackageCheck,
  Shirt,
} from 'lucide-react';
import { laundryCore2Api } from '../../services/api';
import type {
  LaundryTrackedItem,
  GarmentCategory,
  TrackedItemStage,
} from '../../types/laundry_core2';

interface LaundryItemTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  invoiceNumber: string;
  customerName?: string;
  onUpdated?: () => void;
}

export const LaundryItemTrackingModal: React.FC<LaundryItemTrackingModalProps> = ({
  isOpen,
  onClose,
  orderId,
  invoiceNumber,
  customerName,
  onUpdated,
}) => {
  const [items, setItems] = useState<LaundryTrackedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Tambah Item
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [garmentName, setGarmentName] = useState<string>('');
  const [category, setCategory] = useState<GarmentCategory>('ATASAN');
  const [color, setColor] = useState<string>('');
  const [brand, setBrand] = useState<string>('');
  const [specialTreatment, setSpecialTreatment] = useState<string>('');
  const [addingItem, setAddingItem] = useState<boolean>(false);

  // State Partial Handover
  const [selectedItemIdsForHandover, setSelectedItemIdsForHandover] = useState<string[]>([]);
  const [receivedByName, setReceivedByName] = useState<string>(customerName || '');
  const [handoverNotes, setHandoverNotes] = useState<string>('');
  const [submittingHandover, setSubmittingHandover] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && orderId) {
      loadItems();
      setReceivedByName(customerName || '');
      setSelectedItemIdsForHandover([]);
    }
  }, [isOpen, orderId, customerName]);

  const loadItems = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await laundryCore2Api.getOrderItems(orderId);
      if (res.status === 'success' && res.data) {
        setItems(res.data.items || []);
      }
    } catch (err: any) {
      console.error('Failed to load tracked items:', err);
      setErrorMsg('Gagal memuat rincian pakaian');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!garmentName.trim()) {
      setErrorMsg('Nama pakaian wajib diisi');
      return;
    }

    try {
      setAddingItem(true);
      setErrorMsg(null);

      const res = await laundryCore2Api.createOrderItems(orderId, [
        {
          garmentName: garmentName.trim(),
          category,
          color: color.trim() || null,
          brand: brand.trim() || null,
          specialTreatment: specialTreatment.trim() || null,
        },
      ]);

      if (res.status === 'success') {
        setGarmentName('');
        setColor('');
        setBrand('');
        setSpecialTreatment('');
        setShowAddForm(false);
        setSuccessMsg('Item pakaian berhasil ditambahkan!');
        await loadItems();
        onUpdated?.();
        setTimeout(() => setSuccessMsg(null), 2000);
      } else {
        setErrorMsg(res.message || 'Gagal menambahkan item');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem saat menambah item');
    } finally {
      setAddingItem(false);
    }
  };

  const handleUpdateItemStage = async (itemId: string, newStage: TrackedItemStage) => {
    try {
      const res = await laundryCore2Api.updateItem(itemId, { currentStage: newStage });
      if (res.status === 'success') {
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, currentStage: newStage } : it))
        );
        onUpdated?.();
      }
    } catch (err: any) {
      alert(err?.message || 'Gagal mengubah tahap pakaian');
    }
  };

  const handleUpdateRackCode = async (itemId: string, rackCode: string) => {
    try {
      await laundryCore2Api.updateItem(itemId, { rackCode: rackCode.trim() || null });
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, rackCode: rackCode.trim() || null } : it))
      );
    } catch (err: any) {
      console.error('Failed to update rack code:', err);
    }
  };

  const handleToggleSelectForHandover = (itemId: string) => {
    setSelectedItemIdsForHandover((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handlePartialHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItemIdsForHandover.length === 0) {
      alert('Pilih minimal 1 pakaian untuk diserahkan');
      return;
    }
    if (!receivedByName.trim()) {
      alert('Nama penerima pakaian wajib diisi');
      return;
    }

    try {
      setSubmittingHandover(true);
      const res = await laundryCore2Api.partialHandover(orderId, {
        itemIds: selectedItemIdsForHandover,
        receivedByName: receivedByName.trim(),
        notes: handoverNotes.trim() || null,
      });

      if (res.status === 'success') {
        setSelectedItemIdsForHandover([]);
        setHandoverNotes('');
        setSuccessMsg(
          res.data.isFullyHandedOver
            ? 'Seluruh pakaian telah diserahkan! Nota pesanan tuntas diselesaikan.'
            : `Serah terima ${res.data.handedOverNow} item berhasil dicatat.`
        );
        await loadItems();
        onUpdated?.();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert(res.message || 'Gagal memproses serah terima sebagian');
      }
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan sistem saat serah terima pakaian');
    } finally {
      setSubmittingHandover(false);
    }
  };

  const handlePrintLabel = (item: LaundryTrackedItem) => {
    const printWindow = window.open('', '_blank', 'width=380,height=520');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Label Pakaian - ${item.tagCode}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 12px; margin: 0; }
            .tag { border: 2px dashed #000; padding: 12px; border-radius: 8px; text-align: center; }
            .code { font-family: monospace; font-size: 20px; font-weight: bold; margin: 8px 0; letter-spacing: 1px; }
            .item-name { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
            .meta { font-size: 11px; color: #444; margin-top: 6px; border-top: 1px solid #ccc; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="tag">
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Well POS Laundry</div>
            <div class="code">${item.tagCode}</div>
            <div class="item-name">${item.garmentName}</div>
            <div style="font-size: 11px;">${item.category || ''} ${item.color ? `• ${item.color}` : ''} ${item.brand ? `(${item.brand})` : ''}</div>
            ${item.specialTreatment ? `<div style="font-size: 10px; color: red; margin-top: 3px;">⚠️ ${item.specialTreatment}</div>` : ''}
            <div class="meta">
              <div>Nota: <strong>#${invoiceNumber}</strong></div>
              <div>Pelanggan: <strong>${customerName || '-'}</strong></div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Ringkasan item
  const totalItems = items.length;
  const handedOverCount = items.filter((i) => i.currentStage === 'HANDED_OVER').length;
  const readyCount = items.filter((i) => i.currentStage === 'READY').length;
  const inProgressCount = totalItems - handedOverCount - readyCount;
  const unhandedItems = items.filter((i) => i.currentStage !== 'HANDED_OVER');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Pelacakan Pakaian (Item-Level Tracking)
                </h2>
                <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded">
                  #{invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Pelanggan: <strong>{customerName || '-'}</strong> • Tag QR satuan &amp; serah terima bertahap
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-200 bg-white px-5 py-2.5 shrink-0 text-center text-xs">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block">TOTAL PAKAIAN</span>
            <span className="text-sm font-extrabold text-slate-900">{totalItems}</span>
          </div>
          <div>
            <span className="text-[10px] text-sky-600 font-bold block">DIPROSES</span>
            <span className="text-sm font-extrabold text-sky-700">{inProgressCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-emerald-600 font-bold block">SIAP DI RAK</span>
            <span className="text-sm font-extrabold text-emerald-700">{readyCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold block">TELAH DISERAHKAN</span>
            <span className="text-sm font-extrabold text-slate-700">
              {handedOverCount} / {totalItems}
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Tambah Item Pakaian */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shirt className="w-4 h-4 text-blue-900" />
                <h3 className="text-xs font-bold text-slate-900">
                  {showAddForm ? 'Formulir Registrasi Pakaian Satuan' : 'Registrasi Pakaian Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm((prev) => !prev)}
                className="px-3 py-1 bg-blue-900 text-white rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors flex items-center gap-1 shadow-xs"
              >
                {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{showAddForm ? 'Tutup Form' : '+ Tambah Pakaian'}</span>
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleAddItem} className="mt-3.5 pt-3.5 border-t border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nama Pakaian / Model <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={garmentName}
                      onChange={(e) => setGarmentName(e.target.value)}
                      placeholder="Contoh: Kemeja Lengan Panjang, Jas Hitam..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Kategori Pakaian
                    </label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                      >
                        <option value="ATASAN">Atasan (Kemeja, Kaos, Blus, Jas)</option>
                        <option value="BAWAHAN">Bawahan (Celana, Rok, Jeans)</option>
                        <option value="JAS_GAUN">Jas &amp; Gaun Pengantin / Pesta</option>
                        <option value="BEDDING">Bedding (Sprei, Bedcover, Selimut)</option>
                        <option value="SEPATU_TAS">Sepatu &amp; Tas</option>
                        <option value="LAINNYA">Lainnya / Aksesoris</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Warna
                    </label>
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="Misal: Putih, Biru Navy"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Merek / Brand
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Misal: Uniqlo, Zara"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Perlakuan Khusus / Catatan
                    </label>
                    <input
                      type="text"
                      value={specialTreatment}
                      onChange={(e) => setSpecialTreatment(e.target.value)}
                      placeholder="Misal: Jangan disikat, Kancing longgar"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={addingItem || !garmentName.trim()}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Simpan &amp; Buat Tag QR</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Daftar Item Pakaian */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-900">
                Daftar Pakaian Terdaftar ({items.length})
              </h3>
              <span className="text-[11px] text-slate-400">
                Setiap item memiliki kode tag unik untuk pelacakan kanban &amp; rak
              </span>
            </div>

            {loading ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Memuat pakaian terdaftar...
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">Belum Ada Item Pakaian Terdaftar</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Daftarkan pakaian untuk mencetak label QR/Barcode dan mengaktifkan serah terima sebagian.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => {
                  const isHandedOver = item.currentStage === 'HANDED_OVER';

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isHandedOver
                          ? 'bg-slate-50 border-slate-200 opacity-80'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                        <div className="flex items-start gap-2.5">
                          {/* Checkbox for partial handover */}
                          {!isHandedOver && (
                            <input
                              type="checkbox"
                              checked={selectedItemIdsForHandover.includes(item.id)}
                              onChange={() => handleToggleSelectForHandover(item.id)}
                              className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300 mt-1"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-extrabold text-blue-900 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md">
                                {item.tagCode}
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                {item.garmentName}
                              </span>
                              {item.category && (
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                                  {item.category}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-500 mt-1">
                              {item.color && `Warna: ${item.color} • `}
                              {item.brand && `Merek: ${item.brand} • `}
                              {item.specialTreatment && (
                                <span className="text-amber-700 font-semibold">
                                  ⚠️ {item.specialTreatment}
                                </span>
                              )}
                            </p>

                            {isHandedOver && (
                              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                                Diserahkan kepada "{item.receivedByName || 'Pelanggan'}" oleh{' '}
                                {item.handedOverByName || 'Kasir'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Controls (Stage & Rack & Print) */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Rack Code input */}
                          <input
                            type="text"
                            placeholder="Kode Rak"
                            defaultValue={item.rackCode || ''}
                            onBlur={(e) => handleUpdateRackCode(item.id, e.target.value)}
                            disabled={isHandedOver}
                            className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 uppercase focus:outline-none focus:ring-1 focus:ring-blue-900 bg-white"
                          />

                          {/* Stage Selector */}
                          <div className="relative">
                            <select
                              value={item.currentStage}
                              onChange={(e) =>
                                handleUpdateItemStage(item.id, e.target.value as TrackedItemStage)
                              }
                              disabled={isHandedOver}
                              className={`text-xs font-bold rounded-lg px-2.5 py-1 appearance-none pr-7 border transition-colors ${
                                item.currentStage === 'HANDED_OVER'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : item.currentStage === 'READY'
                                  ? 'bg-sky-100 text-sky-800 border-sky-300'
                                  : 'bg-slate-100 text-slate-800 border-slate-200'
                              }`}
                            >
                              <option value="TAGGED">TAGGED</option>
                              <option value="WASHING">WASHING</option>
                              <option value="DRYING">DRYING</option>
                              <option value="IRONING">IRONING</option>
                              <option value="PACKED">PACKED</option>
                              <option value="READY">READY (RAK)</option>
                              <option value="HANDED_OVER" disabled>
                                HANDED_OVER
                              </option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                          </div>

                          {/* Print Tag button */}
                          <button
                            type="button"
                            onClick={() => handlePrintLabel(item)}
                            title="Cetak Label Tag"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bagian Partial Handover */}
          {unhandedItems.length > 0 && items.length > 0 && (
            <div className="border border-blue-200 rounded-2xl bg-blue-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-blue-900" />
                <h4 className="text-xs font-bold text-blue-950">
                  Serah Terima Sebagian (Partial Handover)
                </h4>
              </div>
              <p className="text-[11px] text-slate-600">
                Pilih pakaian yang ingin diserahkan terlebih dahulu kepada pelanggan. Jika seluruh
                pakaian tuntas diserahkan, pesanan otomatis berstatus <strong>SELESAI</strong>.
              </p>

              <form onSubmit={handlePartialHandover} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nama Penerima Pakaian <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={receivedByName}
                      onChange={(e) => setReceivedByName(e.target.value)}
                      placeholder="Nama orang yang mengambil pakaian..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Catatan Serah Terima (Opsional)
                    </label>
                    <input
                      type="text"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      placeholder="Misal: Ambil kemeja dulu untuk kantor besok..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-blue-900">
                    {selectedItemIdsForHandover.length} pakaian dipilih
                  </span>
                  <button
                    type="submit"
                    disabled={submittingHandover || selectedItemIdsForHandover.length === 0}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-700/20 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Serahkan Item Terpilih</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-xs text-slate-500 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span>Item-Level Garment Traceability</span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-slate-700 hover:text-slate-900 underline"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
