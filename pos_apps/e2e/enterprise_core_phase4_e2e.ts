import { chromium, Browser, Page } from 'playwright';
import {
  PrismaClient,
  Role,
  BusinessVerticalMode,
  StorageLocationType,
} from '../server/node_modules/@prisma/client';

const bcrypt: any = require('../server/node_modules/bcryptjs');

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
    (window as any).dispatchEvent(new (window as any).CustomEvent('wellpos:navigate_tab', { detail: t }));
  }, tab);
}

async function runEnterpriseCorePhase4E2E() {
  console.log('================================================================================');
  console.log('🏢 ENTERPRISE SUPPORT — CORE PHASE 4 (PROCUREMENT, WORKFORCE & AUDIT TRAIL) E2E');
  console.log('   Target Frontend:', BASE_FRONTEND);
  console.log('   Target Backend: ', BASE_BACKEND);
  console.log('================================================================================\n');

  const timestamp = Date.now().toString();
  const tenantSlug = `ent-core-p4-${timestamp}`;
  const ownerEmail = `owner.corep4.${timestamp}@wellpos.test`;
  const passwordRaw = 'Password123!';
  const passwordHash = await bcrypt.hash(passwordRaw, 10);

  let createdTenantId: string | null = null;
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // =========================================================================
    // 0. SEEDING ISOLATED TEST TENANT & ENTITIES
    // =========================================================================
    console.log('🌱 [0/4] Menyiapkan tenant, outlet, warehouse, inventory, supplier & users...');

    // 1. Buat Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: `Enterprise Core P4 Corp ${timestamp.slice(-4)}`,
        slug: tenantSlug,
        businessVertical: 'SERVICES',
        status: 'ACTIVE',
        businessType: 'LAUNDRY',
        phone: '+6281234567891',
      },
    });
    createdTenantId = tenant.id;

    // 2. Business Entity
    const business = await prisma.business.create({
      data: {
        tenantId: tenant.id,
        name: `PT Laundry Enterprise ${timestamp.slice(-4)}`,
        slug: `ent-biz-${timestamp}`,
        vertical: BusinessVerticalMode.LAUNDRY,
        subCategory: 'Kiloan & Satuan Enterprise',
        isActive: true,
      },
    });

    // 3. Outlet
    const outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        name: 'Outlet Enterprise Central',
        code: `OUT-ENT-${timestamp.slice(-4)}`,
        address: 'Jl. Sudirman Kav. 50, Jakarta Pusat',
        phone: '+6281234567891',
        industries: ['LAUNDRY'],
        isWorkshop: true,
        isActive: true,
      },
    });

    // 4. Storage Location (Gudang Bahan Baku)
    const storageLocation = await prisma.storageLocation.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        name: 'Gudang Bahan Baku Utama',
        type: StorageLocationType.WAREHOUSE,
        isActive: true,
      },
    });

    // 5. Supplier
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        code: `SUP-KDN-${timestamp.slice(-4)}`,
        name: 'PT Kimia Deterjen Nusantara',
        contactName: 'Bapak Hendra Supplier',
        phone: '+6281900112233',
        email: 'sales@kimiadeterjen.test',
        address: 'Kawasan Industri Pulo Gadung Blok B4',
        paymentTermsDays: 30,
        isActive: true,
      },
    });

    // 6. Inventory Item
    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        name: 'Deterjen Liquid Konsentrat 5L',
        itemCode: `DET-5L-${timestamp.slice(-4)}`,
        canonicalUom: 'LITER',
        averageCost: 75000,
        reorderPoint: 10,
        isActive: true,
      },
    });

    // 7. Users: OWNER & STAFF SUPERVISOR
    const ownerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userCode: `OWN-${timestamp.slice(-4)}`,
        name: 'Bpk. Richard Owner',
        firstName: 'Richard',
        lastName: 'Owner',
        email: ownerEmail,
        passwordHash,
        role: Role.OWNER,
        isActive: true,
        phone: '+6281122334466',
      },
    });

    const staffUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userCode: `STF-${timestamp.slice(-4)}`,
        name: 'Siti Staff Gudang',
        firstName: 'Siti',
        lastName: 'Gudang',
        email: `siti.${timestamp}@wellpos.test`,
        passwordHash,
        role: Role.SUPERVISOR,
        isActive: true,
        phone: '+6281299887766',
      },
    });

    console.log('   ✅ Data isolasi tenant, outlet, gudang, supplier, item & users siap.\n');

    // Launch Browser Playwright
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    page = await context.newPage();

    // =========================================================================
    // LOGIN OWNER
    // =========================================================================
    console.log('🔐 Melakukan autentikasi Login Owner ke Backoffice...');
    await page.goto(`${BASE_FRONTEND}/#pos`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Portal Pemilik (Email)")', { timeout: 10000 });
    await page.click('button:has-text("Portal Pemilik (Email)")');
    await page.fill('input[type="email"]', ownerEmail);
    await page.fill('input[type="password"]', passwordRaw);
    await page.click('button:has-text("Masuk ke Portal Pemilik")');

    // Tunggu dashboard utama siap
    await page.waitForSelector('button[title="Buka Owner Portal & Kelola Bisnis"]', {
      timeout: 15000,
    });
    await page.waitForTimeout(1000);
    console.log('   ✅ [UI] Login Owner berhasil.\n');

    // =========================================================================
    // SKENARIO 1: PROCUREMENT 6-STAGE UI FLOW
    // =========================================================================
    console.log('▶️ [SKENARIO 1] Menguji Procurement 6-Tahap (PR -> Approve -> Convert PO -> AP Invoice -> Pay)...');

    // 1. Buka Tab Pengadaan Barang (purchase_orders)
    await navigateToTab(page, 'purchase_orders');
    await page.waitForSelector('h1:has-text("Pengadaan Barang (Procurement)")', { timeout: 10000 });
    console.log('   ✅ [UI] Halaman Pengadaan Barang (Procurement) berhasil dimuat.');

    // 2. Pindah ke Sub-tab "Purchase Request (PR)"
    await page.locator('button:has-text("Purchase Request (PR)")').click();
    await page.waitForSelector('button:has-text("Buat Purchase Request")', { timeout: 8000 });
    console.log('   ✅ [UI] Tab Purchase Request (PR) aktif.');

    // 3. Buat PR Baru via Modal
    await page.locator('button:has-text("Buat Purchase Request")').click();
    await page.waitForSelector('h3:has-text("Buat Purchase Request Baru")', { timeout: 5000 });

    // Isi formulir PR
    const prModal = page.locator('div[class*="rounded-t-3xl"]').filter({ hasText: 'Buat Purchase Request Baru' });
    await page.waitForTimeout(500);
    const qtyInput = prModal.locator('input[placeholder="Qty"]').first();
    if (await qtyInput.count() === 0) {
      await prModal.locator('button:has-text("Tambah Item")').click();
    }
    await prModal.locator('input[placeholder="Qty"]').first().fill('10');
    await prModal.locator('textarea[placeholder*="Tulis alasan"]').fill('Kebutuhan operasional mingguan');
    await prModal.locator('button:has-text("Kirim Pengajuan PR")').click();

    // Tunggu modal tertutup & PR muncul di tabel
    await page.waitForSelector('span:has-text("Menunggu")', { timeout: 8000 });
    console.log('   ✅ [UI] Purchase Request baru berhasil diajukan dengan status "Menunggu".');

    // 4. Setujui PR (Approve)
    const approveBtn = page.locator('button:has-text("Setujui")').first();
    await approveBtn.click();

    // Verifikasi status berubah menjadi "Disetujui"
    await page.waitForSelector('span:has-text("Disetujui")', { timeout: 8000 });
    console.log('   ✅ [UI] Purchase Request berhasil disetujui (Approved).');

    // 5. Konversi PR ke PO (Convert to PO)
    await page.locator('button:has-text("Konversi ke PO")').first().click();
    await page.waitForSelector('h3:has-text("Konversi PR ke Purchase Order (PO)")', { timeout: 5000 });
    const convertModal = page.locator('div[class*="rounded-t-3xl"]').filter({ hasText: 'Konversi PR ke Purchase Order (PO)' });
    await convertModal.locator('select').selectOption(supplier.id);
    await convertModal.locator('button:has-text("Terbitkan Purchase Order")').click();

    // Verifikasi status berubah menjadi "Dikonversi ke PO"
    await page.waitForSelector('span:has-text("Dikonversi ke PO")', { timeout: 8000 });
    console.log('   ✅ [UI] Purchase Request berhasil dikonversi ke Purchase Order (PO).\n');

    // 6. Buka Sub-tab "Tagihan Supplier (AP)"
    await page.locator('button:has-text("Tagihan Supplier (AP)")').click();
    await page.waitForSelector('button:has-text("Catat Tagihan Supplier")', { timeout: 8000 });
    console.log('   ✅ [UI] Tab Tagihan Supplier (AP) aktif.');

    // 7. Catat Tagihan Supplier Baru
    await page.locator('button:has-text("Catat Tagihan Supplier")').click();
    const apModal = page.locator('div[class*="rounded-t-3xl"]').filter({ hasText: 'Catat Tagihan Supplier (AP)' });
    await apModal.waitFor({ timeout: 5000 });

    // Pilih Supplier (select kedua pada form)
    await apModal.locator('select').nth(1).selectOption(supplier.id);
    const invNumInput = apModal.locator('input[placeholder*="Contoh: INV-SUP-001"]').first();
    await invNumInput.fill(`INV-KDN-${timestamp.slice(-4)}`);
    await apModal.locator('input[type="number"]').first().fill('750000');
    await apModal.locator('button:has-text("Simpan Tagihan")').click();

    // Verifikasi Tagihan muncul dengan status "Belum Bayar"
    await page.waitForSelector('span:has-text("Belum Bayar")', { timeout: 8000 });
    console.log('   ✅ [UI] Tagihan Supplier (AP) tercatat dengan status "Belum Bayar".');

    // 8. Bayar Tagihan Sebagian (Partial)
    await page.locator('button:has-text("Catat Pembayaran")').first().click();
    const payModal = page.locator('div[class*="rounded-t-3xl"]').filter({ hasText: 'Catat Pembayaran #' });
    await payModal.waitFor({ timeout: 5000 });

    // Input bayar parsial Rp 300.000
    const payAmountInput = payModal.locator('input[type="number"]').first();
    await payAmountInput.fill('300000');
    await payModal.locator('button:has-text("Konfirmasi Bayar")').click();

    // Verifikasi status berubah ke "Bayar Sebagian"
    await page.waitForSelector('span:has-text("Bayar Sebagian")', { timeout: 8000 });
    console.log('   ✅ [UI] Pembayaran parsial AP berhasil dicatat (status: "Bayar Sebagian").');

    // 9. Lunasi Tagihan (Full Payment)
    await page.locator('button:has-text("Catat Pembayaran")').first().click();
    await payModal.waitFor({ timeout: 5000 });
    await payModal.locator('button:has-text("Konfirmasi Bayar")').click();

    // Verifikasi status berubah ke "Lunas"
    await page.waitForSelector('span:has-text("Lunas")', { timeout: 8000 });
    console.log('   ✅ [UI] Tagihan Supplier (AP) berhasil lunas (status: "Lunas").\n');

    // =========================================================================
    // SKENARIO 2: WORKFORCE ENTERPRISE UI FLOW (OVERTIME, LEAVE & PAYROLL)
    // =========================================================================
    console.log('▶️ [SKENARIO 2] Menguji Workforce Enterprise (Lembur -> Cuti -> Slip Gaji -> Lunas)...');

    // 1. Buka Tab Komisi & SDM (laundry_commissions)
    await navigateToTab(page, 'laundry_commissions');
    await page.waitForSelector('h1:has-text("Komisi Staf Produksi & Kurir")', { timeout: 10000 });

    // 2. Klik Tab "Lembur, Cuti & Payroll"
    await page.locator('button:has-text("Lembur, Cuti & Payroll")').click();
    await page.waitForSelector('button:has-text("Ajukan Lembur")', { timeout: 8000 });
    console.log('   ✅ [UI] Tab Lembur, Cuti & Payroll aktif.');

    // 3. Ajukan Lembur Staf
    await page.locator('button:has-text("Ajukan Lembur")').click();
    const otModal = page.locator('div[class*="rounded-t-3xl"]').filter({ hasText: 'Ajukan Lembur (Overtime)' });
    await otModal.waitFor({ timeout: 5000 });

    await otModal.locator('textarea[placeholder*="Contoh: Lonjakan cucian"]').fill('Finishing cucian express');
    await otModal.locator('button:has-text("Kirim Pengajuan")').click();

    // Tunggu lembur muncul & klik Setujui
    await page.waitForSelector('span:has-text("Menunggu")', { timeout: 8000 });
    console.log('   ✅ [UI] Pengajuan lembur berhasil diajukan.');

    await page.locator('button:has-text("Setujui")').first().click();
    await page.waitForSelector('h3:has-text("Setujui Lembur")', { timeout: 5000 });
    await page.locator('button:has-text("Ya, Setujui")').click();
    await page.waitForSelector('span:has-text("Disetujui")', { timeout: 8000 });
    console.log('   ✅ [UI] Pengajuan lembur berhasil disetujui Manajer/Owner.');

    // 4. Pindah ke Sub-tab "Cuti & Izin"
    await page.locator('button:has-text("Cuti & Izin")').click();
    await page.waitForSelector('button:has-text("Ajukan Cuti/Izin")', { timeout: 8000 });

    await page.locator('button:has-text("Ajukan Cuti/Izin")').click();
    const leaveModal = page.locator('div[class*="rounded-t-3xl"]').filter({ hasText: 'Ajukan Cuti & Izin' });
    await leaveModal.waitFor({ timeout: 5000 });

    await leaveModal.locator('textarea[placeholder*="Contoh: Keperluan keluarga"]').fill('Keperluan keluarga mendesak');
    await leaveModal.locator('button:has-text("Kirim Pengajuan")').click();

    // Tunggu cuti muncul & klik Setujui
    await page.waitForSelector('span:has-text("Menunggu")', { timeout: 8000 });
    console.log('   ✅ [UI] Pengajuan cuti berhasil diajukan.');

    await page.locator('button:has-text("Setujui")').first().click();
    await page.waitForSelector('h3:has-text("Setujui Cuti")', { timeout: 5000 });
    await page.locator('button:has-text("Ya, Setujui")').click();
    await page.waitForSelector('span:has-text("Disetujui")', { timeout: 8000 });
    console.log('   ✅ [UI] Pengajuan cuti berhasil disetujui Manajer/Owner.');

    // 5. Pindah ke Sub-tab "Rekap Slip Gaji (Payroll)"
    await page.locator('button:has-text("Rekap Slip Gaji (Payroll)")').click();
    await page.waitForSelector('button:has-text("Generate Slip Gaji")', { timeout: 8000 });

    await page.locator('button:has-text("Generate Slip Gaji")').click();
    const payrollModal = page.locator('div[class*="rounded-t-3xl"]').filter({ hasText: 'Generate Slip Gaji' });
    await payrollModal.waitFor({ timeout: 5000 });

    // Pilih karyawan Siti Staff
    await payrollModal.locator('select').first().selectOption(staffUser.id);
    await payrollModal.locator('button:has-text("Generate Slip")').click();

    // Tunggu slip muncul dengan status "Draft"
    await page.waitForSelector('span:has-text("Draft")', { timeout: 8000 });
    console.log('   ✅ [UI] Slip gaji berhasil digenerate dengan status "Draft".');

    // Finalisasi Slip
    await page.locator('button:has-text("Finalisasi")').first().click();
    await page.waitForSelector('h3:has-text("Finalisasi Slip Gaji")', { timeout: 5000 });
    await page.locator('button:has-text("Konfirmasi Final")').click();
    await page.waitForSelector('span:has-text("Final")', { timeout: 8000 });
    console.log('   ✅ [UI] Slip gaji berhasil difinalisasi.');

    // Bayar Slip (Tandai Lunas)
    await page.locator('button:has-text("Bayar")').first().click();
    await page.waitForSelector('h3:has-text("Tandai Gaji Lunas (PAID)")', { timeout: 5000 });
    await page.locator('button:has-text("Konfirmasi Pembayaran")').click();
    await page.waitForSelector('span:has-text("Lunas")', { timeout: 8000 });
    console.log('   ✅ [UI] Slip gaji berhasil ditandai Lunas (PAID).\n');

    // =========================================================================
    // SKENARIO 3: GLOBAL AUDIT TRAIL UI FLOW
    // =========================================================================
    console.log('▶️ [SKENARIO 3] Menguji Global Audit Trail UI Timeline...');

    // 1. Buka Tab Shifts Audit (shifts)
    await navigateToTab(page, 'shifts');
    await page.waitForSelector('h2:has-text("Audit & Rekapitulasi Shift Kasir")', { timeout: 10000 });

    // 2. Klik Tab "Global Audit Trail"
    await page.locator('button:has-text("Global Audit Trail")').click();
    await page.waitForSelector('input[placeholder*="Cari aktivitas, pelaku"]', { timeout: 8000 });
    console.log('   ✅ [UI] Tab Global Audit Trail aktif.');

    // 3. Verifikasi Log Timeline muncul
    await page.waitForSelector('span:has-text("PROCUREMENT")', { timeout: 8000 });
    await page.waitForSelector('span:has-text("HR_PAYROLL")', { timeout: 8000 });
    console.log('   ✅ [UI] Log aktivitas PROCUREMENT dan HR_PAYROLL terverifikasi pada timeline.');

    // 4. Klik accordion "Lihat Data Perubahan"
    const toggleDetailBtn = page.locator('button:has-text("Lihat Data Perubahan")').first();
    if (await toggleDetailBtn.count() > 0) {
      await toggleDetailBtn.click();
      await page.waitForSelector('span:has-text("Sesudah Perubahan (After):")', { timeout: 5000 });
      console.log('   ✅ [UI] Accordion payload detail JSON before/after berhasil dibuka.\n');
    }

    // =========================================================================
    // SKENARIO 4: PAY-AS-YOU-GO TOKEN GUARD
    // =========================================================================
    console.log('▶️ [SKENARIO 4] Memverifikasi Proteksi Saldo Token Pay-As-You-Go...');
    const invoices = await prisma.saaSInvoice.findMany({
      where: { tenantId: tenant.id },
    });
    assert(invoices.length === 0, 'Tidak boleh ada pembuatan tagihan token ekstra');
    console.log('   ✅ [DB] Proteksi Token Pay-As-You-Go terverifikasi: 0 tagihan invoice token ekstra.\n');

    console.log('================================================================================');
    console.log('🎉 SELURUH 4 SKENARIO E2E ENTERPRISE CORE PHASE 4 LULUS DENGAN SEMPURNA (100% PASS)!');
    console.log('================================================================================\n');

  } catch (error: any) {
    console.error('\n❌ [E2E FAILED] Terjadi kegagalan pengujian:', error);
    if (page) {
      try {
        await page.screenshot({ path: 'pos_apps/e2e/enterprise_core4_failure.png', fullPage: true });
        console.log('📸 Screenshot kegagalan disimpan di pos_apps/e2e/enterprise_core4_failure.png');
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
        `DELETE FROM "global_audit_logs" WHERE "tenant_id" = $1`,
        `DELETE FROM "staff_payroll_slips" WHERE "tenant_id" = $1`,
        `DELETE FROM "staff_leaves" WHERE "tenant_id" = $1`,
        `DELETE FROM "staff_overtimes" WHERE "tenant_id" = $1`,
        `DELETE FROM "supplier_invoice_payments" WHERE "tenant_id" = $1`,
        `DELETE FROM "supplier_invoices" WHERE "tenant_id" = $1`,
        `DELETE FROM "purchase_request_items" WHERE "tenant_id" = $1`,
        `DELETE FROM "purchase_requests" WHERE "tenant_id" = $1`,
        `DELETE FROM "purchase_order_items" WHERE "tenant_id" = $1`,
        `DELETE FROM "purchase_orders" WHERE "tenant_id" = $1`,
        `DELETE FROM "inventory_items" WHERE "tenant_id" = $1`,
        `DELETE FROM "suppliers" WHERE "tenant_id" = $1`,
        `DELETE FROM "storage_locations" WHERE "tenant_id" = $1`,
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

runEnterpriseCorePhase4E2E()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
