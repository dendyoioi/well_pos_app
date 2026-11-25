/**
 * Test Suite: Owner Portal & Multi-Business Hub — Batch 1
 * (Database Schema Business, Idempotent Backfill, dan Backend API /api/businesses)
 * 
 * Menguji:
 * 1. Verifikasi Skema & Idempotent Backfill (seluruh outlet lama terhubung ke businesses)
 * 2. GET /api/businesses:
 *    - OWNER melihat seluruh bisnis milik tenant beserta outlets, totalActiveOutlets, dan totalValidOrders
 *    - ADMIN/SUPERVISOR terkunci pada bisnis milik outlet tempat mereka bertugas
 * 3. POST /api/businesses:
 *    - RBAC: Non-owner ditolak HTTP 403
 *    - OWNER membuat bisnis baru + initial outlet atomik (provisi default StorageLocation, default industries, isWorkshop)
 *    - Slug generation & collision handling (slug otomatis diberi suffix jika nama sama)
 * 4. PATCH /api/businesses/:id:
 *    - OWNER mengubah profil bisnis (name, subCategory, isActive)
 *    - Proteksi integritas: Perubahan vertical ditolak HTTP 400 jika bisnis sudah memiliki transaksi order aktif
 * 5. GET /api/businesses/token-summary:
 *    - OWNER melihat 1 dompet token bersama (totalPurchasedTokens, totalUsedTokens, remainingTokens, usageByBusiness, recentInvoices)
 *    - Non-owner ditolak HTTP 403
 * 6. Backward Compatibility /api/outlets:
 *    - GET /api/outlets?businessId=... memfilter outlet sesuai bisnis yang diminta
 *    - POST /api/outlets dengan businessId mengaitkan cabang baru ke bisnis dan mewarisi default industries
 * 7. Zero Database Residue (Pembersihan tuntas di blok finally)
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role, OrderStatus, PaymentStatus } from '@prisma/client';
import businessRouter from '../routes/business.routes';
import outletRouter from '../routes/outlet.routes';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING OWNER PORTAL BATCH 1 BACKEND API TESTS');
  console.log('====================================================');

  // Ambil owner user aktual dari DB
  const dbOwner = await prisma.user.findFirst({
    where: { role: Role.OWNER, isActive: true },
    include: { tenant: { include: { outlets: true } } },
  });

  assert(Boolean(dbOwner), 'Owner user must exist in DB');
  const tenant = dbOwner!.tenant;
  const existingOutlet = tenant.outlets[0];
  assert(Boolean(existingOutlet), 'Tenant harus memiliki minimal 1 outlet');

  const cleanup = {
    userIds: [] as string[],
    orderIds: [] as string[],
    outletIds: [] as string[],
    businessIds: [] as string[],
    storageLocationIds: [] as string[],
  };

  // Setup Express server transient
  const app = express();
  app.use(express.json());
  app.use('/api/businesses', businessRouter);
  app.use('/api/outlets', outletRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ----------------------------------------------------
    // SETUP USERS & TOKENS
    // ----------------------------------------------------
    const makeToken = (user: any) =>
      jwt.sign(
        {
          userId: user.id,
          role: user.role,
          outletId: user.outletId,
          tenantId: user.tenantId,
          tokenVersion: user.tokenVersion || 1,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

    const ownerToken = makeToken(dbOwner);

    // Buat User Admin & Supervisor sementara terikat ke existingOutlet
    const testAdminUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: existingOutlet.id,
        userCode: `ADM-${Date.now().toString().slice(-6)}`,
        name: 'Admin Test Portal QA',
        email: `admin.portal.${Date.now()}@wellpos.id`,
        role: Role.ADMIN,
        isActive: true,
        tokenVersion: 1,
      },
    });
    cleanup.userIds.push(testAdminUser.id);
    const adminToken = makeToken(testAdminUser);

    const testSpvUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: existingOutlet.id,
        userCode: `SPV-${Date.now().toString().slice(-6)}`,
        name: 'Supervisor Test Portal QA',
        email: `spv.portal.${Date.now()}@wellpos.id`,
        role: Role.SUPERVISOR,
        isActive: true,
        tokenVersion: 1,
      },
    });
    cleanup.userIds.push(testSpvUser.id);
    const spvToken = makeToken(testSpvUser);

    // ----------------------------------------------------
    // TEST 1: VERIFIKASI SKEMA & IDEMPOTENT BACKFILL
    // ----------------------------------------------------
    console.log('\n[TEST 1] Verifikasi Skema & Idempotent Backfill...');
    const unlinkedCount = await prisma.outlet.count({
      where: { tenantId: tenant.id, businessId: null },
    });
    assert(unlinkedCount === 0, `Seluruh outlet lama tenant harus memiliki businessId terisi (got ${unlinkedCount} null)`);
    console.log('  ✅ 100% outlet lama memiliki relasi valid ke businesses');

    // ----------------------------------------------------
    // TEST 2: GET /api/businesses & RBAC
    // ----------------------------------------------------
    console.log('\n[TEST 2] Menguji GET /api/businesses & RBAC Scoping...');
    
    // 2.1 Owner list businesses
    const ownerGetRes = await fetch(`${baseUrl}/api/businesses`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(ownerGetRes.status === 200, `Owner GET businesses harus 200, got: ${ownerGetRes.status}`);
    const ownerGetData = (await ownerGetRes.json()) as any;
    assert(ownerGetData.status === 'success', 'Response status harus success');
    assert(Array.isArray(ownerGetData.data), 'Data bisnis harus berupa array');
    assert(ownerGetData.data.length > 0, 'Tenant harus memiliki minimal 1 bisnis dari backfill');
    
    const firstBusiness = ownerGetData.data[0];
    assert(typeof firstBusiness.totalActiveOutlets === 'number', 'Field totalActiveOutlets harus ada');
    assert(typeof firstBusiness.totalValidOrders === 'number', 'Field totalValidOrders harus ada');
    console.log(`  ✅ Owner berhasil memuat ${ownerGetData.data.length} bisnis dengan metrik outlet & order`);

    // 2.2 Admin branch-restricted list businesses
    const adminGetRes = await fetch(`${baseUrl}/api/businesses`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminGetRes.status === 200, `Admin GET businesses harus 200, got: ${adminGetRes.status}`);
    const adminGetData = (await adminGetRes.json()) as any;
    // Admin yang terikat ke existingOutlet harus hanya melihat bisnis tempat outletnya berada
    const existingOutletRef = await prisma.outlet.findUnique({
      where: { id: existingOutlet.id },
      select: { businessId: true },
    });
    if (existingOutletRef?.businessId) {
      assert(adminGetData.data.length === 1, 'Admin branch-restricted hanya melihat 1 bisnis miliknya');
      assert(adminGetData.data[0].id === existingOutletRef.businessId, 'ID bisnis admin harus sesuai outletnya');
    }
    console.log('  ✅ Admin branch-restricted terscope secara benar ke bisnis outletnya');

    // ----------------------------------------------------
    // TEST 3: POST /api/businesses (CREATE BUSINESS)
    // ----------------------------------------------------
    console.log('\n[TEST 3] Menguji POST /api/businesses (Create Business)...');

    // 3.1 Non-owner ditolak (403)
    const spvCreateRes = await fetch(`${baseUrl}/api/businesses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${spvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Kafe Ilegal SPV',
        vertical: 'FNB',
        initialOutlet: { name: 'Cabang SPV' },
      }),
    });
    assert(spvCreateRes.status === 403, `Non-owner harus ditolak HTTP 403, got: ${spvCreateRes.status}`);
    console.log('  ✅ Non-owner (SPV) berhasil ditolak 403 Forbidden');

    // 3.2 Owner membuat bisnis F&B baru beserta initial outlet
    const uniqueSuffix = Date.now().toString().slice(-6);
    const newBusPayload = {
      name: `Kopi Senja Uji ${uniqueSuffix}`,
      vertical: 'FNB',
      subCategory: 'COFFEE_SHOP',
      logoUrl: 'https://cdn.wellpos.id/test-logo.png',
      initialOutlet: {
        name: `Cabang Senja Tebet ${uniqueSuffix}`,
        address: 'Jl. Tebet Timur Dalam No. 12',
        phone: '08123456789',
        isWorkshop: false,
      },
    };

    const ownerCreateRes = await fetch(`${baseUrl}/api/businesses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newBusPayload),
    });

    assert(ownerCreateRes.status === 201, `Owner POST business harus 201, got: ${ownerCreateRes.status}`);
    const createData = (await ownerCreateRes.json()) as any;
    assert(createData.status === 'success', 'Create status harus success');
    const createdBusiness = createData.data.business;
    const createdOutlet = createData.data.outlet;

    cleanup.businessIds.push(createdBusiness.id);
    cleanup.outletIds.push(createdOutlet.id);

    assert(createdBusiness.name === newBusPayload.name, 'Nama bisnis harus sesuai');
    assert(createdBusiness.vertical === 'FNB', 'Vertical bisnis harus FNB');
    assert(createdBusiness.tenantId === tenant.id, 'TenantId bisnis harus sesuai');
    assert(createdOutlet.businessId === createdBusiness.id, 'Outlet harus terikat ke businessId baru');
    assert(Array.isArray(createdOutlet.industries), 'Industries outlet harus array');
    assert(createdOutlet.industries.includes('FOOD_AND_BEVERAGE'), 'Industries harus memuat FOOD_AND_BEVERAGE');

    // Verifikasi default StorageLocation otomatis terbentuk
    const storageLoc = await prisma.storageLocation.findFirst({
      where: { outletId: createdOutlet.id, isDefault: true },
    });
    assert(Boolean(storageLoc), 'Default StorageLocation harus terprovisi secara otomatis');
    if (storageLoc) cleanup.storageLocationIds.push(storageLoc.id);
    console.log('  ✅ Bisnis baru + initial outlet + default StorageLocation berhasil dibuat secara atomik');

    // 3.3 Collision slug handling: buat bisnis lagi dengan nama yang sama
    const duplicateBusRes = await fetch(`${baseUrl}/api/businesses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newBusPayload),
    });
    assert(duplicateBusRes.status === 201, `Bisnis nama kembar harus berhasil dengan unique slug, got: ${duplicateBusRes.status}`);
    const dupData = (await duplicateBusRes.json()) as any;
    cleanup.businessIds.push(dupData.data.business.id);
    cleanup.outletIds.push(dupData.data.outlet.id);
    assert(dupData.data.business.slug !== createdBusiness.slug, 'Slug bisnis kembar harus diberi suffix angka unik');
    console.log(`  ✅ Slug collision tertangani dengan slug unik: ${dupData.data.business.slug}`);

    // ----------------------------------------------------
    // TEST 4: PATCH /api/businesses/:id & VERTICAL INTEGRITY
    // ----------------------------------------------------
    console.log('\n[TEST 4] Menguji PATCH /api/businesses/:id & Proteksi Transaksi Aktif...');

    // 4.1 Update nama dan subCategory
    const patchRes = await fetch(`${baseUrl}/api/businesses/${createdBusiness.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Kopi Senja Rebranded ${uniqueSuffix}`,
        subCategory: 'SPECIALTY_ROASTERY',
      }),
    });
    assert(patchRes.status === 200, `PATCH business harus 200, got: ${patchRes.status}`);
    const patchData = (await patchRes.json()) as any;
    assert(patchData.data.name === `Kopi Senja Rebranded ${uniqueSuffix}`, 'Nama bisnis harus terupdate');
    assert(patchData.data.subCategory === 'SPECIALTY_ROASTERY', 'SubCategory bisnis harus terupdate');
    console.log('  ✅ Update profil bisnis (name, subCategory) berhasil');

    // 4.2 Simulasi Order Aktif pada outlet bisnis ini
    const testOrder = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: createdOutlet.id,
        userId: dbOwner!.id,
        invoiceNumber: `INV-TEST-${Date.now().toString().slice(-6)}`,
        orderStatus: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 50000,
        totalAmount: 50000,
      },
    });
    cleanup.orderIds.push(testOrder.id);

    // 4.3 Percobaan ubah vertical ke LAUNDRY wajib DITOLAK (400)
    const switchVerticalRes = await fetch(`${baseUrl}/api/businesses/${createdBusiness.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vertical: 'LAUNDRY',
      }),
    });
    assert(switchVerticalRes.status === 400, `Ubah vertical saat ada order aktif harus 400, got: ${switchVerticalRes.status}`);
    const switchErr = (await switchVerticalRes.json()) as any;
    assert(switchErr.message.includes('transaksi aktif'), 'Pesan error harus menjelaskan riwayat transaksi aktif');
    console.log('  ✅ Proteksi integritas: Ganti vertikal berhasil ditolak HTTP 400 karena memiliki order aktif');

    // ----------------------------------------------------
    // TEST 5: GET /api/businesses/token-summary
    // ----------------------------------------------------
    console.log('\n[TEST 5] Menguji GET /api/businesses/token-summary (Dompet Bersama)...');

    // 5.1 Non-owner ditolak (403)
    const nonOwnerTokenRes = await fetch(`${baseUrl}/api/businesses/token-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(nonOwnerTokenRes.status === 403, `Non-owner harus 403 di token-summary, got: ${nonOwnerTokenRes.status}`);

    // 5.2 Owner token summary
    const ownerTokenRes = await fetch(`${baseUrl}/api/businesses/token-summary`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(ownerTokenRes.status === 200, `Owner token-summary harus 200, got: ${ownerTokenRes.status}`);
    const tokenSummary = (await ownerTokenRes.json()) as any;
    assert(tokenSummary.status === 'success', 'Status token-summary harus success');
    const td = tokenSummary.data;
    assert(typeof td.totalPurchasedTokens === 'number', 'totalPurchasedTokens harus number');
    assert(typeof td.totalUsedTokens === 'number', 'totalUsedTokens harus number');
    assert(typeof td.remainingTokens === 'number', 'remainingTokens harus number');
    assert(Array.isArray(td.usageByBusiness), 'usageByBusiness harus array');
    assert(Array.isArray(td.recentInvoices), 'recentInvoices harus array');

    // Verifikasi bisnis yang baru dibuat masuk dalam usageByBusiness
    const busUsage = td.usageByBusiness.find((b: any) => b.businessId === createdBusiness.id);
    assert(Boolean(busUsage), 'Bisnis baru harus terdaftar pada usageByBusiness');
    assert(busUsage.totalOrders >= 1, 'Total orders pada bisnis baru harus mencakup test order');
    console.log(`  ✅ Dompet token bersama terverifikasi: ${td.remainingTokens} sisa token, ${td.usageByBusiness.length} bisnis termonitor`);

    // ----------------------------------------------------
    // TEST 6: BACKWARD COMPATIBILITY /api/outlets
    // ----------------------------------------------------
    console.log('\n[TEST 6] Menguji Backward Compatibility /api/outlets...');

    // 6.1 GET /api/outlets?businessId=...
    const filterOutletsRes = await fetch(`${baseUrl}/api/outlets?businessId=${createdBusiness.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(filterOutletsRes.status === 200, `GET outlets?businessId harus 200, got: ${filterOutletsRes.status}`);
    const filteredOutlets = (await filterOutletsRes.json()) as any;
    assert(filteredOutlets.data.length === 1, 'Harus mengembalikan tepat 1 outlet untuk bisnis baru ini');
    assert(filteredOutlets.data[0].id === createdOutlet.id, 'Outlet ID yang difilter harus cocok');
    console.log('  ✅ Filter GET /api/outlets?businessId=... berfungsi sempurna');

    // 6.2 POST /api/outlets dengan businessId
    const create2ndOutletRes = await fetch(`${baseUrl}/api/outlets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Cabang Senja Kedua ${uniqueSuffix}`,
        address: 'Jl. Kemang Raya No. 99',
        businessId: createdBusiness.id,
      }),
    });
    assert(create2ndOutletRes.status === 201, `POST /api/outlets dengan businessId harus 201, got: ${create2ndOutletRes.status}`);
    const secondOutletData = (await create2ndOutletRes.json()) as any;
    cleanup.outletIds.push(secondOutletData.data.id);
    assert(secondOutletData.data.businessId === createdBusiness.id, 'Outlet kedua harus mewarisi businessId');
    assert(secondOutletData.data.industries?.includes('FOOD_AND_BEVERAGE'), 'Outlet kedua harus otomatis mewarisi industries FNB dari bisnis');
    console.log('  ✅ POST /api/outlets dengan businessId berhasil mengaitkan outlet dan mewarisi vertikal');

    console.log('\n====================================================');
    console.log('🎉 ALL OWNER PORTAL BATCH 1 TESTS PASSED 100%!');
    console.log('====================================================');
  } finally {
    // ----------------------------------------------------
    // CLEANUP: ZERO DATABASE RESIDUE
    // ----------------------------------------------------
    console.log('\n🧹 Membersihkan Seluruh Data Pengujian (Zero Residue)...');
    server.close();

    // 1. Hapus test order
    if (cleanup.orderIds.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: cleanup.orderIds } },
      });
      console.log(`  - Dihapus ${cleanup.orderIds.length} data Order uji`);
    }

    // 2. Hapus storage locations untuk test outlets
    if (cleanup.outletIds.length > 0) {
      await prisma.storageLocation.deleteMany({
        where: { outletId: { in: cleanup.outletIds } },
      });
      console.log(`  - Dihapus StorageLocations untuk ${cleanup.outletIds.length} outlet uji`);
    }

    // 3. Hapus test outlets
    if (cleanup.outletIds.length > 0) {
      await prisma.outlet.deleteMany({
        where: { id: { in: cleanup.outletIds } },
      });
      console.log(`  - Dihapus ${cleanup.outletIds.length} data Outlet uji`);
    }

    // 4. Hapus test businesses
    if (cleanup.businessIds.length > 0) {
      await prisma.business.deleteMany({
        where: { id: { in: cleanup.businessIds } },
      });
      console.log(`  - Dihapus ${cleanup.businessIds.length} data Business uji`);
    }

    // 5. Hapus test users
    if (cleanup.userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: cleanup.userIds } },
      });
      console.log(`  - Dihapus ${cleanup.userIds.length} data User uji`);
    }

    await prisma.$disconnect();
    console.log('✅ Pembersihan selesai bersih. 0 residu database tersisa.');
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
