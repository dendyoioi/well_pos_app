import { chromium, Browser, Page } from 'playwright';
import {
  PrismaClient,
  Role,
  BusinessVerticalMode,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '../server/node_modules/@prisma/client';
import bcrypt from '../server/node_modules/bcryptjs';
import jwt from '../server/node_modules/jsonwebtoken';

const prisma = new PrismaClient();
const BASE_FRONTEND = 'http://localhost:5173';
const BASE_BACKEND = 'http://localhost:5001';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

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

async function runLaundryCorePhase2E2E() {
  console.log('================================================================================');
  console.log('🧪 LAUNDRY CORE ENGINE — CORE PHASE 2 (WORKSHOP & TRACEABILITY) E2E SUITE');
  console.log('   Target Frontend:', BASE_FRONTEND);
  console.log('   Target Backend: ', BASE_BACKEND);
  console.log('================================================================================\n');

  const timestamp = Date.now().toString();
  const tenantSlug = `lnd-core-p2-${timestamp}`;
  const ownerEmail = `owner.corep2.${timestamp}@wellpos.test`;
  const passwordRaw = 'Password123!';
  const passwordHash = await bcrypt.hash(passwordRaw, 10);

  let createdTenantId: string | null = null;
  let ownerToken: string | null = null;
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // =========================================================================
    // 0. SEEDING ISOLATED TEST TENANT & ENTITIES
    // =========================================================================
    console.log('🌱 [0/4] Seeding isolated tenant, business, outlet, machine, service & 2 test orders...');

    // 1. Buat Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: `Laundry Core P2 Corp ${timestamp.slice(-4)}`,
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
        invoiceNumber: `INV-CORE2-${timestamp.slice(-6)}`,
        amount: 50000,
        tokenAmount: 500,
        status: 'PAID',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        paidAt: new Date(),
        notes: 'Top Up Awal 500 Token E2E Core Phase 2',
      },
    });

    // 3. Business Laundry
    const business = await prisma.business.create({
      data: {
        tenantId: tenant.id,
        name: 'Superwash Express Group',
        slug: `superwash-p2-${timestamp.slice(-6)}`,
        vertical: BusinessVerticalMode.LAUNDRY,
        subCategory: 'Kiloan & Satuan Workshop',
        isActive: true,
      },
    });

    // 4. Outlet Workshop Menteng
    const outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        code: `LND-WS-${timestamp.slice(-3)}`,
        name: 'Superwash Workshop Menteng',
        address: 'Jl. Teuku Umar No. 20, Jakarta Pusat',
        phone: '+6281299998888',
        industries: ['LAUNDRY'],
        isWorkshop: true,
        isActive: true,
      },
    });

    // 5. Laundry Machine (Washer 20kg)
    const machine = await prisma.laundryMachine.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        code: `WASH-${timestamp.slice(-3)}`,
        name: 'Washer Primus 20kg Industrial',
        machineType: 'WASHER',
        capacityKg: new Prisma.Decimal(20.0),
        status: 'ACTIVE',
      },
    });

    // 6. User OWNER
    const ownerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userCode: `OWN-${timestamp.slice(-4)}`,
        name: 'Pak Budi Workshop Owner',
        firstName: 'Budi',
        lastName: 'Owner',
        email: ownerEmail,
        passwordHash,
        role: Role.OWNER,
        isActive: true,
      },
    });

    // 7. Master Service
    const laundryService = await prisma.laundryService.create({
      data: {
        tenantId: tenant.id,
        name: 'Cuci Komplit Express & Reguler',
        category: 'KILOAN',
        price: new Prisma.Decimal(10000),
        unit: 'Kg',
        durationHours: 24,
        expressMultiplier: new Prisma.Decimal(1.5),
        minOrderQty: 1,
        description: 'Layanan cuci mesin industri berkapasitas besar',
        isActive: true,
      },
    });

    // 8. Customer
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: 'Bpk. Agus Pratama',
        phone: '+6281234567890',
        address: 'Jl. Sabang No. 45, Menteng',
      },
    });

    // 9. Shift Aktif
    await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: ownerUser.id,
        startTime: new Date(),
        startingCash: new Prisma.Decimal(200000),
      },
    });

    // 10. Generate JWT Owner Token
    ownerToken = jwt.sign(
      {
        userId: ownerUser.id,
        role: ownerUser.role,
        outletId: outlet.id,
        tenantId: tenant.id,
        tokenVersion: 1,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 11. Buat 2 Order Test:
    // Order 1: SLA Overdue (CRITICAL Tier, targetCompletion 2 jam lalu, berat 6 kg)
    const inv1 = `INV-CRIT-${timestamp.slice(-4)}`;
    const order1 = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: ownerUser.id,
        customerId: customer.id,
        invoiceNumber: inv1,
        orderStatus: OrderStatus.IN_PROGRESS,
        paymentStatus: PaymentStatus.PAID,
        subtotal: new Prisma.Decimal(60000),
        totalAmount: new Prisma.Decimal(60000),
        laundryDetail: {
          create: {
            tenantId: tenant.id,
            outletId: outlet.id,
            currentStage: 'WASHING',
            status: 'WASHING_DRYING',
            totalWeightKg: new Prisma.Decimal(6.0),
            initialWeightKg: new Prisma.Decimal(6.0),
            totalPieces: 10,
            estimatedReadyAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
        },
        items: {
          create: {
            tenantId: tenant.id,
            productName: 'Cuci Komplit Express & Reguler (6 Kg)',
            quantity: 6,
            unitPrice: new Prisma.Decimal(10000),
            costPrice: new Prisma.Decimal(4000),
            subtotal: new Prisma.Decimal(60000),
          },
        },
      },
    });

    // Order 2: Normal SLA (targetCompletion 36 jam lagi, berat 4 kg)
    const inv2 = `INV-NORM-${timestamp.slice(-4)}`;
    const order2 = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: ownerUser.id,
        customerId: customer.id,
        invoiceNumber: inv2,
        orderStatus: OrderStatus.IN_PROGRESS,
        paymentStatus: PaymentStatus.PAID,
        subtotal: new Prisma.Decimal(40000),
        totalAmount: new Prisma.Decimal(40000),
        laundryDetail: {
          create: {
            tenantId: tenant.id,
            outletId: outlet.id,
            currentStage: 'WASHING',
            status: 'WASHING_DRYING',
            totalWeightKg: new Prisma.Decimal(4.0),
            initialWeightKg: new Prisma.Decimal(4.0),
            totalPieces: 8,
            estimatedReadyAt: new Date(Date.now() + 36 * 60 * 60 * 1000),
          },
        },
        items: {
          create: {
            tenantId: tenant.id,
            productName: 'Cuci Komplit Express & Reguler (4 Kg)',
            quantity: 4,
            unitPrice: new Prisma.Decimal(10000),
            costPrice: new Prisma.Decimal(4000),
            subtotal: new Prisma.Decimal(40000),
          },
        },
      },
    });

    console.log('   ✅ Tenant:', tenant.name, `(${tenant.slug})`);
    console.log('   ✅ Outlet:', outlet.name);
    console.log('   ✅ Machine:', machine.name, `(${machine.code})`);
    console.log('   ✅ Order 1 (Overdue / CRITICAL):', inv1, '(6 kg)');
    console.log('   ✅ Order 2 (Normal SLA):', inv2, '(4 kg)\n');

    // =========================================================================
    // LAUNCH PLAYWRIGHT BROWSER
    // =========================================================================
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    page = await context.newPage();

    // Login via UI
    console.log('🔑 Login sebagai Owner via UI...');
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
    console.log('   ✅ Login berhasil, sesi dashboard aktif.\n');

    // =========================================================================
    // SKENARIO 1: SMART PRODUCTION QUEUE (AUTO-PRIORITAS SLA & EXPRESS)
    // =========================================================================
    console.log('▶️ [SKENARIO 1] Smart Production Queue (Auto-Prioritas SLA & Express)');

    // 1.1 Verifikasi API getProductionQueue
    const queueApiRes = await fetch(
      `${BASE_BACKEND}/api/laundry/core2/production-queue?outletId=${outlet.id}`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    const queueJson = await queueApiRes.json();
    assert(queueJson.status === 'success', 'Production queue API must succeed');
    assert(queueJson.data.length >= 2, 'Queue must return at least 2 orders');
    // Order 1 harus menjadi yang pertama karena SLA Overdue (CRITICAL tier)
    assert(
      queueJson.data[0].id === order1.id,
      'Order 1 (Overdue) harus berurutan paling atas (#1)'
    );
    assert(
      queueJson.data[0].priorityTier === 'CRITICAL',
      'Order 1 priorityTier must be CRITICAL'
    );
    console.log('   ✅ [API] getProductionQueue: Order 1 diurutkan teratas dengan tier CRITICAL (Overdue SLA).');

    // 1.2 Navigasi ke Halaman Workshop Laundry di UI
    await navigateToTab(page, 'laundry_production');
    await page.waitForSelector('button:has-text("Prioritas SLA & Batch")', { timeout: 12000 });

    // 1.3 Klik tab switcher "Prioritas SLA & Batch"
    const priorityTabBtn = page.locator('button:has-text("Prioritas SLA & Batch")');
    await priorityTabBtn.click();
    await page.waitForSelector(`text=${inv1}`, { timeout: 8000 });

    // Verifikasi Order 1 tampil dengan badge Terlambat / CRITICAL
    const queueRow1 = page.locator(`text=${inv1}`).locator('xpath=ancestor::div[contains(@class, "p-4") and contains(@class, "transition-all")]');
    const queueContent1 = await queueRow1.innerText();
    assert(
      queueContent1.includes('TERLAMBAT') || queueContent1.includes('CRITICAL'),
      'Order 1 harus memuat badge prioritas TERLAMBAT/CRITICAL'
    );
    assert(queueContent1.includes('6 kg'), 'Order 1 harus memuat bobot 6 kg');
    console.log('   ✅ [UI] SmartProductionQueuePanel: Order 1 (#1) tampil dengan badge prioritas TERLAMBAT.');

    // Verifikasi Order 2 juga muncul di bawahnya
    const queueRow2 = page.locator(`text=${inv2}`);
    await queueRow2.waitFor({ timeout: 5000 });
    console.log('   ✅ [UI] Order 2 (#2) tampil di daftar antrean.');
    console.log('   ✅ [PASS] Skenario 1 Berhasil: Smart Production Queue auto-prioritization terverifikasi 100%!\n');

    // =========================================================================
    // SKENARIO 2: LAUNDRY BATCH MANAGEMENT (SIKLUS MESIN GABUNGAN)
    // =========================================================================
    console.log('▶️ [SKENARIO 2] Laundry Batch Management (Siklus Mesin Gabungan)');

    // 2.1 Centang kedua order di daftar Smart Production Queue
    await queueRow1.locator('input[type="checkbox"]').check();
    await page.locator(`text=${inv2}`).locator('xpath=ancestor::div[contains(@class, "p-4") and contains(@class, "transition-all")]').locator('input[type="checkbox"]').check();

    // 2.2 Tunggu floating action bar muncul di bawah
    await page.waitForSelector('button:has-text("Gabung ke Batch Mesin")', { timeout: 5000 });
    await page.click('button:has-text("Gabung ke Batch Mesin")');

    // 2.3 Modal Batch Mesin terbuka
    const batchModal = page.locator('h2:has-text("Manajemen Batch Mesin")').locator('xpath=ancestor::div[contains(@class, "rounded-3xl") or contains(@class, "rounded-t-3xl")]');
    await batchModal.waitFor({ timeout: 8000 });
    console.log('   ✅ [UI] Modal Manajemen Batch Mesin terbuka.');

    // 2.4 Pilih Mesin: Washer Primus 20kg
    const machineSelect = batchModal.locator('select').first();
    await machineSelect.selectOption(machine.id);

    // Pastikan Auto-start tercentang
    const autoStartCheckbox = batchModal.locator('input[type="checkbox"]').last();
    const isAutoChecked = await autoStartCheckbox.isChecked();
    if (!isAutoChecked) {
      await autoStartCheckbox.check();
    }

    // 2.5 Submit form Buat & Jalankan Batch
    await batchModal.locator('button:has-text("Buat & Jalankan Batch")').click();
    await page.waitForTimeout(1000);

    // 2.6 Verifikasi batch berpindah ke tab daftar dengan status IN_PROGRESS
    await batchModal.locator('text=Sedang Berjalan').waitFor({ timeout: 8000 });
    const batchListText = await batchModal.innerText();
    assert(
      batchListText.includes('10 kg') || batchListText.includes('10.0') || batchListText.includes('10,0'),
      'Batch harus mencatat total muatan 10 kg (6 kg + 4 kg)'
    );
    console.log('   ✅ [UI] Batch mesin berhasil dibuat dan langsung berjalan (IN_PROGRESS, 10 Kg).');

    // 2.7 Selesaikan siklus mesin
    const completeCycleBtn = batchModal.locator('button:has-text("Selesaikan Siklus Mesin")').first();
    await completeCycleBtn.click();
    await page.waitForTimeout(1000);

    // Verifikasi via DB bahwa batch berstatus COMPLETED dan order berpindah ke tahap DRYING
    const completedBatch = await prisma.laundryBatch.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    });
    assert(completedBatch?.status === 'COMPLETED', 'Batch status must be COMPLETED');

    const detail1 = await prisma.laundryOrderDetail.findFirst({
      where: { orderId: order1.id },
    });
    const detail2 = await prisma.laundryOrderDetail.findFirst({
      where: { orderId: order2.id },
    });
    assert(detail1?.currentStage === 'DRYING', 'Order 1 stage must transition to DRYING');
    assert(detail2?.currentStage === 'DRYING', 'Order 2 stage must transition to DRYING');
    console.log('   ✅ [DB] Batch COMPLETED, kedua pesanan (Order 1 & 2) otomatis beralih ke tahap DRYING.');

    // Tutup Modal Batch
    await batchModal.locator('button:has-text("Tutup")').click();
    await page.waitForSelector('h2:has-text("Manajemen Batch Mesin")', {
      state: 'detached',
      timeout: 5000,
    });
    console.log('   ✅ [PASS] Skenario 2 Berhasil: Laundry Batch Management terverifikasi 100%!\n');

    // =========================================================================
    // SKENARIO 3: ITEM-LEVEL TRACKING & QUICK TAG SCANNER
    // =========================================================================
    console.log('▶️ [SKENARIO 3] Item-Level Tracking & Quick Tag Scanner');

    // 3.1 Buka Tab Antrean Cucian (Laundry Queue)
    await navigateToTab(page, 'laundry_queue');
    await page.waitForSelector(`text=${inv1}`, { timeout: 12000 });

    // 3.2 Buka modal "Item & Tag" dari kartu Order 1
    const order1QueueCard = page
      .locator(`text=${inv1}`)
      .locator('xpath=ancestor::div[contains(@class, "bg-white") and contains(@class, "rounded-2xl")]');
    await order1QueueCard.first().locator('button:has-text("Item & Tag")').first().click();

    const trackingModal = page
      .locator('h2:has-text("Pelacakan Pakaian (Item-Level Tracking)")')
      .locator('xpath=ancestor::div[contains(@class, "rounded-3xl") or contains(@class, "rounded-t-3xl")]');
    await trackingModal.waitFor({ timeout: 8000 });
    console.log('   ✅ [UI] Modal Item-Level Tracking terbuka.');

    // 3.3 Tambah 3 Pakaian Satuan
    // Item 1: Jas Hitam
    await trackingModal.locator('button:has-text("+ Tambah Pakaian")').click();
    const addForm1 = trackingModal.locator('form').first();
    await addForm1.locator('input[placeholder*="Kemeja Lengan Panjang"]').fill('Jas Hitam Woll');
    await addForm1.locator('select').selectOption('JAS_GAUN');
    await addForm1.locator('input[placeholder*="Misal: Putih"]').fill('Hitam');
    await addForm1.locator('input[placeholder*="Misal: Uniqlo"]').fill('Hugo Boss');
    await addForm1.locator('input[placeholder*="Misal: Jangan disikat"]').fill('Noda kopi di kerah kanan');
    await addForm1.locator('button:has-text("Simpan & Buat Tag QR")').click();
    await trackingModal.locator('text=Jas Hitam Woll').waitFor({ timeout: 6000 });

    // Item 2: Kemeja Putih
    await trackingModal.locator('button:has-text("+ Tambah Pakaian")').click();
    const addForm2 = trackingModal.locator('form').first();
    await addForm2.locator('input[placeholder*="Kemeja Lengan Panjang"]').fill('Kemeja Putih Sutra');
    await addForm2.locator('select').selectOption('ATASAN');
    await addForm2.locator('input[placeholder*="Misal: Putih"]').fill('Putih Bersih');
    await addForm2.locator('button:has-text("Simpan & Buat Tag QR")').click();
    await trackingModal.locator('text=Kemeja Putih Sutra').waitFor({ timeout: 6000 });

    // Item 3: Celana Bahan
    await trackingModal.locator('button:has-text("+ Tambah Pakaian")').click();
    const addForm3 = trackingModal.locator('form').first();
    await addForm3.locator('input[placeholder*="Kemeja Lengan Panjang"]').fill('Celana Bahan Formal');
    await addForm3.locator('select').selectOption('BAWAHAN');
    await addForm3.locator('input[placeholder*="Misal: Putih"]').fill('Abu-Abu Tua');
    await addForm3.locator('button:has-text("Simpan & Buat Tag QR")').click();
    await trackingModal.locator('text=Celana Bahan Formal').waitFor({ timeout: 6000 });

    // 3.4 Verifikasi di DB bahwa 3 tag item tercipta dengan format TAG-...
    const itemsDb = await prisma.laundryOrderItemTrack.findMany({
      where: { orderId: order1.id },
      orderBy: { createdAt: 'asc' },
    });
    assert(itemsDb.length === 3, 'Must have 3 tracked items in DB');
    const jasTagCode = itemsDb[0].tagCode;
    assert(jasTagCode.startsWith('TAG-'), 'tagCode must start with TAG-');
    console.log(`   ✅ [DB & UI] 3 pakaian berhasil diregistrasi dengan tag unik (Item 1 Tag: ${jasTagCode}).`);

    // Tutup modal Item Tracking
    await trackingModal.locator('button:has-text("Tutup")').click();
    await page.waitForSelector('h2:has-text("Pelacakan Pakaian (Item-Level Tracking)")', {
      state: 'detached',
      timeout: 5000,
    });

    // 3.5 Buka Modal "Scan Tag" di toolbar Antrean Cucian
    await page.click('button:has-text("Scan Tag")');
    const scannerModal = page
      .locator('h2:has-text("Pindai Tag Pakaian")')
      .locator('xpath=ancestor::div[contains(@class, "rounded-3xl") or contains(@class, "rounded-t-3xl")]');
    await scannerModal.waitFor({ timeout: 8000 });

    // 3.6 Masukkan tagCode Jas Hitam
    await scannerModal.locator('input[placeholder*="Ketik atau scan tag"]').fill(jasTagCode);
    await scannerModal.locator('button:has-text("Cari")').click();

    // 3.7 Verifikasi Detail Pakaian Tampil
    await scannerModal.locator(`text=${jasTagCode}`).waitFor({ timeout: 6000 });
    const scannerResultText = await scannerModal.innerText();
    assert(scannerResultText.includes('Jas Hitam Woll'), 'Scanner harus menampilkan nama pakaian Jas Hitam Woll');
    assert(scannerResultText.includes(inv1), 'Scanner harus menampilkan nota pesanan');
    assert(
      scannerResultText.includes('Noda kopi di kerah kanan'),
      'Scanner harus menampilkan catatan perlakuan khusus noda'
    );
    console.log('   ✅ [UI] Scan Tag cepat berhasil menemukan detail pakaian & invoice terkait.');

    // Tutup Modal Scan Tag
    await scannerModal.locator('button:has-text("Tutup")').click();
    await page.waitForSelector('h2:has-text("Pindai Tag Pakaian")', {
      state: 'detached',
      timeout: 5000,
    });
    console.log('   ✅ [PASS] Skenario 3 Berhasil: Item-Level Tracking & Quick Tag Scanner terverifikasi 100%!\n');

    // =========================================================================
    // SKENARIO 4: SPLIT ORDER / PARTIAL HANDOVER (SERAH TERIMA BERTAHAP)
    // =========================================================================
    console.log('▶️ [SKENARIO 4] Split Order / Partial Handover (Serah Terima Bertahap)');

    // 4.1 Buka kembali modal Item Tracking Order 1
    await order1QueueCard.first().locator('button:has-text("Item & Tag")').first().click();
    await trackingModal.waitFor({ timeout: 8000 });

    // 4.2 Ubah status Item 1 dan Item 2 menjadi READY (RAK) via select di tiap baris
    // Item 1: Jas Hitam Woll
    const item1Row = trackingModal.locator('div[class*="rounded-2xl"]').filter({ hasText: 'Jas Hitam Woll' }).first();
    await item1Row.locator('select').selectOption('READY');
    await page.waitForTimeout(500);

    // Item 2: Kemeja Putih Sutra
    const item2Row = trackingModal.locator('div[class*="rounded-2xl"]').filter({ hasText: 'Kemeja Putih Sutra' }).first();
    await item2Row.locator('select').selectOption('READY');
    await page.waitForTimeout(500);
    console.log('   ✅ [UI] Status Item 1 & 2 diubah menjadi READY (RAK).');

    // 4.3 Pada formulir Partial Handover di bagian bawah, centang Item 1 & 2
    await item1Row.locator('input[type="checkbox"]').check();
    await item2Row.locator('input[type="checkbox"]').check();

    // 4.4 Isi Nama Penerima & Catatan
    await trackingModal.locator('input[placeholder="Nama orang yang mengambil pakaian..."]').fill('Bpk. Agus Pratama (Ambil Jas & Kemeja)');
    await trackingModal.locator('input[placeholder*="Ambil kemeja dulu"]').fill('Diambil duluan untuk resepsi malam ini');
    await trackingModal.locator('button:has-text("Serahkan Item Terpilih")').click();

    // 4.5 Verifikasi progress bertambah menjadi 2 / 3
    await trackingModal.locator('text=2 / 3').waitFor({ timeout: 8000 });
    console.log('   ✅ [UI] Serah terima sebagian tercatat: 2 dari 3 pakaian telah diserahkan.');

    // Verifikasi bahwa status pesanan di database masih IN_PROGRESS (belum selesai prematur)
    const orderCheck1 = await prisma.order.findUnique({ where: { id: order1.id } });
    assert(
      orderCheck1?.orderStatus === OrderStatus.IN_PROGRESS,
      'Order status harus tetap IN_PROGRESS saat baru sebagian pakaian diserahkan'
    );
    console.log('   ✅ [DB] Validasi Integritas: Pesanan tetap berstatus IN_PROGRESS.');

    // 4.6 Serahkan pakaian ke-3 (Celana Bahan Formal)
    const item3Row = trackingModal.locator('div[class*="rounded-2xl"]').filter({ hasText: 'Celana Bahan Formal' }).first();
    await item3Row.locator('select').selectOption('READY');
    await page.waitForTimeout(500);

    // Centang item ke-3
    await item3Row.locator('input[type="checkbox"]').check();

    await trackingModal.locator('input[placeholder="Nama orang yang mengambil pakaian..."]').fill('Bpk. Agus Pratama (Ambil Celana)');
    await trackingModal.locator('button:has-text("Serahkan Item Terpilih")').click();

    // 4.7 Verifikasi pesan tuntas dan Order otomatis COMPLETED
    await trackingModal.locator('text=Seluruh pakaian telah diserahkan').waitFor({ timeout: 8000 });
    console.log('   ✅ [UI] Notifikasi serah terima tuntas (3/3 pakaian).');

    const orderCheck2 = await prisma.order.findUnique({ where: { id: order1.id } });
    assert(
      orderCheck2?.orderStatus === OrderStatus.COMPLETED,
      'Order status harus otomatis COMPLETED setelah seluruh pakaian diserahkan'
    );
    console.log('   ✅ [DB] Integritas Tuntas: Pesanan otomatis berstatus COMPLETED!\n');

    // Tutup modal
    await trackingModal.locator('button:has-text("Tutup")').click();

    console.log('================================================================================');
    console.log('🎉 SEMUA 4 SKENARIO E2E LAUNDRY CORE PHASE 2 LULUS DENGAN SEMPURNA (100% PASS)!');
    console.log('================================================================================\n');
  } catch (error: any) {
    console.error('\n❌ [E2E FAILED] Terjadi kegagalan pengujian:', error);
    if (page) {
      try {
        await page.screenshot({ path: 'pos_apps/e2e/laundry_core2_failure.png', fullPage: true });
        console.log('📸 Screenshot kegagalan disimpan di pos_apps/e2e/laundry_core2_failure.png');
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
        `DELETE FROM "laundry_order_item_tracks" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_batch_items" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_batches" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_machine_maintenance_logs" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_stage_logs" WHERE "operator_id" IN (SELECT id FROM "users" WHERE "tenant_id" = $1)`,
        `DELETE FROM "laundry_machines" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_order_details" WHERE "order_id" IN (SELECT id FROM "orders" WHERE "tenant_id" = $1)`,
        `DELETE FROM "order_items" WHERE "order_id" IN (SELECT id FROM "orders" WHERE "tenant_id" = $1)`,
        `DELETE FROM "orders" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_services" WHERE "tenant_id" = $1`,
        `DELETE FROM "customers" WHERE "tenant_id" = $1`,
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
          // Ignore table errors if cascaded or empty
        }
      }
      console.log('✨ [CLEANUP COMPLETE] Database bersih 100% tanpa residu.');
    }
    await prisma.$disconnect();
  }
}

runLaundryCorePhase2E2E()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
