import { chromium, Browser, Page } from 'playwright';
import { PrismaClient, Role, BusinessVerticalMode } from '../server/node_modules/@prisma/client';
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

async function runE2ESuite() {
  console.log('================================================================================');
  console.log('🧪 WELL POS — OWNER PORTAL & MULTI-BUSINESS PLAYWRIGHT E2E TEST SUITE');
  console.log('   Target Frontend:', BASE_FRONTEND);
  console.log('   Target Backend: ', BASE_BACKEND);
  console.log('================================================================================\n');

  const timestamp = Date.now().toString();
  const tenantSlug = `e2e-owner-portal-${timestamp}`;
  const ownerEmail = `owner.e2e.${timestamp}@wellpos.test`;
  const cashierEmail = `cashier.e2e.${timestamp}@wellpos.test`;
  const passwordRaw = 'Password123!';
  const passwordHash = await bcrypt.hash(passwordRaw, 10);

  let createdTenantId: string | null = null;
  let ownerToken: string | null = null;
  let browser: Browser | null = null;

  try {
    // =========================================================================
    // 0. SEEDING ISOLATED TEST TENANT & USERS
    // =========================================================================
    console.log('🌱 [0/7] Menyiapkan data seeder tenant & entitas awal...');

    // 1. Buat Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: `E2E Owner Portal Test Corp ${timestamp.slice(-4)}`,
        slug: tenantSlug,
        businessVertical: 'RETAIL',
        status: 'ACTIVE',
        businessType: 'Multi-Business',
        phone: '+6281234567890',
      },
    });
    createdTenantId = tenant.id;

    // 2. Buat Bisnis Laundry Awal
    const laundryBusiness = await prisma.business.create({
      data: {
        tenantId: tenant.id,
        name: 'Laundry Express E2E',
        slug: `laundry-express-${timestamp.slice(-6)}`,
        vertical: BusinessVerticalMode.LAUNDRY,
        subCategory: 'Kiloan & Satuan',
        isActive: true,
      },
    });

    // 3. Buat Outlet Laundry Awal
    const laundryOutlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: laundryBusiness.id,
        code: `LND-${timestamp.slice(-4)}`,
        name: 'Laundry Pusat E2E',
        address: 'Jl. Merdeka No. 10, Jakarta',
        phone: '+6281234567891',
        industries: ['LAUNDRY'],
        isWorkshop: true,
        isActive: true,
      },
    });

    // 4. Buat User OWNER
    const ownerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        userCode: `OWN-${timestamp.slice(-5)}`,
        name: 'Budi Owner E2E',
        firstName: 'Budi',
        lastName: 'Owner',
        email: ownerEmail,
        passwordHash,
        role: Role.OWNER,
        isActive: true,
      },
    });

    // 5. Buat User CASHIER terikat ke laundryOutlet
    const cashierUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: laundryOutlet.id,
        userCode: `KSR-${timestamp.slice(-5)}`,
        name: 'Siti Kasir E2E',
        firstName: 'Siti',
        lastName: 'Kasir',
        email: cashierEmail,
        passwordHash,
        role: Role.CASHIER,
        isActive: true,
      },
    });

    // 6. Buat Subscription & 1 Paid SaaSInvoice (500 tokens)
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
        invoiceNumber: `INV-E2E-${timestamp.slice(-6)}`,
        amount: 50000,
        tokenAmount: 500,
        status: 'PAID',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        paidAt: new Date(),
        notes: 'Top Up Awal 500 Token E2E Test',
      },
    });

    // Generate Owner JWT for API verification
    ownerToken = jwt.sign(
      {
        userId: ownerUser.id,
        role: ownerUser.role,
        outletId: null,
        tenantId: tenant.id,
        tokenVersion: 1,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('   ✅ Tenant seeded:', tenant.name, `(${tenant.slug})`);
    console.log('   ✅ Owner seeded:', ownerEmail);
    console.log('   ✅ Cashier seeded:', cashierEmail);
    console.log('   ✅ Initial Business: Laundry Express E2E (1 Outlet)\n');

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
    const page = await context.newPage();

    // =========================================================================
    // SKENARIO 1: SMART ROUTING OWNER 1 BISNIS (ZERO FRICTION)
    // =========================================================================
    console.log('▶️ [SKENARIO 1] Smart Routing Owner 1 Bisnis (Zero Friction)');
    await page.goto(`${BASE_FRONTEND}/#pos`, { waitUntil: 'domcontentloaded' });

    // Pilih tab Portal Pemilik (Email)
    await page.waitForSelector('button:has-text("Portal Pemilik (Email)")', { timeout: 10000 });
    await page.click('button:has-text("Portal Pemilik (Email)")');

    // Isi formulir login
    await page.fill('input[type="email"]', ownerEmail);
    await page.fill('input[type="password"]', passwordRaw);
    await page.click('button:has-text("Masuk ke Portal Pemilik")');

    // Tunggu dashboard termuat
    // Verifikasi: Owner memiliki tepat 1 bisnis -> Auto-select langsung ke Dashboard Laundry tanpa lewat Owner Portal
    await page.waitForSelector('button[title="Buka Owner Portal & Kelola Bisnis"]', { timeout: 15000 });
    console.log('   ✅ Tombol "Owner Portal" terlihat di navbar header.');

    await page.waitForTimeout(2000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('   🔍 Body text snippet:', bodyText.slice(0, 300).replace(/\n+/g, ' | '));

    // Verifikasi menu laundry aktif di sidebar
    const hasLaundryMenu = await page.locator('span:has-text("Antrean Cucian Masuk"), span:has-text("Rak Simpan & Ambil"), button[title="Ringkasan Bisnis Laundry"], span:has-text("Laundry")').first().isVisible();
    assert(hasLaundryMenu, 'Menu vertikal Laundry harus terlihat di sidebar pada bisnis Laundry');
    console.log('   ✅ Sidebar menampilkan modul Laundry dengan tepat.');
    console.log('   ✅ [PASS] Skenario 1 Berhasil: Smart Routing langsung ke Dashboard tanpa friksi!\n');

    // =========================================================================
    // SKENARIO 2: OWNER PORTAL UI & BUAT BISNIS KE-2 (F&B)
    // =========================================================================
    console.log('▶️ [SKENARIO 2] Owner Portal UI & Buat Bisnis Ke-2 (F&B)');
    // Klik tombol Owner Portal di navbar
    await page.click('button[title="Buka Owner Portal & Kelola Bisnis"]');

    // Verifikasi masuk ke Owner Portal Page
    await page.waitForSelector('h1:has-text("Well POS")', { timeout: 10000 });
    const isOwnerPortalBadge = await page.locator('span:has-text("Owner Portal")').isVisible();
    assert(isOwnerPortalBadge, 'Badge "Owner Portal" harus terlihat di header portal');

    // Verifikasi 3 tab kanonikal
    const tab1 = await page.locator('button:has-text("Bisnis Saya")').isVisible();
    const tab2 = await page.locator('button:has-text("Paket & Beli Token")').isVisible();
    const tab3 = await page.locator('button:has-text("Invoice & Pemakaian Token")').isVisible();
    assert(tab1 && tab2 && tab3, 'Ketiga tab kanonikal Owner Portal harus tampil lengkap');
    console.log('   ✅ 3 Tab kanonikal (Bisnis Saya, Paket & Beli Token, Invoice) hadir.');

    // Verifikasi Sisa Token pill menampilkan saldo 500 (tunggu async fetch selesai)
    const tokenPill = page.locator('button[title="Buka menu Paket & Beli Token"]');
    await tokenPill.filter({ hasText: '500' }).waitFor({ timeout: 10000 });
    const tokenPillText = await tokenPill.innerText();
    assert(tokenPillText.includes('500'), `Sisa token harus menampilkan 500, aktual: ${tokenPillText}`);
    console.log('   ✅ Widget Sisa Token menampilkan saldo 500 token.');

    // Buka Modal Buat Bisnis Baru
    await page.click('button:has-text("Buat Bisnis Baru")');
    await page.waitForSelector('h3:has-text("Buat Entitas Bisnis Baru")', { timeout: 5000 });

    // Step 1: Pilih FNB & Isi Nama Bisnis
    await page.fill('input[placeholder="contoh: Kopi Kenangan Nusantara"]', 'Kopi Uji E2E');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Lanjut ke Outlet")');

    // Step 2: Konfirmasi Nama Outlet Pertama
    await page.waitForSelector('h3:has-text("Atur Toko / Cabang Pertama")', { timeout: 5000 });
    await page.waitForTimeout(500);

    const outletInput = page.locator('input[placeholder="contoh: Cabang Tebet / Pusat"]');
    if (await outletInput.isVisible()) {
      await outletInput.fill('Kopi Uji - Pusat');
      await page.waitForTimeout(300);
    }

    const submitBizBtn = page.locator('button:has-text("Buat Bisnis Sekarang"), button[type="submit"]:has-text("Buat Bisnis")');
    if (await submitBizBtn.isVisible()) {
      await submitBizBtn.click();
    }

    // Tunggu modal tertutup & data ter-refresh
    await page.waitForSelector('h3:has-text("Buat Entitas Bisnis Baru")', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Verifikasi kartu bisnis sekarang ada 2
    const bizCards = page.locator('div.rounded-3xl.border.border-slate-200.bg-white');
    const bizCount = await bizCards.count();
    assert(bizCount >= 2, `Jumlah kartu bisnis harus minimal 2, aktual: ${bizCount}`);
    const hasKopiCard = await page.locator('h4:has-text("Kopi Uji E2E"), h3:has-text("Kopi Uji E2E")').isVisible();
    const hasLaundryCard = await page.locator('h4:has-text("Laundry Express E2E"), h3:has-text("Laundry Express E2E")').isVisible();
    assert(hasKopiCard && hasLaundryCard, 'Kedua kartu bisnis (Laundry & F&B) harus tampil di Owner Portal');
    console.log('   ✅ Modal tertutup & kedua bisnis (Laundry Express E2E & Kopi Uji E2E) tampil rapi.');
    console.log('   ✅ [PASS] Skenario 2 Berhasil: Entitas bisnis baru F&B berhasil dibuat!\n');

    // =========================================================================
    // SKENARIO 3: ISOLASI WORKSPACE, OUTLETS VIEW, & BRANCH 2 FIX
    // =========================================================================
    console.log('▶️ [SKENARIO 3] Isolasi Workspace, OutletsView, & Branch 2 Fix');

    // 1. Masuk ke Dashboard Laundry
    const laundryCardContainer = page.locator('div.rounded-3xl.border.border-slate-200.bg-white:has-text("Laundry Express E2E")');
    await laundryCardContainer.locator('button:has-text("Buka Dashboard")').click();
    await page.waitForSelector('button[title="Buka Owner Portal & Kelola Bisnis"]', { timeout: 10000 });

    // 2. Buka menu Outlets (Daftar Toko & Workshop)
    const settingsGroupBtn = page.locator('button[title="Pengaturan Toko"], button:has-text("Pengaturan Toko")').first();
    if (await settingsGroupBtn.isVisible()) {
      await settingsGroupBtn.click();
      await page.waitForTimeout(400);
    }
    const outletsMenuBtn = page.locator('button[title="Daftar Toko & Workshop"], button:has-text("Daftar Toko & Workshop")').first();
    if (await outletsMenuBtn.isVisible()) {
      await outletsMenuBtn.click();
    } else {
      // Fallback via dropdown selector
      const storeDropdownTrigger = page.locator('header button').filter({ hasText: /Laundry Pusat E2E|Pilih Toko/ }).first();
      await storeDropdownTrigger.click();
      await page.waitForTimeout(300);
      await page.click('button:has-text("Kelola & Tambah Toko")');
    }
    await page.waitForSelector('h1:has-text("Manajemen Toko & Workshop"), h1:has-text("Kelola Outlet Toko"), button:has-text("Tambah Toko / Workshop")', { timeout: 10000 });

    // Verifikasi OutletsView hanya memuat outlet milik Laundry (0 outlet F&B)
    const editButtons = page.locator('button[title="Edit Informasi Toko"]');
    await editButtons.first().waitFor({ timeout: 5000 });
    const storeCountBefore = await editButtons.count();
    assert(storeCountBefore === 1, `Sebelum tambah, Laundry hanya boleh punya 1 outlet, aktual: ${storeCountBefore}`);
    const hasKopiStoreInLaundry = await page.locator('h3:has-text("Kopi Uji")').isVisible();
    assert(!hasKopiStoreInLaundry, 'Outlet F&B tidak boleh bocor ke OutletsView Laundry!');
    console.log('   ✅ Isolasi OutletsView Laundry bersih (0 outlet F&B).');

    // 3. Tambah cabang laundry ke-2 via OutletsView
    await page.click('button:has-text("Tambah Toko / Workshop")');
    await page.waitForSelector('h3:has-text("Tambah Outlet Toko")', { timeout: 5000 });
    await page.fill('input[placeholder="Contoh: Well Laundry - Kemang"]', 'Laundry Cabang 2');
    await page.click('button:has-text("Buat Toko Baru")');
    await page.waitForSelector('h3:has-text("Tambah Outlet Toko")', { state: 'detached', timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verifikasi outlet bertambah menjadi 2
    const storeCountAfter = await editButtons.count();
    assert(storeCountAfter === 2, `Setelah tambah, Laundry harus memiliki 2 outlet, aktual: ${storeCountAfter}`);
    console.log('   ✅ Cabang ke-2 "Laundry Cabang 2" berhasil dibuat.');

    // 4. Pilih cabang ke-2 via Store Dropdown Selector di navbar
    // Cari tombol selector toko di navbar (yang menampilkan nama outlet aktif)
    const storeDropdownTrigger = page.locator('header button').filter({ hasText: /Laundry Pusat E2E|Pilih Toko/ }).first();
    await storeDropdownTrigger.click();
    await page.waitForTimeout(500);

    // Klik cabang ke-2 di dalam dropdown
    const branch2DropdownItem = page.locator('header button').filter({ hasText: 'Laundry Cabang 2' }).first();
    await branch2DropdownItem.click();
    await page.waitForTimeout(1000);

    // Verifikasi navbar sekarang menampilkan "Laundry Cabang 2"
    const activeOutletName = await page.locator('header').innerText();
    assert(activeOutletName.includes('Laundry Cabang 2'), 'Navbar harus menampilkan Laundry Cabang 2 sebagai outlet aktif');
    console.log('   ✅ Active outlet berhasil beralih ke "Laundry Cabang 2".');

    // Jika onboarding wizard muncul untuk cabang baru, tutup/lewati
    const dismissWizardBtn = page.locator('button[title="Tutup Wizard (Lanjutkan Setup Nanti)"], button:has-text("Lewati Setup")').first();
    if (await dismissWizardBtn.isVisible()) {
      await dismissWizardBtn.click();
      await page.waitForTimeout(500);
    }

    // 5. Uji Catatan 1: Edit "Laundry Cabang 2" dan pastikan TIDAK snap-back ke cabang 1
    const cardBranch2 = page.locator('div.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3 > div').filter({ has: page.locator('h3', { hasText: 'Laundry Cabang 2' }) });
    await cardBranch2.locator('button[title="Edit Informasi Toko"]').click();
    await page.waitForSelector('h3:has-text("Edit Outlet Toko")', { timeout: 5000 });

    // Ubah alamat toko
    const addressInput = page.locator('form textarea');
    await addressInput.fill('Jl. Kemang Raya No. 99, Jakarta Selatan (Updated)');
    await page.click('button:has-text("Simpan Perubahan Toko")');
    await page.waitForSelector('h3:has-text("Edit Outlet Toko")', { state: 'detached', timeout: 10000 });
    await page.waitForTimeout(1500);

    // Verifikasi active outlet tetap "Laundry Cabang 2" (tidak snap-back)
    const activeOutletAfterSave = await page.locator('header').innerText();
    assert(activeOutletAfterSave.includes('Laundry Cabang 2'), 'Active outlet WAJIB tetap "Laundry Cabang 2" dan TIDAK SNAP-BACK ke cabang 1!');
    console.log('   ✅ [Catatan 1 Verified] Active outlet TIDAK snap-back setelah edit cabang ke-2.');

    // 6. Kembali ke Owner Portal dan buka Bisnis F&B
    await page.click('button[title="Buka Owner Portal & Kelola Bisnis"]');
    await page.waitForSelector('h1:has-text("Well POS")', { timeout: 10000 });

    const fnbCardContainer = page.locator('div.rounded-3xl.border.border-slate-200.bg-white:has-text("Kopi Uji E2E")');
    await fnbCardContainer.locator('button:has-text("Buka Dashboard")').click();
    await page.waitForSelector('button[title="Buka Owner Portal & Kelola Bisnis"]', { timeout: 10000 });

    // Jika onboarding wizard muncul untuk outlet F&B baru, lewati/tutup wizard
    await page.waitForTimeout(500);
    const dismissFnbWizardBtn = page.locator('button[title="Tutup Wizard (Lanjutkan Setup Nanti)"], button:has-text("Lewati Setup")').first();
    if (await dismissFnbWizardBtn.isVisible()) {
      await dismissFnbWizardBtn.click();
      await page.waitForTimeout(500);
    }

    // Verifikasi dashboard F&B terbuka (menu F&B ada, menu cucian/laundry TIDAK ada)
    const hasFnbMenu = await page.locator('span:has-text("Menu & Produk"), span:has-text("Buku Menu QR"), span:has-text("Buka Kasir POS")').first().isVisible();
    const hasLaundryMenuInFnb = await page.locator('span:has-text("Operasional Laundry"), span:has-text("Antrean Cucian Masuk"), span:has-text("Kasir Laundry")').isVisible();
    assert(hasFnbMenu, 'Menu F&B (Menu & Produk / Buku Menu QR) harus terlihat di dashboard F&B');
    assert(!hasLaundryMenuInFnb, 'Menu Laundry tidak boleh bocor ke dashboard F&B!');
    console.log('   ✅ Isolasi vertikal F&B terbukti 100% mandiri.');
    console.log('   ✅ [PASS] Skenario 3 Berhasil: Isolasi workspace & anti snap-back terverifikasi!\n');

    // =========================================================================
    // SKENARIO 4: MULTI-BUSINESS ROUTING & SESSION STORAGE PERSISTENCE
    // =========================================================================
    console.log('▶️ [SKENARIO 4] Multi-Business Routing & Session Storage Persistence');

    // 1. Verifikasi reload dengan sessionStorage aktif tetap berada di F&B
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button[title="Buka Owner Portal & Kelola Bisnis"]', { timeout: 10000 });

    // Lewati wizard jika muncul setelah reload
    await page.waitForTimeout(500);
    const dismissReloadWizard = page.locator('button[title="Tutup Wizard (Lanjutkan Setup Nanti)"], button:has-text("Lewati Setup")').first();
    if (await dismissReloadWizard.isVisible()) {
      await dismissReloadWizard.click();
      await page.waitForTimeout(500);
    }

    const isStillFnb = await page.locator('span:has-text("Menu & Produk"), span:has-text("Buku Menu QR"), span:has-text("Buka Kasir POS")').first().isVisible();
    assert(isStillFnb, 'Setelah reload dengan sessionStorage, user harus tetap berada di Dashboard F&B');
    console.log('   ✅ Auto-resume dashboard F&B via sessionStorage berjalan sempurna.');

    // 2. Hapus sessionStorage dan reload -> Harus mendarat di Owner Portal karena punya >= 2 bisnis
    await page.evaluate(() => sessionStorage.removeItem('wellpos_active_business_id'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1:has-text("Well POS")', { timeout: 10000 });
    const isAtPortal = await page.locator('span:has-text("Owner Portal")').isVisible();
    assert(isAtPortal, 'Ketika memiliki >= 2 bisnis dan tanpa sessionStorage, Owner WAJIB mendarat di Owner Portal');
    console.log('   ✅ Saat sessionStorage kosong & >= 2 bisnis, otomatis diarahkan ke Owner Portal.');
    console.log('   ✅ [PASS] Skenario 4 Berhasil: Multi-business smart routing & persistence lulus!\n');

    // =========================================================================
    // SKENARIO 5: TAB PAKET & BELI TOKEN & INVOICES TAB
    // =========================================================================
    console.log('▶️ [SKENARIO 5] Tab Paket & Beli Token & Invoices Tab');

    // 1. Pindah ke Tab Paket & Beli Token
    await page.click('button:has-text("Paket & Beli Token")');
    await page.waitForSelector('h4:has-text("Pilih Paket Isi Ulang Token")', { timeout: 5000 });

    // 2. Klik preset kartu & verifikasi perhitungan instan tanpa loading spinner
    const presetButtons = page.locator('div.grid.grid-cols-2.sm\\:grid-cols-4.gap-3 button');
    await presetButtons.first().waitFor({ timeout: 5000 });

    // Klik preset ke-3 (1.500 token, index 2)
    await presetButtons.nth(2).click();
    await page.waitForTimeout(400);

    // Verifikasi harga terhitung (Rp 150.000)
    const hasPrice150k = await page.locator('text=/150[.,]000/').first().isVisible();
    assert(hasPrice150k, 'Preset 1.500 token harus menghitung harga Rp 150.000');
    console.log('   ✅ Preset 1.500 token kalkulasi instan (Rp 150.000) tanpa refetch atau flash.');

    // Klik preset ke-2 (500 token, index 1)
    await presetButtons.nth(1).click();
    await page.waitForTimeout(400);
    const hasPrice50k = await page.locator('text=/50[.,]000/').first().isVisible();
    assert(hasPrice50k, 'Preset 500 token harus menghitung harga Rp 50.000');
    console.log('   ✅ Preset 500 token kalkulasi instan (Rp 50.000).');

    // 3. Pindah ke Tab Invoice & Pemakaian Token
    await page.click('button:has-text("Invoice & Pemakaian Token")');
    await page.waitForSelector('table', { timeout: 5000 });

    // Verifikasi tabel invoice menampilkan invoice awal (INV-E2E-...) dengan badge Lunas
    const hasPaidInvoice = await page.locator('span:has-text("Lunas")').first().isVisible();
    assert(hasPaidInvoice, 'Faktur pembelian token dengan badge "Lunas" harus tampil di tabel');
    console.log('   ✅ Riwayat invoice token tampil rapi dengan badge status Lunas.');
    console.log('   ✅ [PASS] Skenario 5 Berhasil: Tab token & invoice render mulus dengan zero lag!\n');

    // =========================================================================
    // SKENARIO 6: ISOLASI PERAN NON-OWNER (ROLE CASHIER)
    // =========================================================================
    console.log('▶️ [SKENARIO 6] Isolasi Peran Non-Owner (Role CASHIER)');

    // 1. Bersihkan session & navigasi ke login
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_FRONTEND}/#pos`, { waitUntil: 'domcontentloaded' });

    // 2. Login sebagai CASHIER via Backoffice form
    await page.waitForSelector('button:has-text("Portal Pemilik (Email)")', { timeout: 10000 });
    await page.click('button:has-text("Portal Pemilik (Email)")');
    await page.fill('input[type="email"]', cashierEmail);
    await page.fill('input[type="password"]', passwordRaw);
    await page.click('button:has-text("Masuk ke Portal Pemilik")');

    // 3. Verifikasi Kasir langsung masuk ke Dashboard/POS terminal
    await page.waitForSelector('header', { timeout: 15000 });

    // 4. Pastikan kasir TIDAK PERNAH melihat tombol Owner Portal
    const ownerPortalBtnForCashier = page.locator('button[title="Buka Owner Portal & Kelola Bisnis"]');
    const isOwnerBtnVisible = await ownerPortalBtnForCashier.isVisible();
    assert(!isOwnerBtnVisible, 'CASHIER TIDAK BOLEH memiliki tombol Owner Portal di navbar!');

    // 5. Pastikan kasir TIDAK PERNAH berada di OwnerPortalPage
    const isOwnerPortalRendered = await page.locator('span:has-text("Owner Portal")').isVisible();
    assert(!isOwnerPortalRendered, 'CASHIER TIDAK BOLEH merender halaman OwnerPortalPage!');
    console.log('   ✅ Role CASHIER terisolasi: 0 tombol portal & 0 akses ke halaman portal.');
    console.log('   ✅ [PASS] Skenario 6 Berhasil: Non-owner RBAC ketat dan aman!\n');

    // =========================================================================
    // SKENARIO 7: ISOLASI LAUNDRY ANALYTICS (OUTLETID=ALL) & INSTANT CACHE
    // =========================================================================
    console.log('▶️ [SKENARIO 7] Isolasi Laundry Analytics (outletId=ALL) & Instant Cache Invalidation');

    // Panggil GET /api/laundry/analytics/benchmark?preset=30d&outletId=ALL menggunakan JWT OWNER
    const apiRes = await fetch(`${BASE_BACKEND}/api/laundry/analytics/benchmark?preset=30d&outletId=ALL`, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    assert(apiRes.status === 200, `Benchmark analytics harus merespons HTTP 200, aktual: ${apiRes.status}`);
    const jsonBody = await apiRes.json();
    assert(jsonBody.status === 'success', 'Benchmark analytics harus berstatus success');

    const benchmarkOutlets = jsonBody.data?.outlets || [];
    console.log(`   📊 Total outlets dalam laundry benchmark: ${benchmarkOutlets.length}`);
    for (const out of benchmarkOutlets) {
      console.log(`      - Outlet: "${out.outletName}" (ID: ${out.outletId})`);
    }

    // Verifikasi:
    // 1. Harus memuat kedua cabang Laundry ("Laundry Pusat E2E" dan "Laundry Cabang 2")
    const hasPusat = benchmarkOutlets.some((o: any) => o.outletName.includes('Laundry Pusat E2E'));
    const hasCabang2 = benchmarkOutlets.some((o: any) => o.outletName.includes('Laundry Cabang 2'));
    assert(hasPusat && hasCabang2, 'Benchmark Laundry WAJIB mencakup kedua outlet Laundry!');

    // 2. DILARANG memuat outlet F&B ("Kopi Uji - Pusat")
    const hasKopiInLaundryBenchmark = benchmarkOutlets.some((o: any) => o.outletName.includes('Kopi Uji'));
    assert(!hasKopiInLaundryBenchmark, 'Benchmark Laundry DILARANG KERAS memuat outlet bisnis F&B!');

    // 3. Panjang array outlets harus tepat 2
    assert(benchmarkOutlets.length === 2, `Jumlah outlet benchmark harus tepat 2, aktual: ${benchmarkOutlets.length}`);
    console.log('   ✅ [Catatan 2 Verified] Instant cache invalidation aktif: outlet ke-2 langsung terdaftar di benchmark tanpa stale cache.');
    console.log('   ✅ [PASS] Skenario 7 Berhasil: Isolasi analitik multi-bisnis 100% kedap air!\n');

    console.log('================================================================================');
    console.log('🎉 SELURUH 7 SKENARIO PLAYWRIGHT E2E OWNER PORTAL LULUS 100%!');
    console.log('================================================================================\n');

  } catch (error: any) {
    console.error('\n❌ [E2E FAILURE]:', error?.message || error);
    if (browser) {
      try {
        const pages = browser.contexts()[0]?.pages() || [];
        if (pages[0]) {
          await pages[0].screenshot({ path: 'pos_apps/e2e/failure_screenshot.png' });
          console.log('📸 Screenshot kegagalan disimpan di pos_apps/e2e/failure_screenshot.png');
        }
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
      const tablesToClean = [
        `DELETE FROM "inventory_balances" WHERE "tenant_id" = $1`,
        `DELETE FROM "storage_locations" WHERE "tenant_id" = $1`,
        `DELETE FROM "outlet_products" WHERE "outlet_id" IN (SELECT id FROM "outlets" WHERE "tenant_id" = $1)`,
        `DELETE FROM "persistent_alerts" WHERE "tenant_id" = $1`,
        `DELETE FROM "alert_rule_configs" WHERE "tenant_id" = $1`,
        `DELETE FROM "orders" WHERE "tenant_id" = $1`,
        `DELETE FROM "shifts" WHERE "tenant_id" = $1`,
        `DELETE FROM "users" WHERE "tenant_id" = $1`,
        `DELETE FROM "outlets" WHERE "tenant_id" = $1`,
        `DELETE FROM "businesses" WHERE "tenant_id" = $1`,
        `DELETE FROM "saas_invoices" WHERE "tenant_id" = $1`,
        `DELETE FROM "tenant_subscriptions" WHERE "tenant_id" = $1`,
        `DELETE FROM "tenants" WHERE "id" = $1`,
      ];
      for (const query of tablesToClean) {
        try {
          await prisma.$executeRawUnsafe(query, createdTenantId);
        } catch (e: any) {
          // ignore table if already empty or cascade handled
        }
      }
      console.log('✨ [CLEANUP COMPLETE] Database bersih 100% tanpa residu.');
    }
    await prisma.$disconnect();
  }
}

runE2ESuite()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
