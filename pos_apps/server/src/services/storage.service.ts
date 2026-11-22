import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadBufferOptions {
  buffer: Buffer;
  contentType: string;
  ext: string;
  tenantId: string;
  module: string;
}

export interface UploadResult {
  url: string;
  key: string;
  provider: 'r2' | 'local';
}

export interface PresignedUrlOptions {
  tenantId: string;
  module: string;
  contentType: string;
  ext: string;
  expiresInSeconds?: number;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresInSeconds: number;
  provider: 'r2' | 'local';
}

export interface ResolveDataUrlOptions {
  input?: string | null;
  tenantId: string;
  module: string;
  maxBytes?: number;
}

export class StorageService {
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;
  private publicUrl: string | null = null;
  private isR2Configured: boolean = false;
  private localUploadsDir: string;

  constructor() {
    this.localUploadsDir = path.resolve(__dirname, '../../uploads');
    this.init();
  }

  private init() {
    const accountId = process.env.R2_ACCOUNT_ID?.trim();
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
    const bucketName = process.env.R2_BUCKET_NAME?.trim();
    const publicUrl = process.env.R2_PUBLIC_URL?.trim();

    if (accountId && accessKeyId && secretAccessKey && bucketName && publicUrl) {
      try {
        this.s3Client = new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.bucketName = bucketName;
        this.publicUrl = publicUrl.replace(/\/$/, '');
        this.isR2Configured = true;
        console.log(`[StorageService] Initialized with Cloudflare R2 provider (Bucket: ${bucketName}, Prefix: ${this.getEnvPrefix()})`);
      } catch (err) {
        console.error('[StorageService] Failed to initialize S3Client for R2, falling back to local:', err);
        this.isR2Configured = false;
      }
    } else {
      this.isR2Configured = false;
      console.log('[StorageService] R2 environment variables not complete. Operating in local storage fallback mode.');
    }
  }

  public getProvider(): 'r2' | 'local' {
    return this.isR2Configured ? 'r2' : 'local';
  }

  /**
   * Mendapatkan prefix environment aktif untuk isolasi bucket R2.
   * Prioritas: STORAGE_ENV_PREFIX -> 'prod' (jika NODE_ENV & APP_ENV production) -> default 'dev'.
   */
  public getEnvPrefix(): string {
    const custom = process.env.STORAGE_ENV_PREFIX?.trim();
    if (custom) return custom;
    if (process.env.NODE_ENV === 'production' && process.env.APP_ENV === 'production') {
      return 'prod';
    }
    return 'dev';
  }

  /**
   * Generates a canonical multi-tenant storage key with environment isolation:
   * ${envPrefix}/tenants/${tenantId}/${module}/${YYYY-MM}/${uuid}.${ext}
   */
  private generateStorageKey(tenantId: string, module: string, ext: string): { key: string; filename: string; dateFolder: string } {
    const now = new Date();
    const dateFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const cleanExt = ext.replace(/^\./, '').toLowerCase();
    const filename = `${crypto.randomUUID()}.${cleanExt}`;
    const envPrefix = this.getEnvPrefix();
    const key = `${envPrefix}/tenants/${tenantId}/${module}/${dateFolder}/${filename}`;
    return { key, filename, dateFolder };
  }

  /**
   * Upload buffer directly to Cloudflare R2 or local disk storage.
   */
  async uploadBuffer(options: UploadBufferOptions): Promise<UploadResult> {
    const { buffer, contentType, ext, tenantId, module } = options;
    const { key, filename } = this.generateStorageKey(tenantId, module, ext);

    if (this.isR2Configured && this.s3Client && this.bucketName && this.publicUrl) {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      });

      await this.s3Client.send(command);
      const url = `${this.publicUrl}/${key}`;

