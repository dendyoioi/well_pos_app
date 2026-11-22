import fs from 'fs';
import path from 'path';
import { storageService } from '../services/storage.service';

async function testStorageService() {
  console.log('================================================================');
  console.log('🧪 TESTING OBJECT STORAGE SERVICE (CLOUDFLARE R2 & LOCAL FALLBACK)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // 1. Cek Mode Default Lokal
  const provider = storageService.getProvider();
  console.log(`Current storage provider: ${provider}`);
  assert(provider === 'local' || provider === 'r2', 'Provider valid (local atau r2)');

  // 2. Test Upload Buffer
  const dummyTenantId = 'test-tenant-12345';
  const dummyBuffer = Buffer.from('RIFF....WEBPVP8 ... dummy test webp content ...');
  const uploadRes = await storageService.uploadBuffer({
    buffer: dummyBuffer,
    contentType: 'image/webp',
    ext: 'webp',
    tenantId: dummyTenantId,
    module: 'laundry',
  });

  console.log('Upload Result:', uploadRes);
  assert(Boolean(uploadRes.url), 'Upload menghasilkan URL');
  assert(Boolean(uploadRes.key), 'Upload menghasilkan Key');
  assert(uploadRes.provider === provider, 'Upload provider cocok dengan mode aktif');

  if (provider === 'local') {
    assert(uploadRes.url.startsWith(`/uploads/laundry/${dummyTenantId}/`), 'URL lokal berawalan /uploads/laundry/<tenantId>/');
    const localFilePath = path.resolve(__dirname, '../../uploads/laundry', dummyTenantId, path.basename(uploadRes.url));
    assert(fs.existsSync(localFilePath), `File fisik tersimpan di disk: ${localFilePath}`);
  }

  // 3. Test Presigned Upload URL
  const presignedRes = await storageService.createPresignedUploadUrl({
    tenantId: dummyTenantId,
    module: 'laundry',
    contentType: 'image/jpeg',
    ext: 'jpg',
    expiresInSeconds: 300,
  });

  console.log('Presigned URL Result:', presignedRes);
  assert(Boolean(presignedRes.uploadUrl), 'Presigned result memuat uploadUrl');
  assert(Boolean(presignedRes.publicUrl), 'Presigned result memuat publicUrl');
  assert(presignedRes.expiresInSeconds === 300, 'Expiry time sesuai 300 detik');

  // 4. Test Delete File
  const deleteSuccess = await storageService.deleteFile(uploadRes.url);
  assert(deleteSuccess === true, 'Penghapusan file berhasil');

  if (provider === 'local') {
    const localFilePath = path.resolve(__dirname, '../../uploads/laundry', dummyTenantId, path.basename(uploadRes.url));
    assert(!fs.existsSync(localFilePath), 'File fisik telah bersih dan terhapus dari disk');

    // Cleanup direktori test tenant jika kosong
    const testDir = path.resolve(__dirname, '../../uploads/laundry', dummyTenantId);
    if (fs.existsSync(testDir) && fs.readdirSync(testDir).length === 0) {
      fs.rmdirSync(testDir);
    }
  }

  // 5. Test Mocking Cloudflare R2 Provider Mode & Environment Prefix
  console.log('\n--- Uji Deteksi Mode Cloudflare R2 & Prefix Environment ---');
  process.env.R2_ACCOUNT_ID = 'dummy_account_id';
  process.env.R2_ACCESS_KEY_ID = 'dummy_access_key';
  process.env.R2_SECRET_ACCESS_KEY = 'dummy_secret_key';
  process.env.R2_BUCKET_NAME = 'wellpos-media';
  process.env.R2_PUBLIC_URL = 'https://media.wellpos.id';
  process.env.STORAGE_ENV_PREFIX = 'dev';

  const { StorageService: StorageClass } = await import('../services/storage.service');
  const r2Storage = new StorageClass();
  assert(r2Storage.getProvider() === 'r2', 'R2 provider aktif saat seluruh variabel R2_* diset');
  assert(r2Storage.getEnvPrefix() === 'dev', 'Environment prefix dev terbaca dengan benar');

  const r2Presigned = await r2Storage.createPresignedUploadUrl({
    tenantId: dummyTenantId,
    module: 'laundry',
    contentType: 'image/jpeg',
    ext: 'jpg',
    expiresInSeconds: 600,
  });

  assert(
    r2Presigned.uploadUrl.includes('dummy_account_id.r2.cloudflarestorage.com') && r2Presigned.uploadUrl.includes('wellpos-media'),
    'Presigned upload URL mengarah ke endpoint Cloudflare R2 virtual host'
  );
  assert(
    r2Presigned.publicUrl.startsWith(`https://media.wellpos.id/dev/tenants/${dummyTenantId}/laundry/`),
    'Public URL mengarah ke CDN domain publik R2 dengan isolasi prefix dev'
  );

  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_BUCKET_NAME;
  delete process.env.R2_PUBLIC_URL;
  delete process.env.STORAGE_ENV_PREFIX;

  // 6. Test resolveDataUrlToStorage
  console.log('\n--- Uji resolveDataUrlToStorage ---');
  // 6.1 Passthrough null/undefined/empty
  const emptyRes = await storageService.resolveDataUrlToStorage({
    input: null,
    tenantId: dummyTenantId,
    module: 'products',
  });
  assert(emptyRes === null, 'resolveDataUrlToStorage mengembalikan null untuk input null');

  // 6.2 Passthrough existing URLs
  const existingHttps = 'https://media.wellpos.id/dev/tenants/123/products/photo.jpg';
  const httpsRes = await storageService.resolveDataUrlToStorage({
    input: existingHttps,
    tenantId: dummyTenantId,
    module: 'products',
  });
  assert(httpsRes === existingHttps, 'resolveDataUrlToStorage membiarkan https:// URL tanpa modifikasi');

  const existingLocal = '/uploads/products/123/photo.png';
  const localRes = await storageService.resolveDataUrlToStorage({
    input: existingLocal,
    tenantId: dummyTenantId,
    module: 'products',
  });
  assert(localRes === existingLocal, 'resolveDataUrlToStorage membiarkan /uploads/ URL tanpa modifikasi');

  // 6.3 Valid 1x1 PNG base64 data URL
  const validBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const resolvedUrl = await storageService.resolveDataUrlToStorage({
    input: validBase64,
    tenantId: dummyTenantId,
    module: 'products',
  });
  assert(Boolean(resolvedUrl) && typeof resolvedUrl === 'string', 'resolveDataUrlToStorage berhasil mengonversi base64 PNG menjadi URL');
  if (resolvedUrl) {
    const deleted = await storageService.deleteFile(resolvedUrl);
    assert(deleted === true, 'Pembersihan file hasil konversi base64 berhasil');
  }

  // 6.4 Reject SVG
  let svgRejected = false;
  try {
    await storageService.resolveDataUrlToStorage({
      input: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==',
      tenantId: dummyTenantId,
      module: 'products',
    });
  } catch (err: any) {
    svgRejected = err.message.includes('SVG tidak diizinkan');
  }
  assert(svgRejected, 'resolveDataUrlToStorage menolak format SVG');

  // 6.5 Reject Oversize (> maxBytes)
  let oversizeRejected = false;
  try {
    await storageService.resolveDataUrlToStorage({
      input: validBase64,
      tenantId: dummyTenantId,
      module: 'products',
      maxBytes: 10, // sangat kecil agar tertolak
    });
  } catch (err: any) {
    oversizeRejected = err.message.includes('Ukuran file');
  }
  assert(oversizeRejected, 'resolveDataUrlToStorage menolak file yang melebihi maxBytes');

  console.log('\n================================================================');
  console.log(`🎉 TEST STORAGE SERVICE SELESAI: ${passed}/${total} PASS (100%)`);
  console.log('================================================================');
}

testStorageService().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
