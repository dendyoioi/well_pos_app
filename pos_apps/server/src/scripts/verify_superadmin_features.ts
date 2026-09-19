export {};
const BASE_URL = 'http://localhost:5001';

async function testSuperadminFeatures() {
  console.log('===================================================================');
  console.log('👑 VERIFIKASI FITUR LANJUTAN SUPERADMIN PLATFORM (LEVEL 1)');
  console.log('===================================================================\n');

  // 1. Login Superadmin
  console.log('1. Autentikasi Superadmin...');
  const loginRes = await fetch(`${BASE_URL}/api/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@wellpos.id', password: 'superadmin123' }),
  });
  const loginJson: any = await loginRes.json();
  if (loginJson.status !== 'success') throw new Error(loginJson.message);
  const token = loginJson.data.token;
  console.log('   ✅ Login Superadmin Berhasil!');

  // 2. Ambil list tenant dan plans
  console.log('\n2. Mengambil Master Plans & List Tenants...');
  const [plansRes, tenantsRes] = await Promise.all([
    fetch(`${BASE_URL}/api/platform/plans`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${BASE_URL}/api/platform/tenants`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  const plansJson: any = await plansRes.json();
  const tenantsJson: any = await tenantsRes.json();
  const proPlan = plansJson.data.find((p: any) => p.code === 'PRO') || plansJson.data[0];
  const targetTenant = tenantsJson.data[0];
  console.log(`   ✅ Target Tenant: "${targetTenant.businessName}" (ID: ${targetTenant.id})`);
  console.log(`   ✅ Paket Pilihan: "${proPlan.name}" (ID: ${proPlan.id})`);

  // 3. GET /api/platform/tenants/:id (Tenant Deep Dive)
  console.log('\n3. Menguji GET /api/platform/tenants/:id (Detail Tenant & Kontak)...');
  const detailRes = await fetch(`${BASE_URL}/api/platform/tenants/${targetTenant.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const detailJson: any = await detailRes.json();
  if (detailJson.status !== 'success') throw new Error(detailJson.message);
  const d = detailJson.data;
  console.log('   ✅ Detail Tenant Diterima:');
  console.log('      - Nama Bisnis:', d.tenant.businessName, `(${d.tenant.slug})`);
  console.log('      - Owner:', d.owner?.name, `| Email: ${d.owner?.email} | Telepon: ${d.owner?.phone}`);
  console.log('      - Total Cabang:', d.stats.totalOutlets, '| Total Staf:', d.stats.totalUsers);
  console.log('      - Total Produk:', d.stats.totalProducts, '| Total Pesanan:', d.stats.totalOrders);
  console.log('      - Total Omset Toko: Rp', d.stats.totalRevenue.toLocaleString('id-ID'));
  console.log('      - Paket Aktif Saat Ini:', d.currentSubscription?.planName || 'Belum diatur');

  // 4. PUT /api/platform/tenants/:id/subscription (Perpanjang Langganan)
  console.log('\n4. Menguji PUT /api/platform/tenants/:id/subscription (+90 Hari)...');
  const subRes = await fetch(`${BASE_URL}/api/platform/tenants/${targetTenant.id}/subscription`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      planId: proPlan.id,
      durationDays: 90,
    }),
  });
  const subJson: any = await subRes.json();
  if (subJson.status !== 'success') throw new Error(subJson.message);
  console.log('   ✅ Langganan Berhasil Diperbarui!');
  console.log('      - Status Tenant:', subJson.data.tenant.status);
  console.log('      - Paket Langganan:', subJson.data.subscription.planName);
  console.log('      - Kedaluwarsa Baru:', subJson.data.subscription.expiresAt);

  // 5. POST /api/platform/tenants/:id/impersonate (Buka Toko Klien)
  console.log('\n5. Menguji POST /api/platform/tenants/:id/impersonate (Impersonasi Owner)...');
  const impRes = await fetch(`${BASE_URL}/api/platform/tenants/${targetTenant.id}/impersonate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const impJson: any = await impRes.json();
  if (impJson.status !== 'success') throw new Error(impJson.message);
  const impersonatedUser = impJson.data.user;
  const impersonatedToken = impJson.data.token;
  console.log('   ✅ Impersonasi Berhasil!');
  console.log('      - Login Sebagai:', impersonatedUser.name, `(${impersonatedUser.role})`);
  console.log('      - Flag isImpersonated:', impersonatedUser.isImpersonated);
  console.log('      - Diinspeksi Oleh:', impersonatedUser.impersonatedBy);

  // Verifikasi akses endpoint kasir menggunakan impersonatedToken
  const profileRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${impersonatedToken}` },
  });
  const profileJson: any = await profileRes.json();
  if (profileJson.status !== 'success') throw new Error(profileJson.message);
  console.log('      - Verifikasi /api/auth/me dengan Impersonated Token: VALID');

  // 6. POST /api/platform/tenants/:id/reset-password (Reset Kata Sandi Owner)
  console.log('\n6. Menguji POST /api/platform/tenants/:id/reset-password (Reset Sandi)...');
  const resetRes = await fetch(`${BASE_URL}/api/platform/tenants/${targetTenant.id}/reset-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const resetJson: any = await resetRes.json();
  if (resetJson.status !== 'success') throw new Error(resetJson.message);
  const tempPass = resetJson.data.temporaryPassword;
  console.log('   ✅ Kata Sandi Berhasil Disetel Ulang!');
  console.log('      - Email Owner:', resetJson.data.ownerEmail);
  console.log('      - Kata Sandi Sementara Baru:', tempPass);

  // Uji coba login menggunakan temporary password baru
  const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: resetJson.data.ownerEmail,
      password: tempPass,
    }),
  });
  const ownerLoginJson: any = await ownerLoginRes.json();
  if (ownerLoginJson.status !== 'success') throw new Error('Login dengan password sementara gagal');
  console.log('      - Uji Coba Login dengan Sandi Sementara: BERHASIL!');

  console.log('\n===================================================================');
  console.log('🎉 SELURUH 4 FITUR SUPERADMIN PLATFORM BERHASIL TERVERIFIKASI 100%!');
  console.log('===================================================================');
}

testSuperadminFeatures().catch((err) => {
  console.error('❌ Error verifikasi:', err);
  process.exit(1);
});
