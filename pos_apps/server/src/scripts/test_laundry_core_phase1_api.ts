/**
 * Test Suite: Laundry Core Engine — CORE PHASE 1 (Presisi Operasional) — BATCH 1
 * 
 * Menguji:
 * 1. Schema Patcher Idempotency (runAutoSchemaPatcher dijalankan 2x berturut-turut tanpa error)
 * 2. Modul 1: Customer Preference Profile & Secondary Phones (GET & PATCH)
 * 3. Modul 2: Berat Awal vs Berat Final (Initial vs Final Weight) & QC Checklist Pasca-Proses (REWASH_REQUIRED & PASSED)
 * 4. Modul 3: Lost & Found (POCKET_ITEM / UNCLAIMED_GARMENT) - Create, List & Return
 * 5. Modul 4: Outlet Pricing & Price History (Override per outlet, Price History Log, dan Integrasi getLaundryServices & updateLaundryService)
 * 6. Zero Database Residue (Pembersihan tuntas di blok finally)
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { runAutoSchemaPatcher } from '../migrations/schema_patcher';
import laundryCorePhase1Router from '../routes/laundry_core_phase1.routes';
import { laundryRouter } from '../routes/laundry.routes';
import { customerRouter } from '../routes/customer.routes';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('🧪 RUNNING LAUNDRY CORE ENGINE PHASE 1 INTEGRATION TESTS');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // LANGKAH 1: UJI IDEMPOTENSI AUTO SCHEMA PATCHER (2x EKSEKUSI)
  // --------------------------------------------------------------------------
  console.log('▶️ [LANGKAH 1] Menguji Idempotensi Auto Schema Patcher...');
  console.log('   Running Schema Patcher Pass 1...');
  await runAutoSchemaPatcher(prisma);
  console.log('   Running Schema Patcher Pass 2 (Idempotency Check)...');
  await runAutoSchemaPatcher(prisma);
  console.log('   ✅ Schema Patcher terbukti 100% idempotent tanpa error.\n');

  const timestamp = Date.now().toString();
  let createdTenantId = '';

  // Setup Express server transient
  const app = express();
  app.use(express.json());
  app.use('/api/laundry/core', laundryCorePhase1Router);
  app.use('/api/laundry', laundryRouter);
  app.use('/api/customers', customerRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // --------------------------------------------------------------------------
    // SEEDING DATA TEST TENANT TERISOLASI
    // --------------------------------------------------------------------------
    console.log('🌱 Menyiapkan data seeder tenant & entitas uji terisolasi...');

    // 1. Tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: `Tenant Uji Core Phase 1 ${timestamp.slice(-4)}`,
        slug: `test-core-phase1-${timestamp}`,
        businessType: 'LAUNDRY',
      },
    });
    createdTenantId = tenant.id;

    // 2. Business
    const business = await prisma.business.create({
      data: {
        tenantId: tenant.id,
        name: 'Laundry Express Mandiri',
        slug: `laundry-express-${timestamp}`,
        vertical: 'LAUNDRY',
        isActive: true,
      },
    });

    // 3. 2 Outlets
    const outlet1 = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        code: `OUT1-${timestamp.slice(-4)}`,
        name: 'Laundry Pusat Kemang',
        address: 'Jl. Kemang Raya No. 10',
        phone: '+628111111111',
        industries: ['LAUNDRY'],
        isActive: true,
      },
    });

    const outlet2 = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        code: `OUT2-${timestamp.slice(-4)}`,
        name: 'Laundry Cabang Mall Grand',
        address: 'Mall Grand Lantai LG',
        phone: '+628222222222',
        industries: ['LAUNDRY'],
        isActive: true,
      },
    });

    // 4. Users (Owner & Cashier)
    const ownerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        userCode: `OWN-${timestamp.slice(-4)}`,
        name: 'Budi Owner Core',
        email: `owner.core.${timestamp}@wellpos.test`,
        passwordHash: 'dummy-hash',
        role: Role.OWNER,
        isActive: true,
      },
    });

    const cashierUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet1.id,
        userCode: `KSR-${timestamp.slice(-4)}`,
        name: 'Siti Kasir Core',
        email: `cashier.core.${timestamp}@wellpos.test`,
        passwordHash: 'dummy-hash',
        role: Role.CASHIER,
        isActive: true,
      },
    });

    const makeToken = (user: any) =>
      jwt.sign(
        {
          userId: user.id,
          role: user.role,
          outletId: user.outletId,
          tenantId: user.tenantId,
          tokenVersion: 1,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

    const ownerToken = makeToken(ownerUser);
    const cashierToken = makeToken(cashierUser);

    // 5. Customer
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        code: `MBR-${timestamp.slice(-4)}`,
        name: 'Budi Pelanggan Setia',
        phone: `+62812${timestamp.slice(-8)}`,
        email: `customer.${timestamp}@gmail.test`,
        address: 'Jl. Melati No. 45',
      },
    });

    // 6. Laundry Service (Master Price = 10.000)
    const service = await prisma.laundryService.create({
      data: {
        tenantId: tenant.id,
        name: 'Cuci Komplit Reguler',
        category: 'KILOAN',
        unit: 'KG',
        price: new Prisma.Decimal(10000),
        minOrderQty: new Prisma.Decimal(3),
        durationHours: 48,
        expressMultiplier: new Prisma.Decimal(1.5),
        description: 'Layanan cuci, kering, dan setrika uap rapi',
        isActive: true,
      },
    });

    // 7. Order & LaundryOrderDetail (Initial Weight = 5.000 KG)
    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet1.id,
        userId: cashierUser.id,
        customerId: customer.id,
        invoiceNumber: `INV-CORE-${timestamp.slice(-6)}`,
        orderStatus: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: new Prisma.Decimal(50000),
        totalAmount: new Prisma.Decimal(50000),
      },
    });

    const laundryDetail = await prisma.laundryOrderDetail.create({
      data: {
        orderId: order.id,
        tenantId: tenant.id,
        outletId: outlet1.id,
        status: 'RECEIVED',
        currentStage: 'DROP_OFF',
        totalWeightKg: new Prisma.Decimal(5.0),
        initialWeightKg: new Prisma.Decimal(5.0),
        totalPieces: 12,
        perfumeVariant: 'Ocean Fresh',
      },
    });

    console.log('   ✅ Tenant, Outlets, Users, Customer, Layanan, dan Order berhasil disiapkan.\n');

    // --------------------------------------------------------------------------
    // MODUL 1: CUSTOMER PREFERENCE PROFILE & SECONDARY PHONES
    // --------------------------------------------------------------------------
    console.log('▶️ [MODUL 1] Customer Preference Profile & Secondary Phones');

    // 1. PATCH Preferences
    const patchPrefRes = await fetch(`${baseUrl}/api/laundry/core/customers/${customer.id}/preferences`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        laundryPreferences: {
          separateColors: true,
          preferFoldOrHang: 'FOLD',
          preferPerfume: 'Lavender Super',
          avoidSoftener: false,
          alwaysExpress: false,
          customNotes: 'Pakaian bayi jangan campur deterjen keras',
        },
        secondaryPhones: ['+6281299990001', '+6281299990002'],
      }),
    });

    assert(patchPrefRes.status === 200, `PATCH preferences harus HTTP 200, aktual: ${patchPrefRes.status}`);
    const patchPrefJson = await patchPrefRes.json();
    assert(patchPrefJson.status === 'success', 'Response status harus success');
    assert(patchPrefJson.data.secondaryPhones.length === 2, 'Secondary phones harus berisi 2 nomor');
    assert(
      patchPrefJson.data.laundryPreferences.preferPerfume === 'Lavender Super',
      'Parfum favorit harus Lavender Super'
    );
    console.log('   ✅ PATCH preferences & secondary phones berhasil disimpan.');

    // 2. GET Preferences
    const getPrefRes = await fetch(`${baseUrl}/api/laundry/core/customers/${customer.id}/preferences`, {
      headers: {
        Authorization: `Bearer ${cashierToken}`,
      },
    });
    assert(getPrefRes.status === 200, `GET preferences harus HTTP 200, aktual: ${getPrefRes.status}`);
    const getPrefJson = await getPrefRes.json();
    assert(getPrefJson.data.laundryPreferences.separateColors === true, 'separateColors harus true');
    assert(getPrefJson.data.laundryPreferences.preferFoldOrHang === 'FOLD', 'preferFoldOrHang harus FOLD');
    assert(getPrefJson.data.secondaryPhones[0] === '+6281299990001', 'Nomor telepon sekunder 1 harus cocok');
    console.log('   ✅ GET preferences berhasil memverifikasi data tersimpan.\n');

    // --------------------------------------------------------------------------
    // MODUL 2: BERAT AWAL VS BERAT FINAL & QC CHECKLIST
    // --------------------------------------------------------------------------
    console.log('▶️ [MODUL 2] Berat Awal vs Berat Final & QC Checklist Pasca-Proses');

    // 1. PATCH Weight (Final Weight = 4.850 KG, penyusutan 0.150 KG)
    const patchWeightRes = await fetch(`${baseUrl}/api/laundry/core/orders/${order.id}/weight`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        finalWeightKg: 4.85,
        weightDiffReason: 'Penyusutan air pasca pengeringan tumbler',
        syncTotalWeight: true,
      }),
    });

    assert(patchWeightRes.status === 200, `PATCH weight harus HTTP 200, aktual: ${patchWeightRes.status}`);
    const patchWeightJson = await patchWeightRes.json();
    assert(patchWeightJson.data.initialWeightKg === 5, 'Berat awal harus tetap 5.0 KG');
    assert(patchWeightJson.data.finalWeightKg === 4.85, 'Berat final harus 4.85 KG');
    assert(patchWeightJson.data.weightDiffKg === -0.15, 'Selisih berat harus tepat -0.150 KG');
    assert(patchWeightJson.data.totalWeightKg === 4.85, 'Total weight tersinkronisasi 4.85 KG');
    console.log('   ✅ Berat awal vs final berhasil direkam dengan kalkulasi selisih presisi.');

    // 2. PATCH QC REWASH_REQUIRED (Noda belum hilang -> Kembali ke WASHING)
    const patchQcRewashRes = await fetch(`${baseUrl}/api/laundry/core/orders/${order.id}/qc`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        qcStatus: 'REWASH_REQUIRED',
        qcChecklist: {
          stainFree: false,
          odorFresh: true,
          ironedNeat: true,
          pieceCountVerified: true,
          verifiedPieces: 12,
          notes: 'Noda minyak di kerah kemeja putih belum terangkat',
        },
        qcAfterPhotos: ['https://storage.wellpos.test/qc_rewash_01.jpg'],
      }),
    });

    assert(patchQcRewashRes.status === 200, `PATCH QC rewash harus HTTP 200, aktual: ${patchQcRewashRes.status}`);
    const patchQcRewashJson = await patchQcRewashRes.json();
    assert(patchQcRewashJson.data.qcStatus === 'REWASH_REQUIRED', 'Status QC harus REWASH_REQUIRED');
    assert(patchQcRewashJson.data.currentStage === 'WASHING', 'Stage laundry harus kembali ke WASHING');
    assert(patchQcRewashJson.data.status === 'WASHING_DRYING', 'Status order harus kembali ke WASHING_DRYING');

    // Verifikasi DB: Stage log rewash tercatat
    const rewashStageLog = await prisma.laundryStageLog.findFirst({
      where: {
        orderId: order.id,
        stage: 'WASHING',
        notes: { contains: '[QC_REWASH]' },
      },
    });
    assert(Boolean(rewashStageLog), 'Audit log LaundryStageLog [QC_REWASH] wajib tercipta');
    console.log('   ✅ QC REWASH_REQUIRED sukses: stage kembali ke WASHING dan stage log terbit.');

    // 3. PATCH QC PASSED (Setelah cuci ulang, semua noda bersih sempurna)
    const patchQcPassedRes = await fetch(`${baseUrl}/api/laundry/core/orders/${order.id}/qc`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        qcStatus: 'PASSED',
        qcChecklist: {
          stainFree: true,
          odorFresh: true,
          ironedNeat: true,
          pieceCountVerified: true,
          verifiedPieces: 12,
          notes: 'Noda minyak bersih tuntas setelah spotting ulang',
        },
        qcAfterPhotos: ['https://storage.wellpos.test/qc_passed_clean.jpg'],
      }),
    });

    assert(patchQcPassedRes.status === 200, `PATCH QC passed harus HTTP 200, aktual: ${patchQcPassedRes.status}`);
    const patchQcPassedJson = await patchQcPassedRes.json();
    assert(patchQcPassedJson.data.qcStatus === 'PASSED', 'Status QC harus PASSED');

    const passedStageLog = await prisma.laundryStageLog.findFirst({
      where: {
        orderId: order.id,
        notes: { contains: '[QC_PASSED]' },
      },
    });
    assert(Boolean(passedStageLog), 'Audit log LaundryStageLog [QC_PASSED] wajib tercipta');
    console.log('   ✅ QC PASSED sukses: checklist lengkap tersimpan rapi.\n');

    // --------------------------------------------------------------------------
    // MODUL 3: LOST & FOUND (BARANG TERTINGGAL / PAKAIAN TAK BERTUAN)
    // --------------------------------------------------------------------------
    console.log('▶️ [MODUL 3] Lost & Found (Barang Tertinggal di Saku / Pakaian Tak Bertuan)');

    // 1. POST Lost & Found (Ditemukan uang tunai di saku)
    const postLostRes = await fetch(`${baseUrl}/api/laundry/core/lost-and-found`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        outletId: outlet1.id,
        orderId: order.id,
        customerId: customer.id,
        itemCategory: 'POCKET_ITEM',
        itemName: 'Uang Tunai Rp 50.000',
        description: 'Pecahan 50rb warna biru terlipat rapi',
        storageLocation: 'Brankas Kasir - Amplop A1',
        notes: 'Ditemukan di saku kanan celana jeans levis',
      }),
    });

    assert(postLostRes.status === 201, `POST lost & found harus HTTP 201, aktual: ${postLostRes.status}`);
    const postLostJson = await postLostRes.json();
    const lostItem = postLostJson.data;
    assert(lostItem.itemName === 'Uang Tunai Rp 50.000', 'Nama barang harus cocok');
    assert(lostItem.status === 'FOUND', 'Status awal harus FOUND');
    assert(lostItem.foundByName === cashierUser.name, 'foundByName harus terisi dari kasir');
    assert(lostItem.order.invoiceNumber === order.invoiceNumber, 'Relasi order invoice number harus cocok');
    console.log('   ✅ Catatan barang tertinggal berhasil dibuat dengan relasi order.');

    // 2. GET Lost & Found List
    const getLostRes = await fetch(`${baseUrl}/api/laundry/core/lost-and-found?outletId=${outlet1.id}`, {
      headers: {
        Authorization: `Bearer ${cashierToken}`,
      },
    });
    assert(getLostRes.status === 200, `GET lost & found harus HTTP 200, aktual: ${getLostRes.status}`);
    const getLostJson = await getLostRes.json();
    assert(getLostJson.data.length >= 1, 'Lost & found harus memiliki minimal 1 item');
    console.log('   ✅ GET lost & found berhasil mengambil data per outlet.');

    // 3. PATCH Lost & Found (Customer mengambil barang -> Status RETURNED)
    const patchLostRes = await fetch(`${baseUrl}/api/laundry/core/lost-and-found/${lostItem.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        status: 'RETURNED',
        claimedByName: 'Budi Pelanggan Setia',
        notes: 'Sudah diserahkan langsung saat pengambilan cucian',
      }),
    });

    assert(patchLostRes.status === 200, `PATCH lost & found harus HTTP 200, aktual: ${patchLostRes.status}`);
    const patchLostJson = await patchLostRes.json();
    assert(patchLostJson.data.status === 'RETURNED', 'Status harus RETURNED');
    assert(Boolean(patchLostJson.data.returnedAt), 'returnedAt harus terisi tanggal sekarang');
    assert(patchLostJson.data.returnedById === cashierUser.id, 'returnedById harus terisi user kasir');
    assert(patchLostJson.data.claimedByName === 'Budi Pelanggan Setia', 'claimedByName harus cocok');
    console.log('   ✅ Barang tertinggal berhasil diubah status menjadi RETURNED.\n');

    // --------------------------------------------------------------------------
    // MODUL 4: OUTLET PRICING & PRICE HISTORY
    // --------------------------------------------------------------------------
    console.log('▶️ [MODUL 4] Outlet Pricing & Price History');

    // 1. GET Outlet Services Pricing untuk Outlet 2 (Sebelum override -> Harga masih master = 10.000)
    const getOutletPricesRes1 = await fetch(
      `${baseUrl}/api/laundry/core/services/outlet-prices?outletId=${outlet2.id}`,
      {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
        },
      }
    );
    assert(
      getOutletPricesRes1.status === 200,
      `GET outlet-prices harus HTTP 200, aktual: ${getOutletPricesRes1.status}`
    );
    const getOutletPricesJson1 = await getOutletPricesRes1.json();
    const serviceInOutlet2Before = getOutletPricesJson1.data.services.find((s: any) => s.id === service.id);
    assert(serviceInOutlet2Before.basePrice === 10000, 'Base price harus 10.000');
    assert(serviceInOutlet2Before.priceOverride === null, 'Price override awal harus null');
    assert(serviceInOutlet2Before.effectivePrice === 10000, 'Effective price awal harus 10.000');
    console.log('   ✅ GET outlet-prices memvalidasi fallback ke base price 10.000.');

    // 2. PUT Outlet Service Price (Override harga Outlet 2 menjadi 12.500)
    const putOutletPriceRes = await fetch(
      `${baseUrl}/api/laundry/core/services/${service.id}/outlet-price`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          outletId: outlet2.id,
          priceOverride: 12500,
          expressMultiplierOverride: 2.0,
          reason: 'Penyesuaian biaya sewa outlet mall',
        }),
      }
    );
    assert(
      putOutletPriceRes.status === 200,
      `PUT outlet-price harus HTTP 200, aktual: ${putOutletPriceRes.status}`
    );
    const putOutletPriceJson = await putOutletPriceRes.json();
    assert(putOutletPriceJson.data.oldEffectivePrice === 10000, 'Old effective price harus 10.000');
    assert(putOutletPriceJson.data.newEffectivePrice === 12500, 'New effective price harus 12.500');
    assert(putOutletPriceJson.data.priceOverride === 12500, 'Price override harus 12.500');
    console.log('   ✅ Tarif khusus outlet berhasil ditetapkan (Rp 12.500).');

    // 3. GET Price History untuk Outlet 2
    const getHistoryRes = await fetch(
      `${baseUrl}/api/laundry/core/services/${service.id}/price-history?outletId=${outlet2.id}`,
      {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
        },
      }
    );
    assert(getHistoryRes.status === 200, `GET price-history harus HTTP 200, aktual: ${getHistoryRes.status}`);
    const getHistoryJson = await getHistoryRes.json();
    assert(getHistoryJson.data.length >= 1, 'Histori harga outlet harus memiliki minimal 1 catatan');
    const latestHistory = getHistoryJson.data[0];
    assert(latestHistory.oldPrice === 10000, 'oldPrice histori harus 10.000');
    assert(latestHistory.newPrice === 12500, 'newPrice histori harus 12.500');
    assert(latestHistory.outletId === outlet2.id, 'outletId histori harus cocok dengan Outlet 2');
    console.log('   ✅ Histori perubahan tarif outlet tercatat lengkap secara audit trail.');

    // 4. Integrasi Existing Endpoint: GET /api/laundry/services?outletId=...
    const getServicesExistingRes = await fetch(`${baseUrl}/api/laundry/services?outletId=${outlet2.id}`, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    assert(
      getServicesExistingRes.status === 200,
      `GET /api/laundry/services harus HTTP 200, aktual: ${getServicesExistingRes.status}`
    );
    const getServicesExistingJson = await getServicesExistingRes.json();
    const serviceForOutlet2 = getServicesExistingJson.data.find((s: any) => s.id === service.id);
    assert(
      serviceForOutlet2.effectivePrice === 12500,
      'Effective price di endpoint existing harus otomatis 12.500'
    );
    assert(
      serviceForOutlet2.price === 12500,
      'Field price backward-compatible harus otomatis 12.500 untuk POS'
    );
    assert(serviceForOutlet2.basePrice === 10000, 'Base price harus tetap 10.000');
    console.log('   ✅ Endpoint existing /api/laundry/services otomatis mengembalikan harga override outlet.');

    // 5. Integrasi Existing Endpoint: PUT /api/laundry/services/:id (Ubah harga master -> Catat history master)
    const updateMasterServiceRes = await fetch(`${baseUrl}/api/laundry/services/${service.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        price: 11000,
        reason: 'Penyesuaian kenaikan tarif master regional',
      }),
    });
    assert(
      updateMasterServiceRes.status === 200,
      `PUT /api/laundry/services/:id harus HTTP 200, aktual: ${updateMasterServiceRes.status}`
    );

    // Cek price history master (outletId === null)
    const masterHistory = await prisma.laundryServicePriceHistory.findFirst({
      where: {
        tenantId: tenant.id,
        laundryServiceId: service.id,
        outletId: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(Boolean(masterHistory), 'Audit log perubahan harga master harus tercipta');
    assert(Number(masterHistory!.oldPrice) === 10000, 'Harga lama master harus 10.000');
    assert(Number(masterHistory!.newPrice) === 11000, 'Harga baru master harus 11.000');
    console.log('   ✅ Pembaruan harga master berhasil mencatat audit history (outletId: null).\n');

    console.log('================================================================================');
    console.log('🎉 SELURUH PENGUJIAN LAUNDRY CORE PHASE 1 BATCH 1 LULUS 100%!');
    console.log('================================================================================\n');

  } catch (error: any) {
    console.error('\n❌ [TEST FAILURE]:', error?.message || error);
    throw error;
  } finally {
    server.close();

    // --------------------------------------------------------------------------
    // CLEANUP DATABASE (ZERO RESIDUE)
    // --------------------------------------------------------------------------
    if (createdTenantId) {
      console.log('🧹 [CLEANUP] Membersihkan seluruh data dummy test tenant...');
      const queries = [
        `DELETE FROM "laundry_service_price_histories" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_service_outlet_prices" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_lost_and_found" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_stage_logs" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_order_details" WHERE "tenant_id" = $1`,
        `DELETE FROM "orders" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_services" WHERE "tenant_id" = $1`,
        `DELETE FROM "customers" WHERE "tenant_id" = $1`,
        `DELETE FROM "users" WHERE "tenant_id" = $1`,
        `DELETE FROM "outlets" WHERE "tenant_id" = $1`,
        `DELETE FROM "businesses" WHERE "tenant_id" = $1`,
        `DELETE FROM "tenants" WHERE "id" = $1`,
      ];

      for (const q of queries) {
        try {
          await prisma.$executeRawUnsafe(q, createdTenantId);
        } catch (e: any) {
          // ignore cascade
        }
      }

      const remaining = await prisma.tenant.findMany({
        where: { id: createdTenantId },
      });
      assert(remaining.length === 0, 'Tenant dummy harus terhapus bersih');
      console.log('✨ [CLEANUP COMPLETE] Database bersih 100% tanpa residu.');
    }

    await prisma.$disconnect();
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
