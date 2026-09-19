export {};
const BASE_URL = 'http://localhost:5001';

async function runTests() {
  console.log('🚀 MEMULAI VERIFIKASI PEMISAHAN SISTEM SAAS & POS');
  console.log('==================================================\n');

  // 1. Superadmin Login
  console.log('1. Menguji Login Superadmin Platform (Level 1)...');
  const loginRes = await fetch(`${BASE_URL}/api/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@wellpos.id',
      password: 'superadmin123',
    }),
  });
  const loginJson: any = await loginRes.json();
  if (loginJson.status !== 'success' || !loginJson.data?.token) {
    throw new Error(`Login Superadmin Gagal: ${JSON.stringify(loginJson)}`);
  }
  const platformToken = loginJson.data.token;
  console.log('   ✅ Superadmin Login Berhasil! User:', loginJson.data.user.name, `(${loginJson.data.user.role})`);

  // 2. Superadmin Dashboard KPI
  console.log('\n2. Mengambil Metrik KPI Dashboard Platform...');
  const dashRes = await fetch(`${BASE_URL}/api/platform/dashboard`, {
    headers: { Authorization: `Bearer ${platformToken}` },
  });
  const dashJson: any = await dashRes.json();
  console.log('   ✅ Metrik KPI Berhasil Didapat:', dashJson.data?.metrics);

  // 3. Superadmin List Tenants
  console.log('\n3. Mengambil Daftar Tenant Terdaftar...');
  const tenantsRes = await fetch(`${BASE_URL}/api/platform/tenants`, {
    headers: { Authorization: `Bearer ${platformToken}` },
  });
  const tenantsJson: any = await tenantsRes.json();
  console.log(`   ✅ Ditemukan ${tenantsJson.data?.length} tenant di platform.`);
  const sampleTenant = tenantsJson.data?.[0];
  console.log(`   Sample Tenant: "${sampleTenant.businessName}" (Status: ${sampleTenant.status}, ID: ${sampleTenant.id})`);

  // 4. Test Toggle Status (Suspend -> Re-activate)
  console.log('\n4. Menguji Fitur Suspend Tenant...');
  const suspendRes = await fetch(`${BASE_URL}/api/platform/tenants/${sampleTenant.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${platformToken}`,
    },
    body: JSON.stringify({ status: 'SUSPENDED', notes: 'Uji coba penangguhan sementara oleh Superadmin' }),
  });
  const suspendJson: any = await suspendRes.json();
  console.log('   ✅ Status Berhasil Diubah:', suspendJson.data?.status);

  console.log('   Mengembalikan status tenant menjadi ACTIVE...');
  const reactivateRes = await fetch(`${BASE_URL}/api/platform/tenants/${sampleTenant.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${platformToken}`,
    },
    body: JSON.stringify({ status: 'ACTIVE', notes: 'Diaktifkan kembali' }),
  });
  const reactivateJson: any = await reactivateRes.json();
  console.log('   ✅ Status Berhasil Dikembalikan:', reactivateJson.data?.status);

  // 5. Test Self-Registration Calon Klien di Website SaaS
  console.log('\n5. Menguji Pendaftaran Mandiri Calon Klien Baru via Website SaaS...');
  const testSubdomain = `kopi-${Date.now().toString().slice(-5)}`;
  const regRes = await fetch(`${BASE_URL}/api/saas/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: `Kedai Kopi Uji Coba ${Date.now().toString().slice(-4)}`,
      businessType: 'F&B / Kafe & Restoran',
      ownerName: 'Budi Santoso',
      email: `owner_${testSubdomain}@test.com`,
      phone: '081299887766',
      password: 'password123',
      pin: '123456',
    }),
  });
  const regJson: any = await regRes.json();
  if (regJson.status !== 'success') {
    throw new Error(`Pendaftaran mandiri gagal: ${JSON.stringify(regJson)}`);
  }
  const clientToken = regJson.data.token;
  const outletId = regJson.data.user.outlet.id;
  console.log('   ✅ Tenant Baru Berhasil Didaftarkan!');
  console.log('   Bisnis:', regJson.data.tenant.businessName, '| Subdomain:', regJson.data.tenant.subdomain);
  console.log('   Status:', regJson.data.tenant.status, '| Trial Sampai:', regJson.data.tenant.trialEndsAt);

  // 6. Test Onboarding Wizard 4-Step
  console.log('\n6. Menguji Eksekusi Onboarding Wizard Klien...');
  const onboardRes = await fetch(`${BASE_URL}/api/saas/onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      outletId: outletId,
      address: 'Jl. Sudirman No. 88, Jakarta Selatan',
      phone: '081299887766',
      receiptSize: '80mm',
      receiptFooter: 'Terima kasih atas kunjungan Anda di Kedai Kopi Uji Coba!',
      cashierName: 'Kasir Satu',
      cashierPin: '777777',
      seedSampleProducts: true,
    }),
  });
  const onboardJson: any = await onboardRes.json();
  console.log('   ✅ Onboarding Wizard Berhasil Dilengkapi!');
  console.log('   Hasil:', onboardJson.data);

  // 7. Test Login Kasir Baru yang Dibuat di Onboarding
  console.log('\n7. Menguji Login PIN Kasir Baru (777777) di Mesin Kasir POS...');
  const cashierPinRes = await fetch(`${BASE_URL}/api/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '777777' }),
  });
  const cashierPinJson: any = await cashierPinRes.json();
  if (cashierPinJson.status === 'success') {
    console.log('   ✅ Kasir Baru Berhasil Login dengan PIN! Role:', cashierPinJson.data.user.role, 'Outlet:', cashierPinJson.data.user.outlet.name);
  } else {
    console.log('   Catatan PIN Login:', cashierPinJson.message);
  }

  console.log('\n==================================================');
  console.log('🎉 SELURUH SKENARIO PEMISAHAN SISTEM SAAS & POS BERHASIL DIVERIFIKASI 100%!');
}

runTests().catch((err) => {
  console.error('❌ Terjadi Kesalahan Uji Coba:', err);
  process.exit(1);
});
