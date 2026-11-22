import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { storageService } from '../services/storage.service';

export const mediaRouter = Router();

// Proteksi seluruh route media dengan middleware autentikasi JWT
mediaRouter.use(authenticate);

const ALLOWED_MODULES = ['products', 'outlets', 'laundry', 'laundry-delivery', 'payments'];

/**
 * @route POST /api/media/upload
 * @desc Upload media berbasis Base64 Data URL secara universal (maks 2MB)
 */
mediaRouter.post('/upload', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        status: 'error',
        message: 'Konteks tenant tidak ditemukan pada sesi autentikasi',
      });
    }

    const { image, module } = req.body || {};

    if (!module || typeof module !== 'string' || !ALLOWED_MODULES.includes(module)) {
      return res.status(400).json({
        status: 'error',
        message: `Modul '${module}' tidak valid. Modul yang diizinkan: ${ALLOWED_MODULES.join(', ')}`,
      });
    }

    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Data gambar (Base64 Data URL) wajib disertakan',
      });
    }

    // Ekstrak MIME & Base64
    const matches = image.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({
        status: 'error',
        message: 'Format Data URL gambar tidak valid',
      });
    }

    const rawSubtype = matches[1].toLowerCase();
    if (rawSubtype === 'svg+xml' || rawSubtype === 'svg') {
      return res.status(400).json({
        status: 'error',
        message: 'Format SVG tidak diizinkan untuk upload gambar demi alasan keamanan',
      });
    }

    const ALLOWED_MIME_EXTS: Record<string, { ext: string; contentType: string }> = {
      jpeg: { ext: 'jpg', contentType: 'image/jpeg' },
      jpg: { ext: 'jpg', contentType: 'image/jpeg' },
      png: { ext: 'png', contentType: 'image/png' },
      webp: { ext: 'webp', contentType: 'image/webp' },
    };

    const mimeConfig = ALLOWED_MIME_EXTS[rawSubtype];
    if (!mimeConfig) {
      return res.status(400).json({
        status: 'error',
        message: `Format gambar '${rawSubtype}' tidak didukung. Hanya JPEG, PNG, dan WebP yang diizinkan`,
      });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
    if (buffer.length > MAX_BYTES) {
      return res.status(400).json({
        status: 'error',
        message: 'Ukuran file gambar melebihi batas maksimum 2 MB',
      });
    }

    const uploadResult = await storageService.uploadBuffer({
      buffer,
      contentType: mimeConfig.contentType,
      ext: mimeConfig.ext,
      tenantId,
      module,
    });

    return res.status(200).json({
      status: 'success',
      message: 'File media berhasil diunggah',
      data: {
        url: uploadResult.url,
        key: uploadResult.key,
        provider: uploadResult.provider,
      },
    });
  } catch (error: any) {
    console.error('[MediaRouter] Error upload media:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Gagal mengunggah file media',
    });
  }
});

/**
 * @route POST /api/media/presign
 * @desc Membuat presigned upload URL untuk upload langsung dari browser ke Cloudflare R2 (foto & video)
 */
mediaRouter.post('/presign', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        status: 'error',
        message: 'Konteks tenant tidak ditemukan pada sesi autentikasi',
      });
    }

    const { module, contentType, ext } = req.body || {};

    if (!module || typeof module !== 'string' || !ALLOWED_MODULES.includes(module)) {
      return res.status(400).json({
        status: 'error',
        message: `Modul '${module}' tidak valid. Modul yang diizinkan: ${ALLOWED_MODULES.join(', ')}`,
      });
    }

    if (!contentType || typeof contentType !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Field contentType wajib diisi (mis. image/jpeg, image/png, video/mp4)',
      });
    }

    // Validasi tipe konten (hanya image/* selain SVG, atau video/mp4, video/webm)
    const isImage = contentType.startsWith('image/') && !contentType.includes('svg');
    const isVideo = contentType === 'video/mp4' || contentType === 'video/webm';

    if (!isImage && !isVideo) {
      return res.status(400).json({
        status: 'error',
        message: 'Tipe konten tidak diizinkan. Hanya file gambar (JPEG, PNG, WebP) dan video (MP4, WebM) yang didukung',
      });
    }

    if (!ext || typeof ext !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Ekstensi file (ext) wajib disertakan (mis. jpg, png, webp, mp4, webm)',
      });
    }

    const cleanExt = ext.replace(/^\./, '').toLowerCase();
    const presignedResult = await storageService.createPresignedUploadUrl({
      tenantId,
      module,
      contentType,
      ext: cleanExt,
      expiresInSeconds: 300,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Presigned upload URL berhasil dibuat',
      data: presignedResult,
    });
  } catch (error: any) {
    console.error('[MediaRouter] Error generate presigned URL:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Gagal membuat presigned upload URL',
    });
  }
});
