/**
 * Utility untuk kompresi dan resizing gambar otomatis di sisi client (browser).
 * Menggunakan HTML5 Canvas untuk menghemat penyimpanan database & bandwidth hingga 95%.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 s.d 1.0 (default 0.8)
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
}

export interface CompressImageResult {
  dataUrl: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savingsPercent: number;
  width: number;
  height: number;
}

/**
 * Format bytes ke string yang mudah dibaca manusia (cth: "1.8 MB", "45 KB")
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Mengompres dan mengubah ukuran file gambar secara proporsional di peramban (browser).
 */
export async function compressImage(
  file: File | Blob,
  options: CompressImageOptions = {}
): Promise<CompressImageResult> {
  const {
    maxWidth = 600,
    maxHeight = 600,
    quality = 0.8,
    mimeType = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Berkas yang dipilih bukan format gambar yang valid.'));
    }

    const originalSizeBytes = file.size;
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Hitung aspect ratio scaling proporsional
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Gagal menginisialisasi canvas context'));
      }

      // Smooth rendering untuk ketajaman optimal
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Gambar ke canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Export ke format target (default webp, fallback ke jpeg jika tidak didukung)
      let compressedDataUrl = canvas.toDataURL(mimeType, quality);

      if (mimeType === 'image/webp' && !compressedDataUrl.startsWith('data:image/webp')) {
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      // Estimasi ukuran bytes dari base64 string
      const head = compressedDataUrl.indexOf(',') + 1;
      const base64Str = compressedDataUrl.substring(head);
      const compressedSizeBytes = Math.round((base64Str.length * 3) / 4);

      const savingsPercent = originalSizeBytes > 0
        ? Math.max(0, Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100))
        : 0;

      resolve({
        dataUrl: compressedDataUrl,
        originalSizeBytes,
        compressedSizeBytes,
        savingsPercent,
        width,
        height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal membaca berkas gambar.'));
    };

    img.src = objectUrl;
  });
}
