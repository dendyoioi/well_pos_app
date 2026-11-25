import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Tags,
  History,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { laundryCoreApi } from '../../services/api';
import type { OutletServicePricingItem } from '../../types/laundry_core';
import { ServicePriceHistoryModal } from './ServicePriceHistoryModal';

interface OutletServicePricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutletId: string;
  activeOutletName?: string;
  onSaved?: () => void;
}

export const OutletServicePricingModal: React.FC<OutletServicePricingModalProps> = ({
  isOpen,
  onClose,
  activeOutletId,
  activeOutletName,
  onSaved,
}) => {
  const [services, setServices] = useState<OutletServicePricingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Form states per service: { [serviceId]: { price: string, isAvailable: boolean, reason: string } }
  const [formState, setFormState] = useState<
    Record<string, { price: string; isAvailable: boolean; reason: string }>
  >({});

  // History modal state
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchOutletPricing = useCallback(async () => {
    if (!activeOutletId) return;
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await laundryCoreApi.getOutletServicesPricing(activeOutletId);
      if (res.status === 'success' && res.data?.services) {
        setServices(res.data.services);
        // Initialize form state
        const initialForm: Record<string, { price: string; isAvailable: boolean; reason: string }> =
          {};
        res.data.services.forEach((s) => {
          initialForm[s.id] = {
            price: s.priceOverride !== null ? String(s.priceOverride) : '',
            isAvailable: s.isAvailable,
            reason: '',
          };
        });
        setFormState(initialForm);
      }
    } catch (err) {
      console.error('Failed to load outlet services pricing:', err);
      setFeedbackMsg({ type: 'error', text: 'Gagal memuat daftar harga khusus cabang' });
    } finally {
      setLoading(false);
    }
  }, [activeOutletId]);

  useEffect(() => {
    if (isOpen) {
      fetchOutletPricing();
    }
  }, [isOpen, fetchOutletPricing]);

  const handleFieldChange = (
    serviceId: string,
    field: 'price' | 'isAvailable' | 'reason',
    value: any
  ) => {
    setFormState((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value,
      },
    }));
  };

  const handleSavePrice = async (service: OutletServicePricingItem) => {
    const current = formState[service.id];
    if (!current) return;

    setSavingServiceId(service.id);
    setFeedbackMsg(null);

    const priceOverrideNum =
      current.price.trim() === '' ? null : parseFloat(current.price.replace(/[^0-9.]/g, ''));

    try {
      const res = await laundryCoreApi.setOutletServicePrice(service.id, {
        outletId: activeOutletId,
        priceOverride: priceOverrideNum,
        isAvailable: current.isAvailable,
        reason: current.reason.trim() || undefined,
      });

      if (res.status === 'success') {
        setFeedbackMsg({
          type: 'success',
          text: `Tarif untuk "${service.name}" berhasil diperbarui`,
        });
        await fetchOutletPricing();
        if (onSaved) onSaved();
      } else {
        setFeedbackMsg({
          type: 'error',
          text: res.message || 'Gagal menyimpan tarif cabang',
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Terjadi kesalahan saat menyimpan',
      });
    } finally {
      setSavingServiceId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-4xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-slate-200">
          {/* Header */}
          <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-900">
                <Tags className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Tarif Khusus Cabang (Outlet Pricing)
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Atur harga layanan yang berbeda dari Master Pusat untuk{' '}
                  <strong className="text-slate-700">{activeOutletName || 'Cabang Aktif'}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback banner if any */}
          {feedbackMsg && (
            <div
              className={`p-3 px-6 text-xs flex items-center justify-between shrink-0 ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-b border-rose-200'
              }`}
            >
              <span className="flex items-center gap-2">
                {feedbackMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{feedbackMsg.text}</span>
              </span>
              <button
                onClick={() => setFeedbackMsg(null)}
                className="text-[11px] font-semibold underline ml-2"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Info bar */}
          <div className="p-3 px-6 bg-blue-50/70 border-b border-blue-100 flex items-center gap-2 text-xs text-blue-900 shrink-0">
            <HelpCircle className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              Kosongkan kolom <strong>Tarif Khusus Cabang</strong> jika ingin layanan mengikuti{' '}
              <strong>Harga Master Pusat</strong> secara otomatis.
            </span>
          </div>

          {/* Body: Table / List */}
          <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <span className="text-xs">Memuat katalog layanan & tarif cabang...</span>
              </div>
            ) : services.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
                <Tags className="w-12 h-12 stroke-[1.2] mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">Belum Ada Layanan Laundry</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Tambahkan layanan master terlebih dahulu melalui menu Layanan & Tarif.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((service) => {
                  const state = formState[service.id] || {
                    price: '',
                    isAvailable: true,
                    reason: '',
                  };
                  const isModified =
                    (state.price === '' && service.priceOverride !== null) ||
                    (state.price !== '' && parseFloat(state.price) !== service.priceOverride) ||
                    state.isAvailable !== service.isAvailable;
                  const isSaving = savingServiceId === service.id;

                  return (
                    <div
                      key={service.id}
                      className="p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all shadow-xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {/* Service Name & Category */}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{service.name}</h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                              {service.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Satuan: <strong className="text-slate-700">{service.unit}</strong> •
                            Estimasi: {service.durationHours} jam
                          </p>
                        </div>

                        {/* Availability toggle */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleFieldChange(service.id, 'isAvailable', !state.isAvailable)
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              state.isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {state.isAvailable ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-emerald-600" />
                                <span>Tersedia di Cabang</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-rose-500" />
                                <span>Nonaktif di Cabang</span>
                              </>
                            )}
                          </button>

                          {/* View Price History */}
                          <button
                            type="button"
                            onClick={() =>
                              setHistoryTarget({ id: service.id, name: service.name })
                            }
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Lihat Riwayat Perubahan Harga"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Pricing inputs row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                        {/* Base Price Display */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                          <span className="text-[11px] font-medium text-slate-500 block">
                            Harga Master Pusat
                          </span>
                          <span className="text-sm font-bold font-mono text-slate-700">
                            Rp {service.basePrice.toLocaleString('id-ID')}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            /{service.unit}
                          </span>
                        </div>

                        {/* Custom Price Override Input */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            Tarif Khusus Cabang (Rp)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                              Rp
                            </span>
                            <input
                              type="number"
                              min="0"
                              placeholder={`Ikuti Master (${service.basePrice.toLocaleString('id-ID')})`}
                              value={state.price}
                              onChange={(e) =>
                                handleFieldChange(service.id, 'price', e.target.value)
                              }
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 focus:outline-none font-mono"
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            {state.price.trim() !== '' ? (
                              <strong className="text-blue-900">
                                Tarif aktif: Rp{' '}
                                {parseFloat(state.price || '0').toLocaleString('id-ID')}
                              </strong>
                            ) : (
                              'Otomatis mengikuti harga master pusat'
                            )}
                          </span>
                        </div>

                        {/* Reason & Save Button */}
                        <div className="flex flex-col justify-between">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                              Alasan Penyesuaian (Opsional)
                            </label>
                            <input
                              type="text"
                              placeholder="Misal: Biaya sewa mall / Promo lokal"
                              value={state.reason}
                              onChange={(e) =>
                                handleFieldChange(service.id, 'reason', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 focus:outline-none"
                            />
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              onClick={() => handleSavePrice(service)}
                              disabled={isSaving}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors ${
                                isModified
                                  ? 'bg-blue-900 hover:bg-blue-800 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                              <span>Simpan Tarif</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Safe-Area Footer */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]">
            <span className="text-xs text-slate-500">
              Menampilkan {services.length} layanan terdaftar
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>

      {/* Audit History Modal */}
      {historyTarget && (
        <ServicePriceHistoryModal
          isOpen={true}
          onClose={() => setHistoryTarget(null)}
          serviceId={historyTarget.id}
          serviceName={historyTarget.name}
          activeOutletId={activeOutletId}
        />
      )}
    </>
  );
};
