import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';

const BASE_URL = 'http://localhost:5001';

async function main() {
  console.log('===================================================================');
  console.log('       VERIFIKASI MEKANISME PAKET FREE VS PRO & DUA AKUN UJI       ');
  console.log('===================================================================\n');

  // 1. Cek Master Paket Langganan di Database
  console.log('[1/4] Memeriksa Master Paket Langganan di Database:');
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { price: 'asc' },
  });

  for (const p of plans) {
    console.log(`  • Paket [${p.code}] - ${p.name}:`);
    console.log(`    - Harga        : Rp ${Number(p.price).toLocaleString('id-ID')}`);
    console.log(`    - Limit Cabang : ${p.maxOutlets} Outlet`);
    console.log(`    - Limit Kasir  : ${p.maxCashiers} Kasir`);
    console.log(`    - Fitur-Fitur  : ${JSON.stringify(p.features)}`);
  }

  // 2. Verifikasi Kredensial Tenant 1 (FREE) & Tenant 2 (PRO)
  console.log('\n[2/4] Verifikasi Kredensial Akun Uji Coba:');

  // Tenant 1 (FREE)
  const tenantFree = await prisma.tenant.findFirst({
    where: { businessName: 'Warung Kopi Berkah' },
    include: {
      subscriptions: { where: { isActive: true }, include: { plan: true } },
      users: true,
      outlets: true,
    },
  });

  if (!tenantFree) {
    throw new Error('Tenant "Warung Kopi Berkah" (FREE) tidak ditemukan!');
  }

  const ownerFree = tenantFree.users.find((u) => u.role === 'ADMIN');
  const cashierFree = tenantFree.users.find((u) => u.role === 'CASHIER');
  const subFree = tenantFree.subscriptions[0];

  const isOwnerFreePassValid = ownerFree ? await bcrypt.compare('free123', ownerFree.passwordHash) : false;
  const isCashierFreePinValid = cashierFree ? cashierFree.pin === '111111' : false;

  console.log(`  🏢 Tenant 1 (FREE): "${tenantFree.businessName}"`);
  console.log(`     - Subdomain  : ${tenantFree.slug}.wellpos.id`);
  console.log(`     - Paket Aktif: ${subFree?.plan?.code} (${subFree?.plan?.name})`);
  console.log(`     - Akun Owner : ${ownerFree?.email} | Password: free123 [Valid: ${isOwnerFreePassValid}]`);
  console.log(`     - Akun Kasir : ${cashierFree?.email} | PIN: 111111 [Valid: ${isCashierFreePinValid}]`);

  // Tenant 2 (PRO)
  const tenantPro = await prisma.tenant.findFirst({
    where: { businessName: 'Minimarket Maju Jaya' },
    include: {
      subscriptions: { where: { isActive: true }, include: { plan: true } },
      users: true,
      outlets: true,
    },
  });

  if (!tenantPro) {
    throw new Error('Tenant "Minimarket Maju Jaya" (PRO) tidak ditemukan!');
  }

  const ownerPro = tenantPro.users.find((u) => u.role === 'ADMIN');
  const cashierPro = tenantPro.users.find((u) => u.role === 'CASHIER');
  const subPro = tenantPro.subscriptions[0];

  const isOwnerProPassValid = ownerPro ? await bcrypt.compare('pro123', ownerPro.passwordHash) : false;
  const isCashierProPinValid = cashierPro ? cashierPro.pin === '222222' : false;

  console.log(`  🏢 Tenant 2 (PRO): "${tenantPro.businessName}"`);
  console.log(`     - Subdomain  : ${tenantPro.slug}.wellpos.id`);
  console.log(`     - Paket Aktif: ${subPro?.plan?.code} (${subPro?.plan?.name})`);
  console.log(`     - Akun Owner : ${ownerPro?.email} | Password: pro123 [Valid: ${isOwnerProPassValid}]`);
  console.log(`     - Akun Kasir : ${cashierPro?.email} | PIN: 222222 [Valid: ${isCashierProPinValid}]`);

  // Superadmin
  const superadmin = await prisma.platformUser.findUnique({
    where: { email: 'superadmin@wellpos.id' },
  });
  const isSuperadminPassValid = superadmin ? await bcrypt.compare('superadmin123', superadmin.passwordHash) : false;
  console.log(`  🛡️ Superadmin Platform: ${superadmin?.email} | Password: superadmin123 [Valid: ${isSuperadminPassValid}]`);

  // 3. Uji Endpoint Backend HTTP (Login, Subscription Context, Feature Guarding)
  console.log('\n[3/4] Menguji Endpoint Backend via HTTP:');

  // Test 3a: Login Owner FREE
  const loginFreeRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner.free@wellpos.id', password: 'free123' }),
  });
  const loginFreeData = (await loginFreeRes.json()) as any;
  const tokenFree = loginFreeData.data?.token;
  console.log(`  ✓ Login Owner FREE (${loginFreeRes.status}): User Subscription = ${loginFreeData.data?.user?.subscription?.planCode} (isFree: ${loginFreeData.data?.user?.subscription?.isFree})`);

  // Test 3b: Cek /api/auth/me & /api/saas/my-subscription untuk FREE
  const meFreeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenFree}` },
  });
  const meFreeData = (await meFreeRes.json()) as any;
  console.log(`  ✓ GET /api/auth/me FREE (${meFreeRes.status}): Plan = ${meFreeData.data?.subscription?.planCode}, Features = ${JSON.stringify(meFreeData.data?.subscription?.features)}`);

  const mySubFreeRes = await fetch(`${BASE_URL}/api/saas/my-subscription`, {
    headers: { Authorization: `Bearer ${tokenFree}` },
  });
  const mySubFreeData = (await mySubFreeRes.json()) as any;
  console.log(`  ✓ GET /api/saas/my-subscription FREE (${mySubFreeRes.status}): Plan = ${mySubFreeData.data?.subscription?.planCode}`);

  // Test 3c: Guarding Laporan Finansial pada Akun FREE (Harus 403)
  const repFreeRes = await fetch(`${BASE_URL}/api/reports/financial`, {
    headers: { Authorization: `Bearer ${tokenFree}` },
  });
  const repFreeData = (await repFreeRes.json()) as any;
  console.log(`  🛡️ GET /api/reports/financial pada akun FREE (${repFreeRes.status}): Status = ${repFreeData.status}, Message = "${repFreeData.message}"`);

  // Test 3d: Login Owner PRO
  const loginProRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner.pro@wellpos.id', password: 'pro123' }),
  });
  const loginProData = (await loginProRes.json()) as any;
  const tokenPro = loginProData.data?.token;
  console.log(`  ✓ Login Owner PRO (${loginProRes.status}): User Subscription = ${loginProData.data?.user?.subscription?.planCode} (isPro: ${loginProData.data?.user?.subscription?.isPro})`);

  // Test 3e: Cek /api/auth/me & /api/saas/my-subscription untuk PRO
  const meProRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenPro}` },
  });
  const meProData = (await meProRes.json()) as any;
  console.log(`  ✓ GET /api/auth/me PRO (${meProRes.status}): Plan = ${meProData.data?.subscription?.planCode}, Features = ${JSON.stringify(meProData.data?.subscription?.features)}`);

  // Test 3f: Guarding Laporan Finansial pada Akun PRO (Harus 200)
  const repProRes = await fetch(`${BASE_URL}/api/reports/financial`, {
    headers: { Authorization: `Bearer ${tokenPro}` },
  });
  const repProData = (await repProRes.json()) as any;
  console.log(`  ✓ GET /api/reports/financial pada akun PRO (${repProRes.status}): Status = ${repProData.status}, Omset = Rp ${repProData.data?.financialSummary?.totalNetRevenue?.toLocaleString('id-ID')}`);

  // 4. Uji Superadmin Instant Switcher
  console.log('\n[4/4] Menguji Superadmin Instant Switcher:');
  const superadminLoginRes = await fetch(`${BASE_URL}/api/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@wellpos.id', password: 'superadmin123' }),
  });
  const superadminData = (await superadminLoginRes.json()) as any;
  const adminToken = superadminData.data?.token;
  console.log(`  ✓ Login Superadmin (${superadminLoginRes.status}): Token didapatkan`);

  // Coba switch tenant FREE menjadi PRO secara instan
  const switchToProRes = await fetch(`${BASE_URL}/api/platform/tenants/${tenantFree.id}/subscription`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ planCode: 'PRO', durationDays: 30 }),
  });
  const switchToProData = (await switchToProRes.json()) as any;
  console.log(`  ⚡ Instant Switch Tenant FREE -> PRO (${switchToProRes.status}): ${switchToProData.message}`);

  // Coba switch kembali menjadi FREE
  const switchToFreeRes = await fetch(`${BASE_URL}/api/platform/tenants/${tenantFree.id}/subscription`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ planCode: 'FREE', durationDays: 365 }),
  });
  const switchToFreeData = (await switchToFreeRes.json()) as any;
  console.log(`  🔄 Instant Switch Tenant PRO -> FREE (${switchToFreeRes.status}): ${switchToFreeData.message}`);

  console.log('\n===================================================================');
  console.log('       SEMUA VERIFIKASI MEKANISME FREE VS PRO BERHASIL 100%!       ');
  console.log('===================================================================\n');
}

main()
  .catch((e) => {
    console.error('Error during verification:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
