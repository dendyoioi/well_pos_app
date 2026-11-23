import React, { useRef } from 'react';
import { Image as ImageIcon, Upload, Trash2, Loader2 } from 'lucide-react';
import { compressImage } from '../../utils/imageCompressor';

export const PRESET_IMAGES = [
  { label: '☕ Kopi', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80' },
  { label: '🧋 Boba Tea', url: 'https://images.unsplash.com/photo-1558857563-b37cf0088195?w=400&auto=format&fit=crop&q=80' },
  { label: '🥤 Es Teh', url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop&q=80' },
  { label: '🍗 Ayam', url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&auto=format&fit=crop&q=80' },
  { label: '🍜 Mie/Bakso', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=80' },
  { label: '🍔 Burger', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80' },
  { label: '🍟 Kentang', url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&auto=format&fit=crop&q=80' },
  { label: '🍰 Pastry', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=80' },
];

interface ProductPhotoUploadTabProps {
  imageUrl: string;
  setImageUrl: (url: string) => void;
  isCompressingImage: boolean;
  setIsCompressingImage: (val: boolean) => void;
  onError: (msg: string | null) => void;
  isLaundryMode?: boolean;
}

export const ProductPhotoUploadTab: React.FC<ProductPhotoUploadTabProps> = ({
  imageUrl,
  setImageUrl,
  isCompressingImage,
  setIsCompressingImage,
  onError,
  isLaundryMode = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError('Format berkas harus berupa gambar (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      onError('Ukuran file foto maksimal 15MB');
      return;
    }

    setIsCompressingImage(true);
    onError(null);

    try {
      const result = await compressImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.75,
        mimeType: 'image/webp',
      });
      setImageUrl(result.dataUrl);
    } catch (err: any) {
      onError(err?.message || 'Gagal memproses gambar');
    } finally {
      setIsCompressingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-slate-50/70 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-blue-900" />
          <span>Foto Produk</span>
        </label>
        <span className="text-[11px] text-slate-400">Pilih template foto atau upload mandiri</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Preview Box */}
        <div className="relative w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner group">
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={() => setImageUrl('')}
              />
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-300" /> Hapus
              </button>
            </>
          ) : (
            <div className="text-center p-2 text-slate-400">
              <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
              <span className="text-[10px] leading-tight block">Belum ada foto</span>
            </div>
          )}
        </div>

        {/* Upload & Presets */}
        <div className="flex-1 space-y-3 w-full">
          <div className="flex gap-2">
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Tempel URL gambar (https://...)"
              className="flex-1 bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3 py-2 text-xs outline-none"
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              disabled={isCompressingImage}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap disabled:opacity-50 cursor-pointer"
            >
              {isCompressingImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-blue-900 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-blue-900" />
                  <span>Upload File</span>
                </>
              )}
            </button>
          </div>

          {/* Preset Chips (Khusus F&B — Disembunyikan pada Mode Laundry) */}
          {!isLaundryMode && (
            <div>
              <div className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                Foto Cepat (Klik untuk memilih):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_IMAGES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImageUrl(preset.url)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      imageUrl === preset.url
                        ? 'bg-blue-900 text-white border-blue-900 font-bold shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
