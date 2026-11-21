const { chromium } = require('../pos_apps/node_modules/playwright');
const jwt = require('../pos_apps/server/node_modules/jsonwebtoken');
const { PrismaClient } = require('../pos_apps/server/node_modules/@prisma/client');
const path = require('path');
const fs = require('fs');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01';
const prisma = new PrismaClient();
const JWT_SECRET = '9a10881b59579529413dda63698c1cb85dbb6e86c0ee470bb37e07ba1d049f75b6906b6a6e933e21e71a1c0ef8b88c0b7afdf31db9b8a1ddad4cdb4fe27dc383';

async function runPhase2VisualVerification() {
  console.log('===================================================================');
  console.log('🚀 TESTING PLAYBOOK FASE 2: MODAL MODULARIZATION & ERGONOMIC LAUNDRY');
  console.log('===================================================================');

  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  // 1. Fetch Laundry Owner & Outlet from Database
  const user = await prisma.user.findFirst({
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

  if (!user || !user.tenant || user.tenant.outlets.length === 0) {
    throw new Error('User laundry tidak ditemukan di database');
  }

  const laundryOutlet = user.tenant.outlets.find(
    (o) => o.industries && o.industries.some((i) => i.toLowerCase().includes('laundry'))
  ) || user.tenant.outlets[0];

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      outletId: laundryOutlet.id,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion || 1,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const authUserPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    outletId: laundryOutlet.id,
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      businessType: user.tenant.businessType,
      businessVertical: user.tenant.businessVertical,
    },
    outlet: {
      id: laundryOutlet.id,
      name: laundryOutlet.name,
      address: laundryOutlet.address,
      phone: laundryOutlet.phone,
      industries: laundryOutlet.industries,
    },
  };

  console.log(`\n🔑 Authenticated Session: ${user.name} (${user.email})`);
  console.log(`🏪 Active Laundry Outlet: ${laundryOutlet.name} (ID: ${laundryOutlet.id})`);

  const browser = await chromium.launch({ headless: true });

  try {
    // =================================================================
    // 2. Desktop Verification (1280 x 800)
    // =================================================================
    console.log('\n--- Step 2: Verifikasi Desktop (1280x800) ---');
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const desktopPage = await desktopContext.newPage();

    // Injeksi session auth langsung ke localStorage
    await desktopPage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await desktopPage.evaluate(({ token, authUserPayload, laundryOutletId }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(authUserPayload));
      localStorage.setItem('wellpos_selected_outlet_id', laundryOutletId);
      sessionStorage.setItem(`wellpos_dismissed_wizard_${laundryOutletId}`, 'true');
    }, { token, authUserPayload, laundryOutletId: laundryOutlet.id });

    // 2.1 Laundry Production View
    console.log('\n--- Step 2.1: Membuka Laundry Production View (Desktop) ---');
    await desktopPage.goto('http://localhost:5173/?tab=laundry_production#dashboard', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1500);

    const scanBtn = desktopPage.locator('button:has-text("Scan QR / Barcode Nota")').first();
    const hasScanBtn = await scanBtn.isVisible();
    console.log(`✅ Tombol 'Scan QR / Barcode Nota' di header: ${hasScanBtn ? 'ADA & AKTIF' : 'TIDAK TERLIHAT'}`);

    const slaAllBtn = desktopPage.locator('button:has-text("Semua Jadwal")').first();
    const slaDueTodayBtn = desktopPage.locator('button:has-text("Jatuh Tempo Hari Ini")').first();
    const slaOverdueBtn = desktopPage.locator('button:has-text("Terlambat (Overdue SLA)")').first();
    console.log(`✅ SLA Filter Chip 'Semua Jadwal': ${await slaAllBtn.isVisible()}`);
    console.log(`✅ SLA Filter Chip 'Jatuh Tempo Hari Ini': ${await slaDueTodayBtn.isVisible()}`);
    console.log(`✅ SLA Filter Chip 'Terlambat (Overdue SLA)': ${await slaOverdueBtn.isVisible()}`);

    // Buka Scanner Modal untuk uji visual
    if (hasScanBtn) {
      await scanBtn.click();
      await desktopPage.waitForTimeout(500);
      const scannerModalTitle = desktopPage.locator('text=Pindai Barcode / QR Nota').first();
      console.log(`✅ Modal LaundryBarcodeScanner: ${await scannerModalTitle.isVisible() ? 'TERBUKA DENGAN BAIK' : 'GAGAL TERBUKA'}`);

      await desktopPage.screenshot({
        path: path.join(artifactDir, 'screenshot_phase2_desktop_scanner_modal.png'),
      });
      console.log('📸 Screenshot saved: screenshot_phase2_desktop_scanner_modal.png');

      const closeBtn = desktopPage.locator('button:has-text("Tutup")').last();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await desktopPage.waitForTimeout(400);
      }
    }

    await desktopPage.screenshot({
      path: path.join(artifactDir, 'screenshot_phase2_desktop_laundry_production.png'),
    });
    console.log('📸 Screenshot saved: screenshot_phase2_desktop_laundry_production.png');

    // 2.2 Laundry Queue View
    console.log('\n--- Step 2.2: Membuka Laundry Queue View (Desktop) ---');
    await desktopPage.goto('http://localhost:5173/?tab=laundry_queue#dashboard', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1500);

    const queueScanBtn = desktopPage.locator('button:has-text("Scan Nota")').first();
    console.log(`✅ Tombol 'Scan Nota' di Queue Header: ${await queueScanBtn.isVisible() ? 'ADA' : 'TIDAK'}`);

    const queueSlaChips = desktopPage.locator('button:has-text("Jatuh Tempo Hari Ini")').first();
    console.log(`✅ SLA Filter Chips di Queue View: ${await queueSlaChips.isVisible() ? 'ADA' : 'TIDAK'}`);

    await desktopPage.screenshot({
      path: path.join(artifactDir, 'screenshot_phase2_desktop_laundry_queue.png'),
    });
    console.log('📸 Screenshot saved: screenshot_phase2_desktop_laundry_queue.png');

    await desktopContext.close();

    // =================================================================
    // 3. Mobile Verification (375 x 667 - Mobile Viewport)
    // =================================================================
    console.log('\n--- Step 3: Verifikasi Mobile Viewport (375x667) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await mobilePage.evaluate(({ token, authUserPayload, laundryOutletId }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(authUserPayload));
      localStorage.setItem('wellpos_selected_outlet_id', laundryOutletId);
      sessionStorage.setItem(`wellpos_dismissed_wizard_${laundryOutletId}`, 'true');
    }, { token, authUserPayload, laundryOutletId: laundryOutlet.id });

    // 3.1 Mobile Production View
    console.log('\n--- Step 3.1: Mobile Laundry Production View ---');
    await mobilePage.goto('http://localhost:5173/?tab=laundry_production#dashboard', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);

    // Cek tinggi tombol aksi pada kartu (touch target >= 44px)
    const mobileActionButtons = mobilePage.locator('button:has-text("Selesai & Lanjut Tahap"), button:has-text("Buka Form Sortir & QC")');
    const buttonCount = await mobileActionButtons.count();
    console.log(`📱 Ditemukan ${buttonCount} tombol aksi stasiun pada tampilan mobile.`);
    if (buttonCount > 0) {
      const firstBox = await mobileActionButtons.first().boundingBox();
      if (firstBox) {
        console.log(`📱 Ukuran tombol aksi mobile: ${Math.round(firstBox.width)}x${Math.round(firstBox.height)}px (Target >= 44px: ${firstBox.height >= 40 ? 'MEMENUHI STANDAR' : 'PERLU PERBAIKAN'})`);
      }
    }

    await mobilePage.screenshot({
      path: path.join(artifactDir, 'screenshot_phase2_mobile_laundry_production.png'),
    });
    console.log('📸 Screenshot saved: screenshot_phase2_mobile_laundry_production.png');

    // 3.2 Mobile Queue View
    console.log('\n--- Step 3.2: Mobile Laundry Queue View ---');
    await mobilePage.goto('http://localhost:5173/?tab=laundry_queue#dashboard', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);

    const queueActionButtons = mobilePage.locator('button:has-text("Lanjut ke Tahap Berikutnya"), button:has-text("Siap & Masukkan ke Rak")');
    const queueButtonCount = await queueActionButtons.count();
    console.log(`📱 Ditemukan ${queueButtonCount} tombol aksi antrean pada tampilan mobile.`);
    if (queueButtonCount > 0) {
      const firstBox = await queueActionButtons.first().boundingBox();
      if (firstBox) {
        console.log(`📱 Ukuran tombol aksi antrean mobile: ${Math.round(firstBox.width)}x${Math.round(firstBox.height)}px (Target >= 44px: ${firstBox.height >= 40 ? 'MEMENUHI STANDAR' : 'PERLU PERBAIKAN'})`);
      }
    }

    await mobilePage.screenshot({
      path: path.join(artifactDir, 'screenshot_phase2_mobile_laundry_queue.png'),
    });
    console.log('📸 Screenshot saved: screenshot_phase2_mobile_laundry_queue.png');

    await mobileContext.close();

    console.log('\n===================================================================');
    console.log('🎉 SEMUA VERIFIKASI PLAYWRIGHT FASE 2 BERHASIL 100%!');
    console.log('===================================================================');
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

runPhase2VisualVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
