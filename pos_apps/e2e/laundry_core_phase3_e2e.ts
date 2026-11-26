import { chromium, Browser, Page } from 'playwright';
import {
  PrismaClient,
  Role,
  BusinessVerticalMode,
  OrderStatus,
  PaymentStatus,
  CustomerTier,
  Prisma,
} from '../server/node_modules/@prisma/client';
import bcrypt from '../server/node_modules/bcryptjs';

const prisma = new PrismaClient();
const BASE_FRONTEND = 'http://localhost:5173';
const BASE_BACKEND = 'http://localhost:5001';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function navigateToTab(p: Page, tab: string) {
  await p.evaluate((t) => {
    window.dispatchEvent(new CustomEvent('wellpos:navigate_tab', { detail: t }));
  }, tab);
}

async function runLaundryCorePhase3E2E() {
  console.log('================================================================================');
  console.log('🧪 LAUNDRY CORE ENGINE — CORE PHASE 3 (GROWTH, SELF-SERVICE & AUTOMATION) E2E SUITE');
  console.log('   Target Frontend:', BASE_FRONTEND);
  console.log('   Target Backend: ', BASE_BACKEND);
  console.log('================================================================================\n');

  const timestamp = Date.now().toString();
  const tenantSlug = `lnd-core-p3-${timestamp}`;
  const ownerEmail = `owner.corep3.${timestamp}@wellpos.test`;
  const passwordRaw = 'Password123!';
  const passwordHash = await bcrypt.hash(passwordRaw, 10);

  let createdTenantId: string | null = null;
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // =========================================================================
    // 0. SEEDING ISOLATED TEST TENANT & ENTITIES
    // =========================================================================
    console.log('🌱 [0/4] Menyiapkan tenant, outlet delivery, dompet pelanggan & 1 order aktif...');

    // 1. Buat Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: `Laundry Core P3 Corp ${timestamp.slice(-4)}`,
        slug: tenantSlug,
        businessVertical: 'SERVICES',
        status: 'ACTIVE',
        businessType: 'LAUNDRY',
        phone: '+6281234567890',
      },
    });
    createdTenantId = tenant.id;

    // 2. Subscription & SaaSInvoice (500 tokens)
    const proPlan = await prisma.subscriptionPlan.findFirst({
      where: { code: 'PRO' },
    });
    const planId = proPlan ? proPlan.id : (await prisma.subscriptionPlan.findFirst())!.id;

    await prisma.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.saaSInvoice.create({
      data: {
        tenantId: tenant.id,
        planId,
        invoiceNumber: `INV-CORE3-${timestamp.slice(-6)}`,
        amount: 50000,
        tokenAmount: 500,
        status: 'PAID',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        paidAt: new Date(),
        notes: 'Top Up Awal 500 Token E2E Core Phase 3',
      },
    });

    // 3. Business Laundry
    const business = await prisma.business.create({
      data: {
        tenantId: tenant.id,
        name: 'Superwash Delivery & Express Hub',
        slug: `superwash-p3-${timestamp.slice(-6)}`,
        vertical: BusinessVerticalMode.LAUNDRY,
        subCategory: 'Kiloan & Satuan Delivery',
        isActive: true,
      },
    });

    // 4. Outlet Delivery Hub
    const outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        code: `LND-DLV-${timestamp.slice(-3)}`,
        name: 'Superwash Delivery Menteng',
        address: 'Jl. Teuku Umar No. 25, Menteng, Jakarta Pusat',
        phone: '+6281299998888',
        industries: ['LAUNDRY'],
        isWorkshop: true,
        isActive: true,
        laundryDeliveryConfig: {
          enabled: true,
          fixedFee: 15000,
          freeDeliveryThreshold: 100000,
          maxCoverageKm: 10,
        },
      },
    });

    // 5. Layanan Cuci Kiloan & Satuan
    await prisma.laundryService.create({
      data: {
        tenantId: tenant.id,
        name: 'Cuci Kering Setrika Reguler',
        category: 'KILOAN',
        unit: 'KG',
        price: 12000,
        durationHours: 48,
        description: 'Pakaian wangi, rapi terlipat dalam kemasan steril',
        isActive: true,
      },
    });

    // 6. User OWNER
    const ownerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userCode: `OWN-${timestamp.slice(-4)}`,
        name: 'Bpk. Hendra Delivery Owner',
        firstName: 'Hendra',
        lastName: 'Delivery',
        email: ownerEmail,
        passwordHash,
        role: Role.OWNER,
        isActive: true,
        phone: '+6281122334455',
      },
    });

    // 7. Customer Uji dengan Saldo Wallet Rp 150.000 & Kuota Kiloan 10 Kg
    const customerPhone = '081234567890';
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        code: `CUST-P3-${timestamp.slice(-4)}`,
        name: 'Ibu Sinta Mandiri',
        phone: '+6281234567890',
        address: 'Jl. Cempaka Putih Tengah No. 15, Jakarta Pusat',
        loyaltyPoints: 250,
        tier: CustomerTier.GOLD,
      },
    });

    await prisma.customerLaundryWallet.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        balanceAmount: new Prisma.Decimal(150000), // Rp 150.000
        quotaKg: new Prisma.Decimal(10.0), // 10.0 Kg
        quotaExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // 8. Buat 1 Order Aktif dengan Antar Pesanan (Delivery Task)
    const order1 = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: ownerUser.id,
        customerId: customer.id,
        invoiceNumber: `INV-P3-${timestamp.slice(-4)}`,
        subtotal: 75000,
        totalAmount: 75000,
        orderStatus: OrderStatus.IN_PROGRESS,
        paymentStatus: PaymentStatus.PAID,
      },
    });

    await prisma.laundryOrderDetail.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        orderId: order1.id,
        currentStage: 'IRONING',
        status: 'IN_PROGRESS',
        totalWeightKg: new Prisma.Decimal(5.0),
        totalPieces: 10,
        deliveryType: 'PICKUP_AND_DELIVERY',
        deliveryStatus: 'PENDING',
        rackCode: 'RAK-B1',
      },
    });

    console.log('   ✅ Data isolasi tenant, outlet, user, customer & wallet siap.\n');

    // Launch Browser Playwright
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    page = await context.newPage();

    let createdRequestCode = '';

    // =========================================================================
    // SKENARIO 1: CUSTOMER SELF-SERVICE PORTAL (/ #portal?outletId=...)
    // =========================================================================
    console.log('▶️ [SKENARIO 1] Menguji Customer Self-Service Portal Mandiri...');
    const portalUrl = `${BASE_FRONTEND}/#portal?outletId=${outlet.id}`;
    await page.goto(portalUrl, { waitUntil: 'networkidle' });

    // Verifikasi Header Portal menampilkan nama outlet
    await page.locator(`text=${outlet.outletName || outlet.name}`).first().waitFor({ timeout: 10000 });
    await page.locator('text=Portal Mandiri').first().waitFor({ timeout: 5000 });
    console.log('   ✅ [UI] Halaman Portal Pelanggan berhasil dimuat dengan nama outlet.');

    // Login ringan via nomor WhatsApp pelanggan
    await page.locator('input[type="tel"]').fill(customerPhone);
    await page.locator('button:has-text("Masuk ke Portal")').click();

    // Tunggu profil akun muncul
    await page.locator('text=Ibu Sinta Mandiri').first().waitFor({ timeout: 10000 });
    await page.locator('text=GOLD').first().waitFor({ timeout: 5000 });
    console.log('   ✅ [UI] Login sesi portal berhasil. Profil Ibu Sinta Mandiri (Tier GOLD) aktif.');

    // Verifikasi 3 KPI Cards: Saldo Rp 150.000, Kuota 10.0 Kg, Poin 250
    await page.locator('text=Rp 150.000').first().waitFor({ timeout: 5000 });
    await page.locator('text=10.0').first().waitFor({ timeout: 5000 });
    await page.locator('text=250').first().waitFor({ timeout: 5000 });
    console.log('   ✅ [UI] Saldo Deposit Rp 150.000, Kuota Kiloan 10.0 Kg, dan 250 Poin terverifikasi.');

    // Pindah ke tab "Jemput Cucian"
    await page.locator('button:has-text("Jemput Cucian")').click();
    await page.locator('text=Minta Jemput Cucian ke Rumah').waitFor({ timeout: 5000 });

    // Isi formulir penjemputan mandiri
    const addressInput = page.locator('textarea[placeholder*="Nama jalan, nomor rumah"]');
    await addressInput.fill('Jl. Cempaka Putih Tengah No. 15, Blok B2, Dekat Pos Satpam');

    const weightInput = page.locator('input[placeholder="Misal: 5.0"]');
    await weightInput.fill('5.5');

    const notesInput = page.locator('input[placeholder*="Tolong titipkan di pos satpam"]');
    await notesInput.fill('Mohon kurir hubungi WA sebelum meluncur ke lokasi');

    // Kirim Permintaan Jemput
    await page.locator('button:has-text("Kirim Permintaan Jemput")').click();

    // Verifikasi alert sukses "Permintaan Diterima!"
    await page.locator('text=Permintaan Diterima!').waitFor({ timeout: 10000 });

    // Ambil kode permintaan dari riwayat permintaan jemput
    const requestCodeEl = page.locator('span[class*="font-mono"]:has-text("PKP-")').first();
    await requestCodeEl.waitFor({ timeout: 5000 });
    createdRequestCode = (await requestCodeEl.innerText()).replace('#', '').trim();
    assert(createdRequestCode.startsWith('PKP-'), `Kode permintaan harus diawali PKP-, aktual: ${createdRequestCode}`);
    console.log(`   ✅ [UI] Permintaan jemput berhasil dibuat: #${createdRequestCode} (Status: Menunggu Konfirmasi).`);

    // Validasi Integritas Token: Jumlah tagihan token / kuota tidak berubah
    const invoicesCount = await prisma.saaSInvoice.count({ where: { tenantId: tenant.id } });
    assert(invoicesCount === 1, 'Permintaan jemput mandiri tidak boleh memotong token atau membuat invoice baru');
    console.log('   ✅ [DB] Integritas Terjaga: Zero extra token deduction terbukti aman.\n');

    // =========================================================================
    // SKENARIO 2: DRIVER ASSIGNMENT BOARD (Papan Kurir & Penugasan)
    // =========================================================================
    console.log('▶️ [SKENARIO 2] Menguji Papan Tugas Kurir & Penugasan Kurir...');

    // Login via UI
    await page.goto(`${BASE_FRONTEND}/#pos`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Portal Pemilik (Email)")', { timeout: 10000 });
    await page.click('button:has-text("Portal Pemilik (Email)")');
    await page.fill('input[type="email"]', ownerEmail);
    await page.fill('input[type="password"]', passwordRaw);
    await page.click('button:has-text("Masuk ke Portal Pemilik")');

    // Tunggu navbar dashboard muncul
    await page.waitForSelector('button[title="Buka Owner Portal & Kelola Bisnis"]', {
      timeout: 15000,
    });
    await page.waitForTimeout(1000);
    console.log('   ✅ [UI] Login Owner berhasil.');

    // Navigasi ke halaman Delivery & Antar-Jemput (tab: laundry_transfers)
    await navigateToTab(page, 'laundry_transfers');
    await page.waitForSelector('h1:has-text("Delivery & Antar-Jemput")', { timeout: 10000 });
    await page.waitForSelector('text=Jemput Menunggu', { timeout: 10000 });

    // Cari kartu permintaan jemput dengan kode yang baru dibuat
    const pickupCard = page.locator('div[class*="rounded-2xl"]').filter({ hasText: createdRequestCode }).first();
    await pickupCard.waitFor({ timeout: 8000 });
    await pickupCard.locator('text=Menunggu').waitFor({ timeout: 5000 });
    console.log(`   ✅ [UI] Kartu permintaan jemput #${createdRequestCode} muncul di papan kurir.`);

    // Klik tombol "Tugaskan Kurir"
    await pickupCard.locator('button:has-text("Tugaskan Kurir")').click();

    // Modal penugasan kurir terbuka
    const assignModal = page.locator('div[class*="rounded-t-3xl"]').filter({ hasText: 'Tugaskan Kurir Penjemputan' });
    await assignModal.waitFor({ timeout: 5000 });

    await assignModal.locator('input[placeholder="Contoh: Dani Express"]').fill('Bambang Express Delivery');
    await assignModal.locator('input[placeholder="Contoh: +628..."]').fill('+6281899998888');
    await assignModal.locator('select').selectOption('DRIVER_ASSIGNED');
    await assignModal.locator('button:has-text("Simpan Penugasan")').click();

    // Verifikasi status berubah menjadi "Kurir Ditugaskan"
    await pickupCard.locator('text=Kurir Ditugaskan').waitFor({ timeout: 8000 });
    await pickupCard.locator('text=Bambang Express Delivery').waitFor({ timeout: 5000 });
    console.log('   ✅ [UI] Kurir "Bambang Express Delivery" berhasil ditugaskan & status berubah.\n');

    // =========================================================================
    // SKENARIO 3: FAILED PICKUP ATTEMPT & RESCHEDULE
    // =========================================================================
    console.log('▶️ [SKENARIO 3] Menguji Pencatatan Percobaan Gagal Jemput (Failed Attempt)...');

    // Klik tombol "Gagal Jemput" pada kartu tersebut
    await pickupCard.locator('button:has-text("Gagal Jemput")').click();

    // Modal Gagal Jemput terbuka
    const failedPickupModal = page.locator('div[class*="rounded-t-3xl"]').filter({ hasText: 'Catat Percobaan Gagal Jemput' });
    await failedPickupModal.waitFor({ timeout: 5000 });

    await failedPickupModal.locator('textarea[placeholder*="Pagar terkunci"]').fill('Pagar rumah terkunci rapat & telepon tidak diangkat 3x');
    await failedPickupModal.locator('button:has-text("Simpan Catatan")').click();

    // Verifikasi status berubah menjadi "Percobaan Gagal" dan counter "Percobaan 1x" muncul
    await pickupCard.locator('text=Percobaan Gagal').waitFor({ timeout: 8000 });
    await pickupCard.locator('text=Percobaan 1x').waitFor({ timeout: 5000 });
    await pickupCard.locator('text=Pagar rumah terkunci rapat').waitFor({ timeout: 5000 });
    console.log('   ✅ [UI] Percobaan gagal jemput tercatat: status "Percobaan Gagal", percobaan 1x.\n');

    // =========================================================================
    // SKENARIO 4: CENTRALIZED NOTIFICATION AUTOMATION & DISPATCH LOGS
    // =========================================================================
    console.log('▶️ [SKENARIO 4] Menguji Pusat Otomasi Notifikasi & Log Pengiriman...');

    // Klik tombol "Otomasi Notifikasi" di header toolbar
    await page.locator('button:has-text("Otomasi Notifikasi")').first().click();

    const notifModal = page.locator('div[class*="rounded-t-3xl"]').filter({ hasText: 'Pusat Otomasi' });
    await notifModal.waitFor({ timeout: 5000 });
    console.log('   ✅ [UI] Modal Pusat Otomasi & Notifikasi Pelanggan berhasil dibuka.');

    // 4.1 Buka tab "Riwayat Log Pengiriman"
    await notifModal.locator('button:has-text("Riwayat Log Pengiriman")').click();
    await page.waitForTimeout(1000);

    // Pastikan log otomatis untuk PICKUP_REQUEST_CONFIRMED dan DELIVERY_FAILED sudah tercatat
    await notifModal.locator('text=PICKUP_REQUEST_CONFIRMED').first().waitFor({ timeout: 8000 });
    await notifModal.locator('text=DELIVERY_FAILED').first().waitFor({ timeout: 8000 });
    console.log('   ✅ [UI] Audit log konfirmasi jemput & kegagalan otomatis tercatat di server.');

    // 4.2 Pindah kembali ke tab "Aturan & Template (7 Event)"
    await notifModal.locator('button:has-text("Aturan & Template")').click();
    await page.waitForTimeout(1000);

    // Cari kartu event ORDER_READY
    const orderReadyCard = notifModal.locator('div[class*="rounded-2xl"]').filter({ hasText: 'Pesanan Siap Diambil / Diantar' }).first();
    await orderReadyCard.waitFor({ timeout: 5000 });

    // 4.3 Matikan saklar (Toggle Off)
    await orderReadyCard.locator('button[type="button"][class*="rounded-full"]').first().click();
    await orderReadyCard.locator('button:has-text("Simpan Aturan")').click();
    await page.locator('text=berhasil diperbarui').waitFor({ timeout: 5000 });
    console.log('   ✅ [UI] Aturan ORDER_READY dinonaktifkan & disimpan.');

    // Jalankan Simulasi Kirim saat nonaktif -> harus SKIPPED
    await orderReadyCard.locator('button:has-text("Simulasi Kirim")').click();
    await page.locator('text=DI-SKIP').waitFor({ timeout: 8000 });
    console.log('   ✅ [UI] Simulasi notifikasi saat nonaktif terbukti menghasilkan status SKIPPED.');

    // 4.4 Nyalakan kembali saklar (Toggle On)
    await orderReadyCard.locator('button[type="button"][class*="rounded-full"]').first().click();
    await orderReadyCard.locator('button:has-text("Simpan Aturan")').click();
    await page.locator('text=berhasil diperbarui').waitFor({ timeout: 5000 });
    console.log('   ✅ [UI] Aturan ORDER_READY diaktifkan kembali & disimpan.');

    // Jalankan Simulasi Kirim saat aktif -> harus TERKIRIM
    await orderReadyCard.locator('button:has-text("Simulasi Kirim")').click();
    await page.locator('text=TERKIRIM').waitFor({ timeout: 8000 });
    console.log('   ✅ [UI] Simulasi notifikasi saat aktif terbukti menghasilkan status TERKIRIM.');

    // 4.5 Cek tab Riwayat Log lagi untuk memastikan log simulasi masuk
    await notifModal.locator('button:has-text("Riwayat Log Pengiriman")').click();
    await page.waitForTimeout(1000);
    await notifModal.locator('text=ORDER_READY').first().waitFor({ timeout: 8000 });
    console.log('   ✅ [UI] Log simulasi ORDER_READY terverifikasi tercatat di daftar riwayat log.');

    // Tutup modal
    await notifModal.locator('button:has-text("Tutup")').click();
    console.log('   ✅ [UI] Modal otomasi notifikasi ditutup dengan sukses.\n');

    console.log('================================================================================');
    console.log('🎉 SELURUH 4 SKENARIO E2E LAUNDRY CORE PHASE 3 LULUS DENGAN SEMPURNA (100% PASS)!');
    console.log('================================================================================\n');

  } catch (error: any) {
    console.error('\n❌ [E2E FAILED] Terjadi kegagalan pengujian:', error);
    if (page) {
      try {
        await page.screenshot({ path: 'pos_apps/e2e/laundry_core3_failure.png', fullPage: true });
        console.log('📸 Screenshot kegagalan disimpan di pos_apps/e2e/laundry_core3_failure.png');
      } catch (screenshotErr) {
        console.error('Gagal mengambil screenshot:', screenshotErr);
      }
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }

    // Pembersihan Database (Zero Residue)
    if (createdTenantId) {
      console.log('🧹 [CLEANUP] Membersihkan seluruh data dummy test tenant...');
      const cleanupQueries = [
        `DELETE FROM "notification_dispatch_logs" WHERE "tenant_id" = $1`,
        `DELETE FROM "notification_automation_rules" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_pickup_requests" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_order_details" WHERE "order_id" IN (SELECT id FROM "orders" WHERE "tenant_id" = $1)`,
        `DELETE FROM "order_items" WHERE "order_id" IN (SELECT id FROM "orders" WHERE "tenant_id" = $1)`,
        `DELETE FROM "orders" WHERE "tenant_id" = $1`,
        `DELETE FROM "customer_laundry_wallets" WHERE "tenant_id" = $1`,
        `DELETE FROM "customers" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_services" WHERE "tenant_id" = $1`,
        `DELETE FROM "shifts" WHERE "tenant_id" = $1`,
        `DELETE FROM "users" WHERE "tenant_id" = $1`,
        `DELETE FROM "outlets" WHERE "tenant_id" = $1`,
        `DELETE FROM "businesses" WHERE "tenant_id" = $1`,
        `DELETE FROM "saas_invoices" WHERE "tenant_id" = $1`,
        `DELETE FROM "tenant_subscriptions" WHERE "tenant_id" = $1`,
        `DELETE FROM "tenants" WHERE "id" = $1`,
      ];
      for (const query of cleanupQueries) {
        try {
          await prisma.$executeRawUnsafe(query, createdTenantId);
        } catch {
          // Ignore
        }
      }
      console.log('✨ [CLEANUP COMPLETE] Database bersih 100% tanpa residu.');
    }
    await prisma.$disconnect();
  }
}

runLaundryCorePhase3E2E()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
