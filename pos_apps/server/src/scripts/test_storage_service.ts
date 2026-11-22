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

  // 5. Test Mocking Cloudflare R2 Provider Mode
  console.log('\n--- Uji Deteksi Mode Cloudflare R2 ---');
  process.env.R2_ACCOUNT_ID = 'dummy_account_id';
  process.env.R2_ACCESS_KEY_ID = 'dummy_access_key';
  process.env.R2_SECRET_ACCESS_KEY = 'dummy_secret_key';
  process.env.R2_BUCKET_NAME = 'wellpos-media';
  process.env.R2_PUBLIC_URL = 'https://media.wellpos.id';

  const { StorageService: StorageClass } = await import('../services/storage.service');
  const r2Storage = new StorageClass();
  assert(r2Storage.getProvider() === 'r2', 'R2 provider aktif saat seluruh variabel R2_* diset');

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
    r2Presigned.publicUrl.startsWith(`https://media.wellpos.id/tenants/${dummyTenantId}/laundry/`),
    'Public URL mengarah ke CDN domain publik R2'
  );

  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_BUCKET_NAME;
  delete process.env.R2_PUBLIC_URL;

  console.log('\n================================================================');
  console.log(`🎉 TEST STORAGE SERVICE SELESAI: ${passed}/${total} PASS (100%)`);
  console.log('================================================================');
}

testStorageService().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
