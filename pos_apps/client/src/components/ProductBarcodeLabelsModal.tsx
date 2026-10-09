import React, { useState, useMemo } from 'react';
import {
  Printer,
  X,
  Settings2,
  Eye,
  CheckSquare,
  Square,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { Product } from '../types/product';
import { BarcodeRenderer } from './BarcodeRenderer';

export type LabelTemplateType = '40x30' | '30x20' | '50x30' | '60x40' | 'a4_grid';

interface LabelConfig {
  template: LabelTemplateType;
  showStoreName: boolean;
  storeName: string;
  showPrice: boolean;
  showProductName: boolean;
  showBarcodeText: boolean;
  fontSize: 'compact' | 'normal' | 'large';
}

export interface ProductBarcodeLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  storeName?: string;
}

export const ProductBarcodeLabelsModal: React.FC<ProductBarcodeLabelsModalProps> = ({
  isOpen,
  onClose,
  products,
  storeName = 'Well POS Store',
}) => {
  // Mapping quantity cetak per produk ID
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      initial[p.id] = 1;
    });
    return initial;
  });

  // State produk yang dipilih untuk dicetak
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() =>
    products.map((p) => p.id)
  );

  // Template & Display Config
  const [config, setConfig] = useState<LabelConfig>({
    template: '40x30',
    showStoreName: true,
    storeName,
    showPrice: true,
    showProductName: true,
    showBarcodeText: true,
    fontSize: 'normal',
  });

  const [massQuantity, setMassQuantity] = useState<number>(1);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Update quantities jika list produk berubah
  React.useEffect(() => {
    setQuantities((prev) => {
      const next = { ...prev };
      products.forEach((p) => {
        if (!next[p.id]) next[p.id] = 1;
      });
      return next;
    });
    setSelectedProductIds(products.map((p) => p.id));
  }, [products]);

  // Handle select/unselect all
  const isAllSelected = selectedProductIds.length === products.length && products.length > 0;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map((p) => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyMassQuantity = () => {
    const qty = Math.max(1, massQuantity);
    setQuantities((prev) => {
      const next = { ...prev };
      selectedProductIds.forEach((id) => {
        next[id] = qty;
      });
      return next;
    });
  };

  // Kalkulasi total label yang akan dicetak
  const totalLabels = useMemo(() => {
    return selectedProductIds.reduce((sum, id) => sum + (quantities[id] || 1), 0);
  }, [selectedProductIds, quantities]);

  // Flat list semua label yang akan dicetak (mengulang sesuai quantity)
  const printableItems = useMemo(() => {
    const items: Array<{ product: Product; index: number }> = [];
    products.forEach((p) => {
      if (selectedProductIds.includes(p.id)) {
        const qty = quantities[p.id] || 1;
        for (let i = 0; i < qty; i++) {
          items.push({ product: p, index: i });
        }
      }
    });
    return items;
  }, [products, selectedProductIds, quantities]);

  // Eksekusi Print via Hidden Iframe (Murni tanpa gangguan UI)
  const handlePrint = () => {
    if (printableItems.length === 0) return;
    setIsPrinting(true);

    try {
      // Ambil elemen print content
      const printContainer = document.getElementById('barcode-printable-area');
      if (!printContainer) return;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) return;

      // Styling spesifik ukuran cetak
      let pageStyle = '';
      if (config.template === '40x30') {
        pageStyle = `
          @page { size: 40mm 30mm; margin: 0; }
          .label-item { width: 40mm; height: 30mm; page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 1.5mm; box-sizing: border-box; text-align: center; }
        `;
      } else if (config.template === '30x20') {
        pageStyle = `
          @page { size: 30mm 20mm; margin: 0; }
          .label-item { width: 30mm; height: 20mm; page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 1mm; box-sizing: border-box; text-align: center; }
        `;
      } else if (config.template === '50x30') {
        pageStyle = `
          @page { size: 50mm 30mm; margin: 0; }
          .label-item { width: 50mm; height: 30mm; page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 1.5mm; box-sizing: border-box; text-align: center; }
        `;
      } else if (config.template === '60x40') {
        pageStyle = `
          @page { size: 60mm 40mm; margin: 0; }
          .label-item { width: 60mm; height: 40mm; page-break-after: always; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 2mm; box-sizing: border-box; text-align: center; }
        `;
      } else {
        // A4 Grid (3x8 = 24 labels)
        pageStyle = `
          @page { size: A4 portrait; margin: 8mm; }
          .a4-grid-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; width: 100%; box-sizing: border-box; }
          .label-item { border: 1px dashed #ccc; height: 33mm; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 1.5mm; box-sizing: border-box; text-align: center; break-inside: avoid; }
        `;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cetak Label Barcode - ${config.storeName}</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #000; }
              body { background: #fff; margin: 0; padding: 0; }
              ${pageStyle}
              .store-name { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1px; }
              .product-name { font-size: 9px; font-weight: 700; line-height: 1.1; max-height: 2.2em; overflow: hidden; margin-bottom: 2px; }
              .price-tag { font-size: 11px; font-weight: 900; margin-top: 1px; }
              .shelf-price { font-size: 14px; font-weight: 900; margin-top: 2px; }
              svg { max-width: 95%; height: auto; display: block; margin: 0 auto; }
            </style>
          </head>
          <body>
            ${
              config.template === 'a4_grid'
                ? `<div class="a4-grid-container">${printContainer.innerHTML}</div>`
                : printContainer.innerHTML
            }
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          setIsPrinting(false);
        }, 1500);
      }, 500);
    } catch (err) {
      console.error('Gagal memproses print iframe:', err);
      setIsPrinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-fadeIn select-none">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92dvh] sm:max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-800/80 border border-blue-700/60 flex items-center justify-center text-white shadow-xs shrink-0">
              <Printer className="w-5 h-5 text-blue-200 shrink-0" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                <span className="truncate">Cetak Label Barcode &amp; Stiker Rak</span>
                <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                  EPIC-26
                </span>
              </h2>
              <p className="text-xs text-blue-200 mt-0.5 truncate">
                Format label thermal &amp; kertas A4 siap cetak dengan barcode standar Code 128 / EAN
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (2 Kolom: Kiri Pengaturan & Checklist, Kanan Preview Live) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Kolom Kiri: Pengaturan & Daftar Produk */}
          <div className="w-full md:w-1/2 flex flex-col p-5 overflow-y-auto overscroll-contain bg-slate-50/50 space-y-5">
            {/* 1. Pengaturan Template Label */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-blue-950 uppercase tracking-wider">
                <Settings2 className="w-4 h-4 text-blue-900" />
                <span>Format Kertas / Printer</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: '40x30', label: 'Thermal 40x30 mm', sub: 'Standar Produk' },
                  { id: '30x20', label: 'Thermal 30x20 mm', sub: 'Kecil / Perhiasan' },
                  { id: '50x30', label: 'Thermal 50x30 mm', sub: 'Minimarket' },
                  { id: '60x40', label: 'Stiker Rak 60x40 mm', sub: 'Shelf Talker' },
                  { id: 'a4_grid', label: 'Kertas A4 Grid', sub: '3x8 = 24 Label/lbr' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, template: item.id as LabelTemplateType }))}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      config.template === item.id
                        ? 'border-blue-900 bg-blue-50/70 text-blue-950 ring-2 ring-blue-900/10 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-extrabold text-xs">{item.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.sub}</div>
                  </button>
                ))}
              </div>

              {/* Toggle Opsi Tampilan */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.showStoreName}
                    onChange={(e) => setConfig((prev) => ({ ...prev, showStoreName: e.target.checked }))}
                    className="rounded text-blue-900 focus:ring-blue-900"
                  />
                  <span>Nama Toko</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.showProductName}
                    onChange={(e) => setConfig((prev) => ({ ...prev, showProductName: e.target.checked }))}
                    className="rounded text-blue-900 focus:ring-blue-900"
                  />
                  <span>Nama Produk</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.showPrice}
                    onChange={(e) => setConfig((prev) => ({ ...prev, showPrice: e.target.checked }))}
                    className="rounded text-blue-900 focus:ring-blue-900"
                  />
                  <span>Harga Jual</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.showBarcodeText}
                    onChange={(e) => setConfig((prev) => ({ ...prev, showBarcodeText: e.target.checked }))}
                    className="rounded text-blue-900 focus:ring-blue-900"
                  />
                  <span>Teks Barcode</span>
                </label>
              </div>
            </div>

            {/* 2. Daftar Pilihan Produk & Copies */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex-1 flex flex-col space-y-3 min-h-[220px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-slate-600 hover:text-blue-900 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-900" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>Pilih Semua ({products.length})</span>
                  </button>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-extrabold text-blue-900">
                    {selectedProductIds.length} Terpilih
                  </span>
                </div>

                {/* Set Massal Salinan */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-semibold">Salin massal:</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={massQuantity}
                    onChange={(e) => setMassQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 bg-slate-50 border border-slate-300 rounded-lg text-center text-xs font-bold py-1 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyMassQuantity}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                    title="Terapkan jumlah ke semua produk terpilih"
                  >
                    Terapkan
                  </button>
                </div>
              </div>

              {/* List Produk */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-60 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                {products.map((p) => {
                  const isChecked = selectedProductIds.includes(p.id);
                  const barcodeValue = p.barcode || p.sku;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-2 p-2 rounded-xl transition-all ${
                        isChecked
                          ? 'bg-white border border-blue-200 shadow-2xs'
                          : 'bg-white/60 border border-transparent opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleSelectProduct(p.id)}
                          className="cursor-pointer text-blue-900"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 truncate">{p.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            <span>Kode: {barcodeValue || 'N/A'}</span>
                            <span>•</span>
                            <span className="text-blue-900 font-bold">
                              Rp {(p.price ?? p.basePrice ?? 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400 font-semibold">Qty:</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          disabled={!isChecked}
                          value={quantities[p.id] || 1}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setQuantities((prev) => ({ ...prev, [p.id]: val }));
                          }}
                          className="w-12 bg-slate-50 border border-slate-300 rounded-lg text-center text-xs font-bold py-0.5 outline-none disabled:opacity-40"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Live Preview Visual Label */}
          <div className="w-full md:w-1/2 flex flex-col p-5 bg-slate-100 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                <Eye className="w-4 h-4 text-blue-900" />
                <span>Pratinjau Label ({totalLabels} Lembar)</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                Mode: {config.template.toUpperCase()}
              </span>
            </div>

            {/* Container Preview Kartu Stiker */}
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-inner overflow-y-auto flex flex-col items-center justify-start min-h-[300px]">
              {printableItems.length === 0 ? (
                <div className="m-auto text-center py-10 space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 font-bold">
                    Pilih minimal 1 produk di panel kiri untuk menampilkan pratinjau.
                  </p>
                </div>
              ) : (
                <div className="w-full flex flex-wrap gap-4 justify-center py-2">
                  {/* Contoh Preview 2-3 Label Pertama */}
                  {printableItems.slice(0, 4).map(({ product, index }) => {
                    const code = product.barcode || product.sku;
                    return (
                      <div
                        key={`${product.id}-${index}`}
                        className={`bg-white border-2 border-slate-900 rounded-lg p-2.5 shadow-md flex flex-col items-center justify-between transition-transform hover:scale-105 ${
                          config.template === '40x30'
                            ? 'w-48 h-36'
                            : config.template === '30x20'
                            ? 'w-40 h-28'
                            : config.template === '50x30'
                            ? 'w-56 h-36'
                            : config.template === '60x40'
                            ? 'w-64 h-44 border-slate-900 bg-amber-50/20'
                            : 'w-48 h-36 border-dashed border-slate-400'
                        }`}
                      >
                        {config.showStoreName && (
                          <div className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest text-center truncate w-full">
                            {config.storeName}
                          </div>
                        )}

                        {config.showProductName && (
                          <div className="text-xs font-black text-slate-900 text-center line-clamp-2 leading-tight w-full mt-0.5">
                            {product.name}
                          </div>
                        )}

                        {/* Barcode SVG */}
                        <div className="my-auto w-full py-1">
                          <BarcodeRenderer
                            value={code || '1234567890'}
                            width={config.template === '30x20' ? 1.2 : 1.5}
                            height={config.template === '30x20' ? 24 : 34}
                            displayValue={config.showBarcodeText}
                            fontSize={config.template === '30x20' ? 9 : 10}
                          />
                        </div>

                        {/* Harga */}
                        {config.showPrice && (
                          <div
                            className={`font-black text-slate-950 text-center w-full mt-0.5 ${
                              config.template === '60x40' ? 'text-base text-blue-950' : 'text-xs'
                            }`}
                          >
                            Rp {(product.price ?? product.basePrice ?? 0).toLocaleString('id-ID')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {printableItems.length > 4 && (
                <div className="text-[11px] text-slate-400 font-bold mt-2 text-center">
                  ... dan {printableItems.length - 4} label lainnya siap dicetak.
                </div>
              )}
            </div>

            <div className="mt-3 bg-blue-50/80 border border-blue-200/80 rounded-xl p-2.5 flex items-center gap-2 text-blue-900 text-[11px]">
              <Sparkles className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                <strong>Tips Printer:</strong> Pada jendela cetak browser, atur <em>Margin: None</em> dan pastikan ukuran kertas diatur sesuai ukuran stiker ({config.template.toUpperCase()}).
              </span>
            </div>
          </div>
        </div>

        {/* Footer Modal: Ringkasan & Tombol Cetak */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="text-xs font-bold text-slate-600">
            Total Target Cetak:{' '}
            <strong className="text-blue-950 text-sm font-extrabold">{totalLabels}</strong> Lembar Label
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isPrinting || printableItems.length === 0}
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Menyiapkan Cetak...' : `Cetak ${totalLabels} Label`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Area Tersembunyi untuk Konten Cetak Iframe */}
      <div id="barcode-printable-area" style={{ display: 'none' }}>
        {printableItems.map(({ product, index }) => {
          const code = product.barcode || product.sku;
          return (
            <div key={`print-${product.id}-${index}`} className="label-item">
              {config.showStoreName && <div className="store-name">{config.storeName}</div>}
              {config.showProductName && <div className="product-name">{product.name}</div>}
              <BarcodeRenderer
                value={code || '1234567890'}
                width={config.template === '30x20' ? 1.2 : 1.5}
                height={config.template === '30x20' ? 24 : 34}
                displayValue={config.showBarcodeText}
                fontSize={config.template === '30x20' ? 9 : 10}
              />
              {config.showPrice && (
                <div className={config.template === '60x40' ? 'shelf-price' : 'price-tag'}>
                  Rp {(product.price ?? product.basePrice ?? 0).toLocaleString('id-ID')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
