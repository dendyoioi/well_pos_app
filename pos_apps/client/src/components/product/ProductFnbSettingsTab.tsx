import React from 'react';
import { Sliders, Utensils } from 'lucide-react';
import type { ModifierGroup } from '../../types/modifier';

interface ProductFnbSettingsTabProps {
  productMode: 'STANDARD' | 'FNB' | 'COMPOSITE';
  setProductMode: (mode: 'STANDARD' | 'FNB' | 'COMPOSITE') => void;
  availableModifierGroups: ModifierGroup[];
  selectedModifierGroupIds: string[];
  toggleModifierGroup: (id: string) => void;
  loadingModifiers: boolean;
}

export const ProductFnbSettingsTab: React.FC<ProductFnbSettingsTabProps> = ({
  productMode,
  setProductMode,
  availableModifierGroups,
  selectedModifierGroupIds,
  toggleModifierGroup,
  loadingModifiers,
}) => {
  return (
    <div className="space-y-5 text-slate-800">
      {/* Pengaturan Made-to-Order Dapur F&B */}
      <div className="bg-blue-50/80 border border-blue-200/90 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-blue-950 block">
                Mode Menu Olahan Dapur F&B (Made-to-Order)
              </span>
              <span className="text-[11px] text-blue-800">
                Menu dibuat saat dipesan, stok fisik tidak dibatasi dan bahan baku dipotong via Resep BOM.
              </span>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={productMode === 'FNB'}
              onChange={(e) => setProductMode(e.target.checked ? 'FNB' : 'STANDARD')}
              className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 accent-blue-900 cursor-pointer"
            />
            <span className="text-xs font-bold text-blue-950">Aktifkan Resep F&B</span>
          </label>
        </div>

        {productMode === 'FNB' && (
          <div className="p-3 bg-white/90 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-center gap-2">
            <span className="text-base">🍳</span>
            <span>
              Produk ini diatur sebagai <strong>Menu Olahan Dapur F&B</strong>. Kasir dapat menjual bebas tanpa pembatasan kuantitas etalase. Bahan baku (biji kopi, susu, sirup, dll.) dipotong otomatis saat transaksi melalui menu <strong>Resep & Bahan (BOM)</strong>.
            </span>
          </div>
        )}
      </div>

      {/* Pilihan Kustomisasi Terpusat (Modifiers & Topping F&B) */}
      <div className="bg-slate-50/70 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5 uppercase tracking-wider">
              <Sliders className="w-4 h-4 text-blue-900" />
              <span>Kustomisasi Dinamis (Modifiers & Topping)</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Pilih grup varian & kustomisasi terpusat yang berlaku untuk menu ini (Level pedas, sugar, es, topping).
            </p>
          </div>
          <span className="text-[11px] font-semibold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 self-start sm:self-auto">
            {selectedModifierGroupIds.length} grup dipilih
          </span>
        </div>

        {loadingModifiers ? (
          <div className="text-center py-6 bg-white/60 rounded-xl border border-slate-200 text-xs text-slate-500">
            Memuat daftar modifier terpusat...
          </div>
        ) : availableModifierGroups.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-white/60 space-y-1">
            <Sliders className="w-7 h-7 text-slate-300 mx-auto mb-1" />
            <p className="text-xs font-semibold text-slate-600">
              Belum ada grup modifier di sistem
            </p>
            <p className="text-[11px] text-slate-400">
              Kelola master grup varian & topping terpusat melalui tab <strong>Modifiers</strong> di menu Katalog Produk.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {availableModifierGroups.map((group) => {
              const isChecked = selectedModifierGroupIds.includes(group.id);
              return (
                <div
                  key={group.id}
                  onClick={() => toggleModifierGroup(group.id)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="mt-1 w-4 h-4 rounded text-blue-900 focus:ring-blue-900 accent-blue-900 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {group.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          group.selectionType === 'SINGLE'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {group.selectionType === 'SINGLE' ? 'Pilih 1 (Radio)' : 'Boleh Multi (Checkbox)'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          group.isRequired
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {group.isRequired ? 'Wajib Pilih' : 'Opsional'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {group.items && group.items.length > 0 ? (
                        group.items.map((item, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md"
                          >
                            {item.name}
                            {item.priceAdjustment > 0
                              ? ` (+Rp ${item.priceAdjustment.toLocaleString('id-ID')})`
                              : ''}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Tidak ada opsi varian
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
