import React from 'react';
import { Plus, Package, Layers, Utensils } from 'lucide-react';
import type { Product } from '../../types/product';

export interface ProductCatalogGridProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  viewMode: 'grid' | 'compact';
  loading: boolean;
}

export const ProductCatalogGrid: React.FC<ProductCatalogGridProps> = ({
  products,
  onSelectProduct,
  viewMode,
  loading,
}) => {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-500">Memuat katalog menu &amp; stok...</span>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-200">
        <div className="max-w-xs space-y-2">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">Tidak ada produk ditemukan</h4>
          <p className="text-xs text-slate-400">
            Periksa kembali kata kunci pencarian atau kategori yang dipilih.
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
          {products.map((product) => {
            const price = product.price || product.basePrice || 0;
            const hasModifiers = (product.modifiers?.length || 0) > 0;
            const isComposite = product.productType === 'COMPOSITE' || product.hasStock === false;
            const stock = product.stock ?? 0;
            const isUnlimited = isComposite || stock >= 99999;
            const isOutOfStock = !isUnlimited && stock <= 0;

            return (
              <div
                key={product.id}
                onClick={() => !isOutOfStock && onSelectProduct(product)}
                className={`p-3 sm:p-3.5 flex items-center justify-between gap-4 transition-colors cursor-pointer select-none ${
                  isOutOfStock
                    ? 'opacity-50 bg-slate-50 cursor-not-allowed'
                    : 'hover:bg-blue-50/40 active:bg-blue-100/50'
                }`}
              >
                <div className="min-w-0 flex items-center gap-3">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200/90 shadow-2xs"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-500 font-bold text-xs border border-slate-200/80">
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {product.name}
                      </h4>
                      {hasModifiers && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 shadow-2xs">
                          <Layers className="w-2.5 h-2.5" />
                          Modifier
                        </span>
                      )}
                      {product.category?.name && (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {product.category.name}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      SKU: {product.sku || product.barcode || '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap flex items-baseline justify-end">
                      <span className="text-[11px] font-bold text-slate-500 mr-0.5 select-none">Rp</span>
                      <span className="tabular-nums">{price.toLocaleString('id-ID')}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {isUnlimited ? (isComposite ? 'Tersedia (Olahan F&B)' : 'Tersedia') : `Stok: ${stock}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isOutOfStock}
                    className="w-8 h-8 rounded-xl bg-blue-900 hover:bg-blue-800 text-white flex items-center justify-center shadow-xs active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Grid View (Default) - Proportional Grid Layout
  return (
    <div className="flex-1 overflow-y-auto pr-1">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3.5">
        {products.map((product) => {
          const price = product.price || product.basePrice || 0;
          const hasModifiers = (product.modifiers?.length || 0) > 0;
          const isComposite = product.productType === 'COMPOSITE' || product.hasStock === false;
          const stock = product.stock ?? 0;
          const isUnlimited = isComposite || stock >= 99999;
          const isOutOfStock = !isUnlimited && stock <= 0;

          // Pendekkan nama kategori supaya tidak terpotong canggung di tengah kata
          const categoryName = product.category?.name || '';
          const shortCategory = categoryName.length > 18 ? categoryName.slice(0, 16).trimEnd() + '…' : categoryName;

          return (
            <div
              key={product.id}
              onClick={() => !isOutOfStock && onSelectProduct(product)}
              className={`bg-white rounded-2xl border border-slate-200/90 hover:border-blue-900/40 hover:shadow-md p-2.5 sm:p-3 flex flex-col gap-2 transition-all duration-150 cursor-pointer select-none group relative overflow-hidden ${
                isOutOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'active:scale-[0.98]'
              }`}
            >
              {/* Product Visual / Image */}
              <div className="w-full h-28 sm:h-32 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden relative border border-slate-200/70 shrink-0">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="text-slate-400 group-hover:scale-110 transition-transform">
                    {hasModifiers ? (
                      <Utensils className="w-7 h-7 stroke-[1.5]" />
                    ) : (
                      <Package className="w-7 h-7 stroke-[1.5]" />
                    )}
                  </div>
                )}

                {/* Badge Modifier */}
                {hasModifiers && (
                  <div className="absolute top-1.5 right-1.5 pointer-events-none">
                    <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-xs">
                      <Layers className="w-2.5 h-2.5 text-violet-300" />
                      Mod
                    </span>
                  </div>
                )}

                {isOutOfStock && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center">
                    <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Habis
                    </span>
                  </div>
                )}
              </div>

              {/* Label Kategori — di atas nama produk */}
              <div className="flex-1 flex flex-col justify-start gap-0.5">
                {categoryName && (
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-blue-800/60 truncate leading-none">
                    {shortCategory}
                  </p>
                )}
                <h4 className="text-[11px] sm:text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-900 transition-colors" style={{ minHeight: '2rem' }}>
                  {product.name}
                </h4>
              </div>

              {/* Harga & Tombol Tambah */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 mt-auto">
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="text-xs sm:text-[13px] font-black text-slate-900 tracking-tight leading-none whitespace-nowrap flex items-baseline">
                    <span className="text-[10px] font-bold text-slate-500 mr-0.5 select-none">
                      Rp
                    </span>
                    <span className="tabular-nums truncate">
                      {price.toLocaleString('id-ID')}
                    </span>
                  </p>
                  {isUnlimited ? (
                    <span className="inline-flex items-center gap-1 text-[9px] text-emerald-700 font-semibold mt-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      Siap Saji
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] text-slate-500 font-medium mt-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                      Stok: {stock}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isOutOfStock}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 group-hover:bg-blue-900 text-blue-900 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs"
                  aria-label={`Pilih ${product.name}`}
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
