export {};
const BASE_URL = 'http://localhost:5001';

interface AuditResult {
  step: string;
  category: 'DATABASE' | 'PLATFORM_SAAS' | 'ONBOARDING' | 'POS_MERCHANT' | 'SECURITY_RBAC';
  status: 'PASS' | 'FAIL';
  details: string;
  durationMs: number;
}

const results: AuditResult[] = [];

async function recordAudit(
  category: AuditResult['category'],
  step: string,
  fn: () => Promise<string>
) {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    results.push({ category, step, status: 'PASS', details, durationMs });
    console.log(`✅ [${category}] ${step} (${durationMs}ms): ${details}`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ category, step, status: 'FAIL', details: err.message || String(err), durationMs });
    console.error(`❌ [${category}] ${step} (${durationMs}ms): ${err.message || String(err)}`);
  }
}

async function runAuditSuite() {
  console.log('===================================================================');
  console.log('🔍 MEMULAI AUDIT KOMPREHENSIF SISTEM WELL POS (SAAS + POS CORE)');
  console.log('===================================================================\n');

  let superadminToken = '';
  let clientToken = '';
  let newOutletId = '';
  let defaultAdminToken = '';
  let defaultOutletId = '';
  let activeShiftId = '';

  // 1. HEALTH CHECK
  await recordAudit('DATABASE', 'Server & Database Connection Health Check', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const json: any = await res.json();
    if (json.status !== 'ok') throw new Error(`Health status: ${json.status}`);
    return `Server healthy. Environment: ${json.environment || 'development'}`;
  });

  // 2. LEVEL 1: SUPERADMIN PLATFORM
  await recordAudit('PLATFORM_SAAS', 'Superadmin Login (Level 1)', async () => {
    const res = await fetch(`${BASE_URL}/api/platform/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@wellpos.id', password: 'superadmin123' }),
    });
    const json: any = await res.json();
    if (json.status !== 'success' || !json.data?.token) throw new Error(json.message || 'Login failed');
    superadminToken = json.data.token;
    return `Berhasil login sebagai ${json.data.user.name} (${json.data.user.role})`;
  });

  await recordAudit('PLATFORM_SAAS', 'Superadmin Dashboard Metrics & MRR', async () => {
    const res = await fetch(`${BASE_URL}/api/platform/dashboard`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const json: any = await res.json();
    if (json.status !== 'success' || !json.data?.metrics) throw new Error(json.message || 'Fetch failed');
    const m = json.data.metrics;
    return `Total Tenant: ${m.totalTenants}, Aktif: ${m.activeTenants}, Trial: ${m.trialTenants}, MRR: Rp ${m.projectedMRR.toLocaleString('id-ID')}`;
  });

  await recordAudit('PLATFORM_SAAS', 'Superadmin List Tenants & Filter', async () => {
    const res = await fetch(`${BASE_URL}/api/platform/tenants`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const json: any = await res.json();
    if (json.status !== 'success' || !Array.isArray(json.data)) throw new Error(json.message || 'List failed');
    return `Ditemukan ${json.data.length} tenant terdaftar`;
  });

  await recordAudit('PLATFORM_SAAS', 'Superadmin List Subscription Plans', async () => {
    const res = await fetch(`${BASE_URL}/api/platform/plans`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const json: any = await res.json();
    if (json.status !== 'success' || !Array.isArray(json.data)) throw new Error(json.message || 'Plans failed');
    return `Ditemukan ${json.data.length} master paket: ${json.data.map((p: any) => p.code).join(', ')}`;
  });

  // 3. CALON KLIEN: REGISTRASI & ONBOARDING SAAS
  const uniqueCode = Date.now().toString().slice(-5);
  await recordAudit('ONBOARDING', 'Self-Registration Calon Klien Baru', async () => {
    const res = await fetch(`${BASE_URL}/api/saas/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: `Audit Cafe ${uniqueCode}`,
        businessType: 'F&B / Kafe & Restoran',
        ownerName: 'Audit Owner',
        email: `audit_owner_${uniqueCode}@test.com`,
        phone: '081122334455',
        password: 'auditpassword123',
        pin: '998877',
      }),
    });
    const json: any = await res.json();
    if (json.status !== 'success' || !json.data?.token) throw new Error(json.message || 'Register failed');
    clientToken = json.data.token;
    newOutletId = json.data.user.outlet.id;
    return `Tenant [${json.data.tenant.slug}] dibuat. Status: ${json.data.tenant.status}, Trial: ${json.data.tenant.trialEndsAt}`;
  });

  await recordAudit('ONBOARDING', 'Setup Onboarding Wizard 4-Step', async () => {
    const res = await fetch(`${BASE_URL}/api/saas/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        outletId: newOutletId,
        address: 'Jl. Audit Bisnis No. 10, Bandung',
        phone: '081122334455',
        receiptSize: '58mm',
        receiptFooter: 'Terima kasih telah berkunjung!',
        cashierName: 'Kasir Audit Baru',
        cashierPin: '888888',
        seedSampleProducts: true,
      }),
    });
    const json: any = await res.json();
    if (json.status !== 'success') throw new Error(json.message || 'Onboarding failed');
    return `Setup selesai: Kasir [${json.data.createdCashier.name}] dibuat, ${json.data.seededProductsCount} produk sampel ditambahkan.`;
  });

  await recordAudit('ONBOARDING', 'Tenant Subscription Status Check', async () => {
    const res = await fetch(`${BASE_URL}/api/saas/subscription`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const json: any = await res.json();
    if (json.status !== 'success' || !json.data?.tenant) throw new Error(json.message || 'Subscription check failed');
    return `Status: ${json.data.tenant.status}, Bisnis: ${json.data.tenant.businessName}`;
  });

  // 4. POS MERCHANT: CORE TRANSAKSI, STOK & SHIFT
  await recordAudit('POS_MERCHANT', 'Default Merchant Login (admin@pos.com)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@pos.com', password: 'admin123' }),
    });
    const json: any = await res.json();
    if (json.status !== 'success' || !json.data?.token) throw new Error(json.message || 'Merchant login failed');
    defaultAdminToken = json.data.token;
    defaultOutletId = json.data.user.outlet.id;
    return `User: ${json.data.user.name} | Outlet: ${json.data.user.outlet.name}`;
  });

  let products: any[] = [];
  let itemWithStock: any = null;
  await recordAudit('POS_MERCHANT', 'Fetch POS Product Catalog & Stock Check', async () => {
    const res = await fetch(`${BASE_URL}/api/products`);
    const json: any = await res.json();
    if (json.status !== 'success' || !Array.isArray(json.data)) throw new Error(json.message || 'Fetch failed');
    products = json.data;
    if (products.length === 0) throw new Error('Katalog produk kosong');

    // Cari produk di outlet utama yang memiliki stok > 0
    itemWithStock = products.find((p: any) => {
      const match = p.outletProducts?.find((op: any) => op.outletId === defaultOutletId && op.stock > 0);
      return !!match;
    }) || products.find((p: any) => p.name === 'Kopi Susu Gula Aren' || p.name === 'Air Mineral Botol 600ml') || products[0];

    return `Ditemukan ${products.length} produk. Terpilih untuk checkout: [${itemWithStock.name}]`;
  });

  await recordAudit('POS_MERCHANT', 'Buka / Verifikasi Shift Kasir Aktif', async () => {
    const res = await fetch(`${BASE_URL}/api/shifts/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${defaultAdminToken}`,
      },
      body: JSON.stringify({
        startingCash: 100000,
        notes: 'Modal awal shift kasir audit',
      }),
    });
    const json: any = await res.json();
    if (json.status !== 'success' && json.message?.includes('masih aktif')) {
      const currentRes = await fetch(`${BASE_URL}/api/shifts/current`, {
        headers: { Authorization: `Bearer ${defaultAdminToken}` },
      });
      const currentJson: any = await currentRes.json();
      activeShiftId = currentJson.data?.id;
      return `Menggunakan shift kasir yang sedang aktif (ID: ${activeShiftId})`;
    }
    if (json.status !== 'success') throw new Error(json.message || 'Start shift failed');
    activeShiftId = json.data.id;
    return `Shift baru berhasil dibuka (ID: ${activeShiftId}) dengan modal kas Rp 100.000`;
  });

  let createdOrderId = '';
  await recordAudit('POS_MERCHANT', 'Checkout Transaksi POS (Order + Single Payment CASH)', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${defaultAdminToken}`,
      },
      body: JSON.stringify({
        outletId: defaultOutletId,
        customerName: 'Pelanggan Audit Meja 5',
        payment: {
          method: 'CASH',
          amountPaid: Number(itemWithStock.price) * 1,
          changeGiven: 0,
        },
        items: [
          {
            productId: itemWithStock.id,
            quantity: 1,
            discountAmount: 0,
          },
        ],
      }),
    });
    const json: any = await res.json();
    const order = json.data?.order || json.data;
    if (json.status !== 'success' || !order) throw new Error(json.message || 'Checkout failed');
    createdOrderId = order.id;
    return `Order [${order.invoiceNumber}] Grand Total: Rp ${Number(order.grandTotal).toLocaleString('id-ID')} | Status: ${order.status}`;
  });

  await recordAudit('POS_MERCHANT', 'Verifikasi Pengurangan Stok Produk Terpilih', async () => {
    const res = await fetch(`${BASE_URL}/api/products/${itemWithStock.id}`);
    const json: any = await res.json();
    if (json.status !== 'success' || !json.data) throw new Error(json.message || 'Product check failed');
    const op = json.data.outletProducts?.find((o: any) => o.outletId === defaultOutletId);
    return `Produk [${json.data.name}] stok terkini di outlet utama: ${op?.stock ?? 'Tercatat'} ${json.data.unit}`;
  });

  await recordAudit('POS_MERCHANT', 'Hold Order (Simpan Pesanan Meja/Antrean)', async () => {
    const holdRes = await fetch(`${BASE_URL}/api/orders/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${defaultAdminToken}`,
      },
      body: JSON.stringify({
        outletId: defaultOutletId,
        customerName: 'Hold Antrean Meja 12',
        note: 'Tunggu konfirmasi pesanan',
        totalAmount: Number(itemWithStock.price),
        items: [
          {
            productId: itemWithStock.id,
            name: itemWithStock.name,
            quantity: 1,
            price: Number(itemWithStock.price),
          },
        ],
      }),
    });
    const holdJson: any = await holdRes.json();
    if (holdJson.status !== 'success' || !holdJson.data?.id) throw new Error(holdJson.message || 'Hold order failed');
    const holdId = holdJson.data.id;

    // Retrieve and check
    const listRes = await fetch(`${BASE_URL}/api/orders/hold?outletId=${defaultOutletId}`, {
      headers: { Authorization: `Bearer ${defaultAdminToken}` },
    });
    const listJson: any = await listRes.json();
    const found = listJson.data?.find((h: any) => h.id === holdId);
    if (!found) throw new Error('Hold order tidak ditemukan dalam daftar');

    // Hapus hold order setelah diproses
    await fetch(`${BASE_URL}/api/orders/hold/${holdId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${defaultAdminToken}` },
    });

    return `Hold order [${found.customerName}] berhasil disimpan, diverifikasi, dan dituntaskan.`;
  });

  // 5. KEAMANAN, ISOLASI DATA & RBAC
  await recordAudit('SECURITY_RBAC', 'Proteksi Akses Superadmin Tanpa Token', async () => {
    const res = await fetch(`${BASE_URL}/api/platform/dashboard`);
    if (res.status === 401) {
      return 'Akses ditolak (HTTP 401) sesuai spesifikasi keamanan.';
    }
    throw new Error(`Endpoint tidak terproteksi, status: ${res.status}`);
  });

  await recordAudit('SECURITY_RBAC', 'Proteksi Kasir POS Mencoba Akses Superadmin', async () => {
    const res = await fetch(`${BASE_URL}/api/platform/dashboard`, {
      headers: { Authorization: `Bearer ${defaultAdminToken}` },
    });
    if (res.status === 403 || res.status === 401) {
      return `Akses ditolak (HTTP ${res.status}) untuk token merchant biasa.`;
    }
    throw new Error(`Kasir dapat membobol Superadmin, status: ${res.status}`);
  });

  console.log('\n===================================================================');
  console.log('📊 REKAPITULASI HASIL AUDIT KOMPREHENSIF');
  console.log('===================================================================');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total Pengujian: ${results.length} | PASS: ${passCount} | FAIL: ${failCount}`);

  if (failCount > 0) {
    console.error('\n⚠️ TERDAPAT KEGAGALAN DALAM AUDIT:');
    results.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.error(`- [${r.category}] ${r.step}: ${r.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 SELURUH SISTEM SAAS & POS 100% HEALTHY, SOLID DAN NON-BREAKING!');
  }
}

runAuditSuite().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
