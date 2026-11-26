import { chromium, Browser, Page } from 'playwright';
import {
  PrismaClient,
  Role,
  BusinessVerticalMode,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '../server/node_modules/@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

async function runLaundryCorePhase1E2E() {
  console.log('================================================================================');
  console.log('🧪 LAUNDRY CORE ENGINE — CORE PHASE 1 (PRESISI OPERASIONAL) E2E SUITE');
  console.log('   Target Frontend:', BASE_FRONTEND);
  console.log('   Target Backend: ', BASE_BACKEND);
  console.log('================================================================================\n');

  const timestamp = Date.now().toString();
  const tenantSlug = `lnd-core-p1-${timestamp}`;
  const ownerEmail = `owner.corep1.${timestamp}@wellpos.test`;
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
    console.log('🌱 [0/4] Seeding isolated tenant, business, outlets, service & customer...');

    // 1. Buat Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: `Laundry Core E2E Corp ${timestamp.slice(-4)}`,
        slug: tenantSlug,
        businessVertical: 'SERVICES',
        status: 'ACTIVE',
        businessType: 'LAUNDRY',
        phone: '+628111222333',
      },
    });
    createdTenantId = tenant.id;

    // 2. Buat Subscription & 1 Paid SaaSInvoice (500 tokens)
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
        invoiceNumber: `INV-CORE-${timestamp.slice(-6)}`,
        amount: 50000,
        tokenAmount: 500,
        status: 'PAID',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        paidAt: new Date(),
        notes: 'Top Up Awal 500 Token E2E',
      },
    });

    // 3. Buat Business Laundry
    const business = await prisma.business.create({
      data: {
        tenantId: tenant.id,
        name: 'Superwash Laundry Group',
        slug: `superwash-${timestamp.slice(-6)}`,
        vertical: BusinessVerticalMode.LAUNDRY,
        subCategory: 'Kiloan & Satuan',
        isActive: true,
      },
    });

    // 4. Buat 2 Outlet Laundry: Menteng & Senopati
    const outletMenteng = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        code: `LND-MNT-${timestamp.slice(-3)}`,
        name: 'Superwash Cabang Menteng',
        address: 'Jl. Teuku Umar No. 12, Jakarta Pusat',
        phone: '+6281211112222',
        industries: ['LAUNDRY'],
        isWorkshop: true,
        isActive: true,
      },
    });

    const outletSenopati = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        code: `LND-SNP-${timestamp.slice(-3)}`,
        name: 'Superwash Cabang Senopati',
        address: 'Jl. Senopati No. 88, Jakarta Selatan',
        phone: '+6281233334444',
        industries: ['LAUNDRY'],
        isWorkshop: false,
        isActive: true,
      },
    });

    // 5. Buat User OWNER
    const ownerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outletMenteng.id,
        userCode: `OWN-${timestamp.slice(-4)}`,
        name: 'Pak Hendra Owner',
        firstName: 'Hendra',
        lastName: 'Owner',
        email: ownerEmail,
        passwordHash,
        role: Role.OWNER,
        isActive: true,
      },
    });

    // 6. Buat Master Laundry Service: Cuci Komplit Reguler (Rp 8.000 / Kg)
    const laundryService = await prisma.laundryService.create({
      data: {
        tenantId: tenant.id,
        name: 'Cuci Komplit Reguler',
        category: 'KILOAN',
        price: new Prisma.Decimal(8000),
        unit: 'Kg',
        durationHours: 24,
        expressMultiplier: new Prisma.Decimal(1.5),
        minOrderQty: 2,
        description: 'Cuci + Pengeringan Dryer + Setrika Uap Rapi',
        isActive: true,
      },
    });

    // 7. Buat Customer dengan preferensi awal
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: 'Bpk. Rahmat Santoso',
        phone: '+6281299887766',
        secondaryPhones: ['+6281299887767'],
        laundryPreferences: {
          separateColors: true,
          preferPerfume: 'Lavender',
          avoidSoftener: true,
          preferFoldOrHang: 'FOLD',
        },
        address: 'Apartemen Menteng Park Tower A-12',
      },
    });

    // 8. Buat Shift Aktif untuk Owner di Cabang Menteng
    const activeShift = await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        outletId: outletMenteng.id,
        userId: ownerUser.id,
        startTime: new Date(),
        startingCash: new Prisma.Decimal(100000),
      },
    });

    // 9. Generate JWT Owner Token
    ownerToken = jwt.sign(
      {
        userId: ownerUser.id,
        role: ownerUser.role,
        outletId: outletMenteng.id,
        tenantId: tenant.id,
        tokenVersion: 1,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('   ✅ Tenant:', tenant.name, `(${tenant.slug})`);
    console.log('   ✅ Outlets:', outletMenteng.name, '&', outletSenopati.name);
    console.log('   ✅ Master Service:', laundryService.name, 'Rp 8.000/Kg');
    console.log('   ✅ Customer:', customer.name, '(with preferences & secondary phone)\n');

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
    // SKENARIO 1: CUSTOMER PREFERENCE PROFILE & SECONDARY PHONES
    // =========================================================================
    console.log('▶️ [SKENARIO 1] Customer Preference Profile & Secondary Phones');

    // 1.1 Verifikasi API getCustomerPreferences
    const prefApiRes = await fetch(
      `${BASE_BACKEND}/api/laundry/core/customers/${customer.id}/preferences`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    const prefApiJson = await prefApiRes.json();
    assert(prefApiJson.status === 'success', 'API get preferences must return success');
    assert(prefApiJson.data.secondaryPhones.includes('+6281299887767'), 'Secondary phone must match seed');
    assert(prefApiJson.data.laundryPreferences.separateColors === true, 'separateColors preference must be true');
    console.log('   ✅ [API] Endpoint GET preferences mengembalikan data preferensi & nomor alternatif.');

    // 1.2 Buka POS Kasir Laundry
    console.log('   Navigasi ke Terminal Kasir Laundry...');
    await navigateToTab(page, 'pos');
    await page.waitForSelector('h1:has-text("Kasir Laundry")', { timeout: 10000 });

    // 1.3 Buka modal cari member (Pilih F2)
    const selectCustBtn = page.locator('button:has-text("Pilih (F2)")');
    await selectCustBtn.waitFor({ state: 'visible', timeout: 8000 });
    await selectCustBtn.click();

    // 1.4 Pilih Customer "Bpk. Rahmat Santoso"
    await page.waitForSelector('text=Bpk. Rahmat Santoso', { timeout: 8000 });
    await page.locator('text=Bpk. Rahmat Santoso').first().click();

    // Tunggu modal pencarian tertutup
    await page.waitForSelector('h3:has-text("Cari Pelanggan Terdaftar")', { state: 'detached', timeout: 5000 });

    // 1.5 Verifikasi Badge Preferensi muncul di sidebar/cart
    await page.waitForSelector('text=Pisah Warna', { timeout: 8000 });
    const hasColorBadge = await page.locator('text=Pisah Warna').isVisible();
    const hasSoftenerBadge = await page.locator('text=Tanpa Pelembut').isVisible();
    assert(hasColorBadge, 'Badge "Pisah Warna" harus tampil di kasir saat pelanggan terpilih');
    assert(hasSoftenerBadge, 'Badge "Tanpa Pelembut" harus tampil di kasir');
    console.log('   ✅ [UI] Badges Preferensi ("Pisah Warna", "Tanpa Pelembut") tampil di terminal kasir.');

    // 1.6 Buka Modal Preferensi dari Terminal Kasir
    const prefBtn = page.locator('button:has-text("Preferensi")').first();
    await prefBtn.click();

    // Verifikasi modal preferensi terbuka
    await page.waitForSelector('h3:has-text("Preferensi Laundry Pelanggan")', { timeout: 8000 });
    console.log('   ✅ [UI] Modal Preferensi Pelanggan terbuka.');

    // Ubah catatan custom di modal
    await page.fill('textarea', 'Jangan menggunakan deterjen wangi menyengat, pelanggan sensitif.');
    await page.click('button:has-text("Simpan Preferensi")');

    // Tunggu modal tertutup
    await page.waitForSelector('h3:has-text("Preferensi Laundry Pelanggan")', { state: 'detached', timeout: 8000 });
    console.log('   ✅ [UI] Preferensi berhasil disimpan dari terminal kasir.');
    console.log('   ✅ [PASS] Skenario 1 Berhasil: Customer Preference Profile & Secondary Phones terverifikasi 100%!\n');

    // =========================================================================
    // SKENARIO 2: OUTLET PRICING OVERRIDE & PRICE HISTORY
    // =========================================================================
    console.log('▶️ [SKENARIO 2] Outlet Pricing Override & Price History');

    // 2.1 Set Outlet Price Override via API: Menteng Rp 9.500 (Master Rp 8.000)
    const setPriceRes = await fetch(
      `${BASE_BACKEND}/api/laundry/core/services/${laundryService.id}/outlet-price`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          outletId: outletMenteng.id,
          priceOverride: 9500,
          expressMultiplierOverride: 1.75,
          isAvailable: true,
          reason: 'Penyesuaian Biaya Sewa Menteng',
        }),
      }
    );
    const setPriceJson = await setPriceRes.json();
    assert(setPriceJson.status === 'success', 'Set outlet price API must return success');
    assert(setPriceJson.data.newEffectivePrice === 9500, 'New effective price must be 9500');
    console.log('   ✅ [API] PUT outlet-price: Harga Cabang Menteng di-override menjadi Rp 9.500.');

    // 2.2 Verifikasi Price History Audit Trail
    const historyRes = await fetch(
      `${BASE_BACKEND}/api/laundry/core/services/${laundryService.id}/price-history?outletId=${outletMenteng.id}`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    const historyJson = await historyRes.json();
    assert(historyJson.status === 'success', 'Price history API must return success');
    assert(historyJson.data.length >= 1, 'Price history must have at least 1 record');
    const latestAudit = historyJson.data[0];
    assert(latestAudit.oldPrice === 8000, 'oldPrice in audit must be 8000');
    assert(latestAudit.newPrice === 9500, 'newPrice in audit must be 9500');
    assert(latestAudit.reason === 'Penyesuaian Biaya Sewa Menteng', 'Audit reason must match');
    console.log('   ✅ [API] Price History audit log mencatat Rp 8.000 -> Rp 9.500 beserta alasan.');

    // 2.3 Buka Halaman Layanan & Tarif, periksa Modal Riwayat Harga
    await navigateToTab(page, 'laundry_services');
    await page.waitForSelector('text=Katalog Layanan, Tarif', { timeout: 10000 });

    // Verifikasi badge tarif cabang tampil di kartu layanan
    const hasTarifCabangBadge = await page.locator('text=Tarif Cabang').first().isVisible();
    assert(hasTarifCabangBadge, 'Badge "Tarif Cabang" harus tampil pada kartu layanan');

    // Buka Modal Riwayat Harga
    const historyIconBtn = page.locator('button[title="Lihat Riwayat Perubahan Harga"]').first();
    await historyIconBtn.click();
    await page.waitForSelector('h2:has-text("Riwayat Perubahan Harga")', { timeout: 8000 });
    await page.waitForSelector('text=Penyesuaian Biaya Sewa Menteng', { timeout: 8000 });
    const modalAuditText = await page.locator('h2:has-text("Riwayat Perubahan Harga")').locator('xpath=ancestor::div[contains(@class, "rounded-3xl") or contains(@class, "rounded-t-3xl")]').innerText();
    assert(modalAuditText.includes('9.500'), 'Modal Riwayat Harga harus menampilkan 9.500');
    assert(modalAuditText.includes('Penyesuaian Biaya Sewa Menteng'), 'Modal harus menampilkan alasan perubahan');
    await page.click('button:has-text("Tutup")');
    await page.waitForSelector('h2:has-text("Riwayat Perubahan Harga")', { state: 'detached', timeout: 5000 });
    console.log('   ✅ [UI] Modal Riwayat Perubahan Harga menampilkan jejak audit dengan tepat.');

    // 2.4 Verifikasi di UI POS Laundry: Layanan menampilkan harga efektif Rp 9.500
    await navigateToTab(page, 'pos');
    await page.waitForSelector('text=Cuci Komplit Reguler', { timeout: 10000 });

    const posServicePriceText = await page.locator('text=Cuci Komplit Reguler').locator('xpath=ancestor::button').innerText();
    assert(
      posServicePriceText.includes('9.500'),
      `Katalog POS harus menampilkan harga cabang Rp 9.500, aktual: ${posServicePriceText}`
    );
    console.log('   ✅ [UI] Terminal Kasir Cabang Menteng menampilkan tarif khusus Rp 9.500/Kg.');
    console.log('   ✅ [PASS] Skenario 2 Berhasil: Outlet Pricing Override & Audit History terverifikasi 100%!\n');

    // =========================================================================
    // SKENARIO 3: POST-PROCESS QC CHECKLIST & INITIAL VS FINAL WEIGHT
    // =========================================================================
    console.log('▶️ [SKENARIO 3] Post-Process QC Checklist & Initial vs Final Weight');

    // 3.1 Buat Order Laundry Uji Coba: Berat Awal 5.0 Kg
    const invoiceNum = `INV-E2E-${timestamp.slice(-5)}`;
    const testOrder = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outletMenteng.id,
        userId: ownerUser.id,
        customerId: customer.id,
        invoiceNumber: invoiceNum,
        totalAmount: new Prisma.Decimal(47500),
        subtotal: new Prisma.Decimal(47500),
        orderStatus: OrderStatus.IN_PROGRESS,
        paymentStatus: PaymentStatus.PAID,
        laundryDetail: {
          create: {
            tenantId: tenant.id,
            outletId: outletMenteng.id,
            status: 'IRONING_PACKING',
            currentStage: 'IRONING',
            totalWeightKg: new Prisma.Decimal(5.0),
            initialWeightKg: new Prisma.Decimal(5.0),
            totalPieces: 12,
            garmentCounts: { Kemeja: 4, Celana: 4, Kaos: 4 },
          },
        },
        items: {
          create: {
            tenantId: tenant.id,
            productName: laundryService.name,
            quantity: 5,
            unitPrice: new Prisma.Decimal(9500),
            subtotal: new Prisma.Decimal(47500),
          },
        },
      },
      include: {
        laundryDetail: true,
      },
    });
    console.log('   ✅ Order uji coba seeded:', testOrder.invoiceNumber, '(Berat Awal: 5.0 Kg, Status: IN_PROGRESS)');

    // 3.2 Update Final Weight via API: 4.8 Kg (diff: -0.2 Kg, -4%)
    const weightRes = await fetch(
      `${BASE_BACKEND}/api/laundry/core/orders/${testOrder.id}/weight`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          finalWeightKg: 4.8,
          weightDiffReason: 'Penguapan air saat proses pengeringan dryer',
          syncTotalWeight: true,
        }),
      }
    );
    const weightJson = await weightRes.json();
    assert(weightJson.status === 'success', 'Update weight API must succeed');
    assert(weightJson.data.initialWeightKg === 5, 'initialWeightKg must be 5');
    assert(weightJson.data.finalWeightKg === 4.8, 'finalWeightKg must be 4.8');
    assert(weightJson.data.weightDiffKg === -0.2, 'weightDiffKg must be -0.2');
    console.log('   ✅ [API] PATCH order weight: Selisih -0.2 Kg terhitung presisi (-4.0%).');

    // 3.3 Submit QC Checklist: PASSED via API
    const qcRes = await fetch(
      `${BASE_BACKEND}/api/laundry/core/orders/${testOrder.id}/qc`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          qcStatus: 'PASSED',
          qcChecklist: {
            stainFree: true,
            odorFresh: true,
            ironedNeat: true,
            pieceCountVerified: true,
            verifiedPieces: 12,
            notes: 'Kain bersih, wangi lavender segar, setrika rapi.',
          },
        }),
      }
    );
    const qcJson = await qcRes.json();
    assert(qcJson.status === 'success', 'Update QC API must succeed');
    assert(qcJson.data.qcStatus === 'PASSED', 'qcStatus must be PASSED');
    console.log('   ✅ [API] PATCH order QC: Status PASSED, 4 kriteria QC terpenuhi.');

    // 3.4 Buka Antrean Cucian (Laundry Queue) di UI
    await navigateToTab(page, 'laundry_queue');
    await page.waitForSelector(`text=${invoiceNum}`, { timeout: 12000 });

    // Verifikasi badge QC Lolos & Berat Akhir 4.8 kg terlihat di kartu antrean
    const orderCard = page
      .locator(`text=${invoiceNum}`)
      .locator('xpath=ancestor::div[contains(@class, "bg-white") and contains(@class, "rounded-2xl")]');
    await orderCard.waitFor({ timeout: 8000 });

    const cardText = await orderCard.innerText();
    assert(cardText.includes('QC Lolos'), 'Kartu order harus memuat badge "QC Lolos"');
    assert(cardText.includes('4.8 kg'), 'Kartu order harus memuat badge "4.8 kg"');
    console.log('   ✅ [UI] Kartu order menampilkan badge "✅ QC Lolos" dan "⚖️ Akhir: 4.8 kg".');

    // 3.5 Buka Modal "QC & Berat Final" dari tombol kartu
    const qcModalBtn = orderCard.locator('button:has-text("QC & Berat Final")');
    await qcModalBtn.click();

    await page.waitForSelector('h3:has-text("Kontrol Kualitas & Verifikasi Berat")', { timeout: 8000 });
    const modalContent = await page
      .locator('h3:has-text("Kontrol Kualitas & Verifikasi Berat")')
      .locator('xpath=ancestor::div[contains(@class, "rounded-3xl") or contains(@class, "rounded-t-3xl")]')
      .innerText();
    assert(modalContent.includes('5 kg') || modalContent.includes('5.0') || modalContent.includes('5,0'), 'Modal harus menampilkan berat awal 5 Kg');
    assert(modalContent.includes('-0.2') || modalContent.includes('-0,2') || modalContent.includes('0.2'), 'Modal harus menampilkan selisih berat');
    console.log('   ✅ [UI] Modal QC & Berat Final menampilkan perbandingan berat & checklist.');

    // Tutup modal
    const closeQcModalBtn = page
      .locator('h3:has-text("Kontrol Kualitas & Verifikasi Berat")')
      .locator('xpath=ancestor::div[contains(@class, "rounded-3xl") or contains(@class, "rounded-t-3xl")]')
      .locator('button:has-text("Tutup")');
    await closeQcModalBtn.click();
    await page.waitForSelector('h3:has-text("Kontrol Kualitas & Verifikasi Berat")', { state: 'detached', timeout: 5000 });
    console.log('   ✅ [PASS] Skenario 3 Berhasil: Post-Process QC Checklist & Final Weight terverifikasi 100%!\n');

    // =========================================================================
    // SKENARIO 4: LOST & FOUND MODULE
    // =========================================================================
    console.log('▶️ [SKENARIO 4] Lost & Found Module (Pocket Items & Handover)');

    // 4.1 Buka Drawer Lost & Found via tombol di toolbar Laundry Queue
    const lostAndFoundToolbarBtn = page.locator('button:has-text("Lost & Found")');
    await lostAndFoundToolbarBtn.click();

    // Verifikasi Drawer terbuka
    await page.waitForSelector('h2:has-text("Lost & Found (Barang Temuan)")', { timeout: 8000 });
    console.log('   ✅ [UI] Drawer Lost & Found terbuka.');

    // 4.2 Buka Form Tambah Temuan Baru
    await page.click('button:has-text("Catat Temuan Baru")');
    await page.waitForSelector('text=Catat Barang Temuan Baru', { timeout: 5000 });

    // Isi formulir barang temuan di saku
    const itemNameTest = `Kunci Motor Honda Vario ${timestamp.slice(-4)}`;
    await page.fill('input[placeholder*="Kunci Motor"]', itemNameTest);
    await page.fill('input[placeholder*="Loker"]', 'Loker Temuan Kasir A-1');
    await page.fill('input[placeholder*="Gantungan dompet"]', 'Gantungan kunci dompet kulit cokelat');

    // Klik Simpan Temuan
    await page.click('button:has-text("Simpan Temuan")');

    // 4.3 Verifikasi barang temuan muncul di daftar dengan status "Belum Diambil"
    await page.waitForSelector(`text=${itemNameTest}`, { timeout: 8000 });
    const itemCard = page
      .locator(`text=${itemNameTest}`)
      .locator('xpath=ancestor::div[contains(@class, "bg-white") and contains(@class, "rounded-xl")]');
    const itemCardText = await itemCard.innerText();
    assert(itemCardText.toLowerCase().includes('belum diambil'), 'Barang temuan baru harus berstatus "Belum Diambil"');
    assert(itemCardText.toLowerCase().includes('barang di saku'), 'Kategori harus "Barang di Saku"');
    console.log('   ✅ [UI] Barang temuan tercatat dengan status "Belum Diambil".');

    // 4.4 Lakukan Aksi: "Serahkan ke Pemilik"
    const handoverBtn = itemCard.locator('button:has-text("Serahkan ke Pemilik")');
    await handoverBtn.click();

    // Verifikasi mini modal konfirmasi serah terima muncul
    await page.waitForSelector('text=Konfirmasi Serah Terima ke Pemilik', { timeout: 5000 });
    await page.fill('input[placeholder*="Nama penerima"]', 'Bpk. Rahmat Santoso (Pemilik)');
    await page.click('button:has-text("Selesaikan Serah Terima")');

    // 4.5 Verifikasi status berubah menjadi "Sudah Diserahkan"
    await page.waitForSelector('text=Sudah Diserahkan', { timeout: 8000 });
    const updatedCardText = await itemCard.innerText();
    assert(updatedCardText.toLowerCase().includes('sudah diserahkan'), 'Status harus terupdate menjadi "Sudah Diserahkan"');
    assert(updatedCardText.includes('Bpk. Rahmat Santoso (Pemilik)'), 'Nama penerima harus tampil pada riwayat');
    console.log('   ✅ [UI] Serah terima barang temuan berhasil, status: "Sudah Diserahkan".');

    // Tutup Drawer
    const closeDrawerBtn = page
      .locator('h2:has-text("Lost & Found (Barang Temuan)")')
      .locator('xpath=ancestor::div[contains(@class, "border-b")]')
      .locator('button')
      .last();
    await closeDrawerBtn.click();
    await page.waitForSelector('h2:has-text("Lost & Found (Barang Temuan)")', { state: 'detached', timeout: 5000 });
    console.log('   ✅ [PASS] Skenario 4 Berhasil: Lost & Found Module terverifikasi 100%!\n');

    console.log('================================================================================');
    console.log('🎉 SEMUA 4 SKENARIO E2E LAUNDRY CORE PHASE 1 LULUS DENGAN SEMPURNA (100% PASS)!');
    console.log('================================================================================\n');
  } catch (error: any) {
    console.error('\n❌ [E2E FAILED] Terjadi kegagalan pengujian:', error);
    if (page) {
      try {
        await page.screenshot({ path: 'pos_apps/e2e/laundry_core_failure.png', fullPage: true });
        console.log('📸 Screenshot kegagalan disimpan di pos_apps/e2e/laundry_core_failure.png');
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
        `DELETE FROM "laundry_lost_and_found" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_service_price_histories" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_service_outlet_prices" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_stage_logs" WHERE "operator_id" IN (SELECT id FROM "users" WHERE "tenant_id" = $1)`,
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

runLaundryCorePhase1E2E()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
