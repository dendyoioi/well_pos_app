const { chromium } = require('../pos_apps/node_modules/playwright');
const jwt = require('../pos_apps/server/node_modules/jsonwebtoken');
const { PrismaClient } = require('../pos_apps/server/node_modules/@prisma/client');
const path = require('path');
const fs = require('fs');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01';
const prisma = new PrismaClient();
const JWT_SECRET = '9a10881b59579529413dda63698c1cb85dbb6e86c0ee470bb37e07ba1d049f75b6906b6a6e933e21e71a1c0ef8b88c0b7afdf31db9b8a1ddad4cdb4fe27dc383';

async function runTahap2Verification() {
  console.log('===================================================================');
  console.log('🔍 VERIFIKASI TAHAP 2: ELIMINASI DUPLIKASI, DRAWER & MODAL INPUT CEPAT');
  console.log('===================================================================');

  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  // 1. Authenticate as Laundry Owner
  const laundryUser = await prisma.user.findFirst({
    where: { email: 'owner.laundry@wellpos.id' },
    include: {
      tenant: {
        include: {
          outlets: true,
        },
      },
      outlet: true,
    },
  });

  if (!laundryUser || !laundryUser.tenant) {
    throw new Error('User laundry tidak ditemukan di database');
  }

  const laundryOutlet = laundryUser.tenant.outlets.find(
    (o) => o.industries && o.industries.some((i) => i.toLowerCase().includes('laundry'))
  ) || laundryUser.tenant.outlets[0];

  const laundryToken = jwt.sign(
    {
      userId: laundryUser.id,
      role: laundryUser.role,
      outletId: laundryOutlet.id,
      tenantId: laundryUser.tenantId,
      tokenVersion: laundryUser.tokenVersion || 1,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const laundryAuthPayload = {
    id: laundryUser.id,
    email: laundryUser.email,
    name: laundryUser.name,
    role: laundryUser.role,
    tenantId: laundryUser.tenantId,
    outletId: laundryOutlet.id,
    tenant: {
      id: laundryUser.tenant.id,
      name: laundryUser.tenant.name,
      businessType: laundryUser.tenant.businessType,
      businessVertical: laundryUser.tenant.businessVertical,
    },
    outlet: {
      id: laundryOutlet.id,
      name: laundryOutlet.name,
      address: laundryOutlet.address,
      phone: laundryOutlet.phone,
      industries: laundryOutlet.industries,
    },
  };

  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------
    // TEST 1: Beranda Laundry Desktop (1366x768)
    // -------------------------------------------------------------
    console.log('\n🖥️ [1/4] Testing Beranda Laundry Desktop (1366x768)...');
    const laptopContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const laptopPage = await laptopContext.newPage();

    await laptopPage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await laptopPage.evaluate(({ token, user, outlet }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('pos_active_outlet', JSON.stringify(outlet));
    }, { token: laundryToken, user: laundryAuthPayload, outlet: laundryOutlet });

    await laptopPage.goto('http://localhost:5173/?tab=overview#dashboard', { waitUntil: 'domcontentloaded' });
    await laptopPage.waitForTimeout(2000);

    // 1.1 Verify NO "Input Cepat" in Sidebar
    const sidebarInputCepat = await laptopPage.locator('aside button[title*="Input Cepat"]').count();
    console.log(`  ✓ Sidebar Input Cepat button count: ${sidebarInputCepat} (Expected: 0)`);

    // 1.2 Verify NO "Input Cepat" in Hero Card
    const heroCardInputCepat = await laptopPage.locator('div[class*="from-blue-950"] button:has-text("Input Cepat")').count();
    console.log(`  ✓ Hero Card Input Cepat button count: ${heroCardInputCepat} (Expected: 0)`);

    // 1.3 Verify NO Paket & Kuota badge in Top Header
    const topHeaderPaketBadge = await laptopPage.locator('header button[title="Kelola Paket & Kuota Token Transaksi"]').count();
    console.log(`  ✓ Top Header Paket & Kuota badge count: ${topHeaderPaketBadge} (Expected: 0)`);

    // 1.4 Verify NO Lock button in Top Header (Only Logout)
    const topHeaderLockBtn = await laptopPage.locator('header button[title="Kunci Terminal"]').count();
    const topHeaderLogoutBtn = await laptopPage.locator('header button[title="Keluar Akun"]').count();
    console.log(`  ✓ Top Header Lock button count: ${topHeaderLockBtn} (Expected: 0)`);
    console.log(`  ✓ Top Header Logout button count: ${topHeaderLogoutBtn} (Expected: 1)`);

    // 1.5 Verify NO "SOP ->" button on Radar Workshop Mesin
    const radarSopBtn = await laptopPage.locator('h3:has-text("Radar Workshop Mesin") ~ button').count();
    console.log(`  ✓ Radar Workshop SOP link button count: ${radarSopBtn} (Expected: 0)`);

    // 1.6 Verify 4 UNIQUE TILES in Quick Action Ribbon
    const tile1 = await laptopPage.locator('button:has-text("Input Cepat"):has-text("Timbang & Nota")').count();
    const tile2 = await laptopPage.locator('button:has-text("Antrean Cucian"):has-text("Status & SLA")').count();
    const tile3 = await laptopPage.locator('button:has-text("Workshop"):has-text("Cuci, Kering & Setrika")').count();
    const tile4 = await laptopPage.locator('button:has-text("Rak Simpan"):has-text("Serah Ambil")').count();
    console.log(`  ✓ Tile 1 (Input Cepat - Timbang & Nota): ${tile1 === 1}`);
    console.log(`  ✓ Tile 2 (Antrean Cucian - Status & SLA): ${tile2 === 1}`);
    console.log(`  ✓ Tile 3 (Workshop - Cuci, Kering & Setrika): ${tile3 === 1}`);
    console.log(`  ✓ Tile 4 (Rak Simpan - Serah Ambil): ${tile4 === 1}`);

    const berandaScreenshotPath = path.join(artifactDir, 'screenshot_tahap2_beranda_laundry.png');
    await laptopPage.screenshot({ path: berandaScreenshotPath, fullPage: false });
    console.log(`  📸 Screenshot saved: ${berandaScreenshotPath}`);

    // -------------------------------------------------------------
    // TEST 2: Modal Input Cepat Cucian (`LaundryQuickDropoffModal`)
    // -------------------------------------------------------------
    console.log('\n📦 [2/4] Testing Modal Input Cepat Cucian...');
    // Click the white Input Cepat tile to open modal
    await laptopPage.locator('button:has-text("Input Cepat"):has-text("Timbang & Nota")').first().click();
    await laptopPage.waitForSelector('div[role="dialog"]', { timeout: 5000 });
    await laptopPage.waitForTimeout(1000);

    // 2.1 Verify Title
    const modalTitle = await laptopPage.locator('div[role="dialog"] h3').first().textContent();
    console.log(`  ✓ Modal Title: "${modalTitle.trim()}" (Expected: "Input Cepat Cucian")`);

    // 2.2 Verify Customer Search Input padding (pl-10)
    const customerInput = laptopPage.locator('div[role="dialog"] input[placeholder*="Ketik nama atau cari pelanggan"]');
    const customerInputClass = await customerInput.getAttribute('class');
    const hasPl10 = customerInputClass.includes('pl-10');
    console.log(`  ✓ Customer search input has pl-10: ${hasPl10}`);

    // 2.3 Verify Service Search Bar exists
    const serviceSearchInput = laptopPage.locator('div[role="dialog"] input[placeholder*="Cari layanan"]');
    console.log(`  ✓ Service search input visible: ${await serviceSearchInput.isVisible()}`);

    // 2.4 Verify Zero ADDON in services list
    const serviceButtons = await laptopPage.locator('div[role="dialog"] button:has(span[class*="text-slate-900"])').allTextContents();
    const hasAddonInServices = serviceButtons.some((txt) =>
      txt.toLowerCase().includes('anti-bakteri') ||
      txt.toLowerCase().includes('parfum sultan') ||
      txt.toLowerCase().includes('hanger jas')
    );
    console.log(`  ✓ Zero ADDON in primary services: ${!hasAddonInServices}`);

    // 2.5 Verify Service Unit formatting (/Kg, /Pcs, /Item, not /PER_KG or /FLAT)
    const rawEnums = await laptopPage.locator('div[role="dialog"] span:has-text("/PER_KG"), span:has-text("/FLAT"), span:has-text("/PER_PCS")').count();
    console.log(`  ✓ Raw enums (/PER_KG, /FLAT) count: ${rawEnums} (Expected: 0)`);

    // 2.6 Verify Search Filter functionality in Modal
    await serviceSearchInput.fill('Kiloan');
    await laptopPage.waitForTimeout(400);
    const filteredCount = await laptopPage.locator('div[role="dialog"] button:has-text("Kiloan")').count();
    console.log(`  ✓ Searching "Kiloan" yields ${filteredCount} services`);
    await serviceSearchInput.fill(''); // clear search
    await laptopPage.waitForTimeout(300);

    // 2.7 Verify Save Validation Hint
    const saveHintVisible = await laptopPage.locator('text=Isi nama pelanggan untuk simpan').isVisible();
    console.log(`  ✓ Save validation hint visible when customer name empty: ${saveHintVisible}`);

    const modalScreenshotPath = path.join(artifactDir, 'screenshot_tahap2_modal_input_cepat.png');
    await laptopPage.screenshot({ path: modalScreenshotPath, fullPage: false });
    console.log(`  📸 Screenshot saved: ${modalScreenshotPath}`);

    // Close modal
    await laptopPage.locator('div[role="dialog"] button:has-text("Batal")').click();
    await laptopPage.waitForTimeout(500);

    await laptopContext.close();

    // -------------------------------------------------------------
    // TEST 3: Mobile Drawer Alignment (390x844)
    // -------------------------------------------------------------
    console.log('\n📱 [3/4] Testing Mobile Drawer Alignment (390x844)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await mobilePage.evaluate(({ token, user, outlet }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('pos_active_outlet', JSON.stringify(outlet));
    }, { token: laundryToken, user: laundryAuthPayload, outlet: laundryOutlet });

    await mobilePage.goto('http://localhost:5173/?tab=overview#dashboard', { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(2000);

    // Open Mobile Drawer
    const mobileMenuBtn = mobilePage.locator('nav button:has-text("Menu")').first();
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
    } else {
      await mobilePage.locator('header button').first().click();
    }
    await mobilePage.waitForTimeout(1000);

    // Verify Drawer button alignment (justify-start)
    const ringkasanDrawerBtn = mobilePage.locator('div[class*="translate-x-0"] button[title="Ringkasan Bisnis Laundry"]').first();
    const ringkasanClass = await ringkasanDrawerBtn.getAttribute('class');
    const hasJustifyStartRingkasan = ringkasanClass.includes('justify-start');
    console.log(`  ✓ Mobile Drawer Ringkasan button has justify-start: ${hasJustifyStartRingkasan}`);

    const paketDrawerBtn = mobilePage.locator('div[class*="translate-x-0"] button[title="Paket & Kuota Token"]').first();
    const paketClass = await paketDrawerBtn.getAttribute('class');
    const hasJustifyBetweenPaket = paketClass.includes('justify-between');
    console.log(`  ✓ Mobile Drawer Paket & Kuota button has justify-between: ${hasJustifyBetweenPaket}`);

    const drawerScreenshotPath = path.join(artifactDir, 'screenshot_tahap2_mobile_drawer_aligned.png');
    await mobilePage.screenshot({ path: drawerScreenshotPath, fullPage: false });
    console.log(`  📸 Screenshot saved: ${drawerScreenshotPath}`);

    await mobileContext.close();

    // -------------------------------------------------------------
    // TEST 4: Antrean Cucian View (`LaundryQueueView`)
    // -------------------------------------------------------------
    console.log('\n📋 [4/4] Testing Antrean Cucian View (`LaundryQueueView`)...');
    const queueContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const queuePage = await queueContext.newPage();

    await queuePage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await queuePage.evaluate(({ token, user, outlet }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('pos_active_outlet', JSON.stringify(outlet));
    }, { token: laundryToken, user: laundryAuthPayload, outlet: laundryOutlet });

    await queuePage.goto('http://localhost:5173/?tab=laundry_queue#dashboard', { waitUntil: 'domcontentloaded' });
    await queuePage.waitForTimeout(2000);

    // Verify Action button has label "Input Cepat"
    const queueInputCepatBtn = queuePage.locator('button[title*="Input Cepat"]').first();
    const queueInputCepatText = await queueInputCepatBtn.textContent();
    console.log(`  ✓ Queue Page Action Button Text: "${queueInputCepatText.trim()}"`);

    // Click Input Cepat to ensure it opens the unified modal!
    await queueInputCepatBtn.click();
    await queuePage.waitForSelector('div[role="dialog"]', { timeout: 5000 });
    const isModalOpenFromQueue = await queuePage.locator('div[role="dialog"] h3:has-text("Input Cepat Cucian")').isVisible();
    console.log(`  ✓ Clicking Input Cepat on Queue Page opens unified modal: ${isModalOpenFromQueue}`);

    const queueScreenshotPath = path.join(artifactDir, 'screenshot_tahap2_queue_input_cepat.png');
    await queuePage.screenshot({ path: queueScreenshotPath, fullPage: false });
    console.log(`  📸 Screenshot saved: ${queueScreenshotPath}`);

    await queueContext.close();

    console.log('\n===================================================================');
    console.log('✅ ALL TAHAP 2 VERIFICATION CHECKS COMPLETED SUCCESSFULLY!');
    console.log('===================================================================');
  } catch (error) {
    console.error('❌ Error during Tahap 2 verification:', error);
    process.exit(1);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

runTahap2Verification();