      return {
        url,
        key,
        provider: 'r2',
      };
    }

    // Fallback: Local disk storage
    const targetDir = path.join(this.localUploadsDir, module, tenantId);
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    const localFilePath = path.join(targetDir, filename);
    await fs.promises.writeFile(localFilePath, buffer);
    const localUrl = `/uploads/${module}/${tenantId}/${filename}`;

    return {
      url: localUrl,
      key: `uploads/${module}/${tenantId}/${filename}`,
      provider: 'local',
    };
  }

  /**
   * Generates a pre-signed PUT URL for direct browser uploads.
   * Useful for high-res images / videos to bypass Render 512MB RAM limit.
   */
  async createPresignedUploadUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult> {
    const { tenantId, module, contentType, ext, expiresInSeconds = 300 } = options;
    const { key, filename } = this.generateStorageKey(tenantId, module, ext);

    if (this.isR2Configured && this.s3Client && this.bucketName && this.publicUrl) {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
      const publicUrl = `${this.publicUrl}/${key}`;

      return {
        uploadUrl,
        publicUrl,
        key,
        expiresInSeconds,
        provider: 'r2',
      };
    }

    // Fallback for local development
    const localUrl = `/uploads/${module}/${tenantId}/${filename}`;
    return {
      uploadUrl: localUrl,
      publicUrl: localUrl,
      key: `uploads/${module}/${tenantId}/${filename}`,
      expiresInSeconds,
      provider: 'local',
    };
  }

  /**
   * Mengonversi Base64 Data URL menjadi URL media tersimpan (R2 atau Local),
   * atau meloloskan input jika sudah berupa URL (http/https/uploads) secara transparan.
   */
  async resolveDataUrlToStorage(options: ResolveDataUrlOptions): Promise<string | null | undefined> {
    const { input, tenantId, module, maxBytes = 2 * 1024 * 1024 } = options;

    // 1. Jika kosong / null / undefined
    if (input === null) return null;
    if (input === undefined) return undefined;
    if (input === '') return '';

    // 2. Jika sudah berupa URL publik atau path statis lokal, kembalikan langsung (100% backward compatible)
    if (
      input.startsWith('http://') ||
      input.startsWith('https://') ||
      input.startsWith('/uploads/') ||
      input.startsWith('uploads/')
    ) {
      return input;
    }

    // 3. Proses jika berupa Base64 Data URL
    if (input.startsWith('data:')) {
      const matches = input.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Format Data URL gambar tidak valid');
      }

      const rawSubtype = matches[1].toLowerCase();

      // Tolak SVG demi alasan keamanan anti-XSS
      if (rawSubtype === 'svg+xml' || rawSubtype === 'svg') {
        throw new Error('Format SVG tidak diizinkan untuk upload gambar demi alasan keamanan');
      }

      const ALLOWED_MIME_EXTS: Record<string, { ext: string; contentType: string }> = {
        jpeg: { ext: 'jpg', contentType: 'image/jpeg' },
        jpg: { ext: 'jpg', contentType: 'image/jpeg' },
        png: { ext: 'png', contentType: 'image/png' },
        webp: { ext: 'webp', contentType: 'image/webp' },
      };

      const mimeConfig = ALLOWED_MIME_EXTS[rawSubtype];
      if (!mimeConfig) {
        throw new Error(`Format gambar '${rawSubtype}' tidak didukung. Hanya JPEG, PNG, dan WebP yang diizinkan.`);
      }

      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length > maxBytes) {
        const maxMb = Math.round(maxBytes / (1024 * 1024));
        throw new Error(`Ukuran file gambar melebihi batas maksimum ${maxMb} MB`);
      }

      const uploadResult = await this.uploadBuffer({
        buffer,
        contentType: mimeConfig.contentType,
        ext: mimeConfig.ext,
        tenantId,
        module,
      });

      return uploadResult.url;
    }

    // Default passthrough jika string biasa
    return input;
  }

  /**
   * Deletes a file from Cloudflare R2 or local disk storage.
   * Mendukung key dengan prefix dev/tenants/, prod/tenants/, maupun legacy tenants/.
   */
  async deleteFile(keyOrUrl: string): Promise<boolean> {
    if (!keyOrUrl) return false;

    try {
      // 1. If R2 is configured and key/url matches R2
      if (this.isR2Configured && this.s3Client && this.bucketName) {
        let r2Key = keyOrUrl;
        if (this.publicUrl && keyOrUrl.startsWith(this.publicUrl)) {
          r2Key = keyOrUrl.substring(this.publicUrl.length).replace(/^\//, '');
        }

        const isR2Key =
          r2Key.startsWith('tenants/') ||
          r2Key.startsWith('dev/tenants/') ||
          r2Key.startsWith('prod/tenants/') ||
          /^[a-zA-Z0-9_-]+\/tenants\//.test(r2Key);

        if (isR2Key) {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: r2Key,
            })
          );
          return true;
        }
      }

      // 2. Handle local file fallback deletion
      let cleanLocalPath = keyOrUrl;
      if (cleanLocalPath.startsWith('/uploads/')) {
        cleanLocalPath = cleanLocalPath.replace('/uploads/', '');
      } else if (cleanLocalPath.startsWith('uploads/')) {
        cleanLocalPath = cleanLocalPath.replace('uploads/', '');
      }

      const diskPath = path.resolve(this.localUploadsDir, cleanLocalPath);
      if (!diskPath.startsWith(this.localUploadsDir + path.sep)) {
        console.warn(`[StorageService] Path traversal attempt blocked: ${keyOrUrl}`);
        return false;
      }

      if (fs.existsSync(diskPath)) {
        await fs.promises.unlink(diskPath);
        return true;
      }

      return false;
    } catch (err) {
      console.error(`[StorageService] Error deleting file (${keyOrUrl}):`, err);
      return false;
    }
  }
}

export const storageService = new StorageService();
