/**
 * Test Suite: Laundry Core Engine — CORE PHASE 2 (Workshop Efficiency & Traceability) — BATCH 1
 * 
 * Menguji:
 * 1. Schema Patcher Idempotency (runAutoSchemaPatcher dijalankan 2x berturut-turut tanpa error)
 * 2. Modul A: Smart Production Queue (Auto-prioritization SLA Overdue, Express & Nearest Deadline)
 * 3. Modul B: Laundry Batch Management (Create Batch, Auto-start, Progress Stage, Complete Batch)
 * 4. Modul C: Item-Level Tracking & Scan by Tag Code (Create Tracks, Scan Tag, Update Stage)
 * 5. Modul D: Split Order / Partial Handover (Handover Bertahap & Auto-completion Saat 100% Selesai)
 * 6. Zero Database Residue (Pembersihan tuntas di blok finally)
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role, OrderStatus, PaymentStatus } from '@prisma/client';
import { runAutoSchemaPatcher } from '../migrations/schema_patcher';
import laundryCorePhase2Router from '../routes/laundry_core_phase2.routes';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('🧪 RUNNING LAUNDRY CORE ENGINE PHASE 2 INTEGRATION TESTS (BATCH 1)');
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
  app.use('/api/laundry/core2', laundryCorePhase2Router);

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
        name: `Tenant Uji Core Phase 2 ${timestamp.slice(-4)}`,
        slug: `test-core-phase2-${timestamp}`,
        businessType: 'LAUNDRY',
      },
    });
    createdTenantId = tenant.id;

    // 2. Business
    const business = await prisma.business.create({
      data: {
        tenantId: tenant.id,
        name: 'Laundry Workshop Express',
        slug: `laundry-workshop-${timestamp}`,
        vertical: 'LAUNDRY',
        isActive: true,
      },
    });

    // 3. Outlet
    const outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        code: `OUT-P2-${timestamp.slice(-4)}`,
        name: 'Laundry Central Workshop',
        address: 'Jl. Industri Workshop No. 5',
        phone: '+6287711223344',
        industries: ['LAUNDRY'],
        isActive: true,
      },
    });

    // 4. User (Owner & Cashier/Operator)
    const ownerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        userCode: `OWN-${timestamp.slice(-4)}`,
        name: 'Pak Budi Workshop Owner',
        email: `owner.p2.${timestamp}@wellpos.test`,
        passwordHash: 'dummy-hash',
        role: Role.OWNER,
        isActive: true,
      },
    });

    const cashierUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userCode: `OPR-${timestamp.slice(-4)}`,
        name: 'Andi Workshop Operator',
        email: `operator.p2.${timestamp}@wellpos.test`,
        passwordHash: 'dummy-hash',
        role: Role.CASHIER,
        isActive: true,
      },
    });

    // 5. Customers
    const customer1 = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        code: `CUST1-${timestamp.slice(-4)}`,
        name: 'Ibu Ratna (Overdue)',
        phone: '+6281234567890',
      },
    });

    const customer2 = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        code: `CUST2-${timestamp.slice(-4)}`,
        name: 'Pak Dodi (Normal)',
        phone: '+6289876543210',
      },
    });

    // 6. Laundry Machine (Washer)
    const machine = await prisma.laundryMachine.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        code: `MC-${timestamp.slice(-4)}`,
        name: 'Washer Commercial LG 20kg',
        machineType: 'WASHER',
        capacityKg: 20,
        status: 'ACTIVE',
      },
    });

    // 7. Orders & Laundry Details
    // Order 1: SLA Overdue 2 jam lalu (CRITICAL)
    const order1 = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: cashierUser.id,
        customerId: customer1.id,
        invoiceNumber: `INV-P2-01-${timestamp.slice(-4)}`,
        subtotal: 50000,
        totalAmount: 50000,
        orderStatus: OrderStatus.IN_PROGRESS,
        paymentStatus: PaymentStatus.PAID,
      },
    });

    const detail1 = await prisma.laundryOrderDetail.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        orderId: order1.id,
        currentStage: 'DROP_OFF',
        totalWeightKg: 5.5,
        estimatedReadyAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 jam lalu (Overdue)
      },
    });

    // Order 2: Normal SLA (24 jam lagi)
    const order2 = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: cashierUser.id,
        customerId: customer2.id,
        invoiceNumber: `INV-P2-02-${timestamp.slice(-4)}`,
        subtotal: 35000,
        totalAmount: 35000,
        orderStatus: OrderStatus.IN_PROGRESS,
        paymentStatus: PaymentStatus.PAID,
      },
    });

    const detail2 = await prisma.laundryOrderDetail.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        orderId: order2.id,
        currentStage: 'DROP_OFF',
        totalWeightKg: 3.5,
        estimatedReadyAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 jam ke depan (Normal)
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

    console.log('   ✅ Seeding selesai. Data uji siap digunakan.\n');

    // --------------------------------------------------------------------------
    // MODUL A: SMART PRODUCTION QUEUE
    // --------------------------------------------------------------------------
    console.log('▶️ [MODUL A] Menguji Smart Production Queue (Auto-Prioritization)...');
    const queueRes = await fetch(`${baseUrl}/api/laundry/core2/production-queue?outletId=${outlet.id}`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(queueRes.status === 200, `GET /production-queue harus HTTP 200, aktual: ${queueRes.status}`);

    const queueData = await queueRes.json();
    assert(queueData.status === 'success', 'Status respon harus success');
    assert(Array.isArray(queueData.data), 'Data queue harus berbentuk array');
    assert(queueData.data.length === 2, `Jumlah queue harus 2, aktual: ${queueData.data.length}`);

    // Order 1 harus menjadi nomor 1 dengan tier CRITICAL
    const topItem = queueData.data[0];
    assert(topItem.id === order1.id, 'Order 1 (Overdue) wajib menjadi urutan teratas');
    assert(topItem.priorityTier === 'CRITICAL', `Tier order 1 harus CRITICAL, aktual: ${topItem.priorityTier}`);
    assert(topItem.priorityScore > 1000, 'Priority score order 1 harus > 1000');
    assert(topItem.minutesLeft < 0, 'Minutes left order 1 harus negatif (overdue)');

    // Order 2 tier NORMAL
    const secondItem = queueData.data[1];
    assert(secondItem.id === order2.id, 'Order 2 wajib di urutan kedua');
    assert(secondItem.priorityTier === 'NORMAL', `Tier order 2 harus NORMAL, aktual: ${secondItem.priorityTier}`);
    assert(queueData.summary.overdueCount === 1, 'Summary overdueCount harus 1');
    assert(queueData.summary.totalActiveOrders === 2, 'Summary totalActiveOrders harus 2');
    console.log(`   ✅ Smart Production Queue terverifikasi: #${topItem.invoiceNumber} [${topItem.priorityTier}, score: ${topItem.priorityScore}] menduduki prioritas pertama.\n`);

    // --------------------------------------------------------------------------
    // MODUL B: LAUNDRY BATCH MANAGEMENT
    // --------------------------------------------------------------------------
    console.log('▶️ [MODUL B] Menguji Laundry Batch Management (Grouping & Cycle Tracking)...');
    
    // 1. Buat Batch Gabungan (Order 1 + Order 2) dengan autoStart = true
    const createBatchRes = await fetch(`${baseUrl}/api/laundry/core2/batches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        outletId: outlet.id,
        stage: 'WASHING',
        machineId: machine.id,
        colorGroup: 'WARNA',
        orderIds: [order1.id, order2.id],
        autoStart: true,
        notes: 'Gabung cuci warna terang',
      }),
    });
    assert(createBatchRes.status === 201, `POST /batches harus HTTP 201, aktual: ${createBatchRes.status}`);
    const createBatchData = await createBatchRes.json();
    const batch = createBatchData.data;
    assert(Boolean(batch.batchCode), 'Batch code harus terisi');
    assert(batch.status === 'IN_PROGRESS', 'Batch status harus IN_PROGRESS karena autoStart true');
    assert(batch.items.length === 2, 'Batch harus memiliki 2 item order');
    assert(Number(batch.totalWeightKg) === 9, `Total weight harus 9kg (5.5 + 3.5), aktual: ${batch.totalWeightKg}`);

    // Verifikasi kedua order berpindah ke stage WASHING
    const checkOrder1 = await prisma.laundryOrderDetail.findUnique({ where: { id: detail1.id } });
    const checkOrder2 = await prisma.laundryOrderDetail.findUnique({ where: { id: detail2.id } });
    assert(checkOrder1!.currentStage === 'WASHING', 'Order 1 harus otomatis berpindah ke WASHING');
    assert(checkOrder2!.currentStage === 'WASHING', 'Order 2 harus otomatis berpindah ke WASHING');

    // Verifikasi audit stage log tercatat untuk kedua order
    const stageLogs = await prisma.laundryStageLog.findMany({
      where: {
        tenantId: tenant.id,
        orderId: { in: [order1.id, order2.id] },
        stage: 'WASHING',
      },
    });
    assert(stageLogs.length === 2, 'Stage log audit harus tercatat untuk kedua order');
    assert(stageLogs[0].notes.includes(`[BATCH ${batch.batchCode}]`), 'Catatan log harus mencantumkan kode batch');
    console.log(`   ✅ Batch ${batch.batchCode} berhasil dibuat & dijalankan (9 kg di mesin ${machine.name}). Order otomatis masuk WASHING.`);

    // 2. Ambil daftar batch
    const listBatchesRes = await fetch(`${baseUrl}/api/laundry/core2/batches?outletId=${outlet.id}`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(listBatchesRes.status === 200, 'GET /batches harus HTTP 200');
    const listBatchesData = await listBatchesRes.json();
    assert(listBatchesData.data.length >= 1, 'Minimal ada 1 batch aktif');

    // 3. Selesaikan Batch dan majukan order ke tahap DRYING
    const updateBatchRes = await fetch(`${baseUrl}/api/laundry/core2/batches/${batch.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        status: 'COMPLETED',
        notes: 'Selesai siklus cuci 45 menit',
      }),
    });
    assert(updateBatchRes.status === 200, `PATCH /batches/:id/status harus HTTP 200, aktual: ${updateBatchRes.status}`);
    const updatedBatchData = await updateBatchRes.json();
    assert(updatedBatchData.data.status === 'COMPLETED', 'Status batch harus COMPLETED');

    const checkOrder1After = await prisma.laundryOrderDetail.findUnique({ where: { id: detail1.id } });
    const checkOrder2After = await prisma.laundryOrderDetail.findUnique({ where: { id: detail2.id } });
    assert(checkOrder1After!.currentStage === 'DRYING', 'Order 1 harus maju ke DRYING');
    assert(checkOrder2After!.currentStage === 'DRYING', 'Order 2 harus maju ke DRYING');
    console.log('   ✅ Siklus Batch selesai. Kedua order berhasil dimajukan ke tahap DRYING.\n');

    // --------------------------------------------------------------------------
    // MODUL C: ITEM-LEVEL TRACKING & QUICK SCAN
    // --------------------------------------------------------------------------
    console.log('▶️ [MODUL C] Menguji Item-Level Tracking & Quick Scan Tag Code...');

    // 1. Daftarkan 3 pakaian pada Order 1
    const createItemsRes = await fetch(`${baseUrl}/api/laundry/core2/orders/${order1.id}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            garmentName: 'Kemeja Katun Putih Zara',
            category: 'ATASAN',
            brand: 'Zara',
            color: 'Putih',
            notes: 'Kancing kedua sedikit longgar',
          },
          {
            garmentName: 'Celana Chino Slim Khaki',
            category: 'BAWAHAN',
            brand: 'Uniqlo',
            color: 'Khaki',
            notes: null,
          },
          {
            garmentName: 'Jaket Denim Vintage',
            category: 'LAINNYA',
            brand: "Levi's",
            color: 'Biru Tua',
            notes: 'Robekan kecil di pergelangan tangan kiri bawaan model',
          },
        ],
      }),
    });
    assert(createItemsRes.status === 201, `POST /orders/:orderId/items harus HTTP 201, aktual: ${createItemsRes.status}`);
    const itemsCreatedData = await createItemsRes.json();
    const createdTracks = itemsCreatedData.data;
    assert(createdTracks.length === 3, 'Harus terbuat 3 item pakaian');
    assert(createdTracks[0].tagCode.startsWith('TAG-'), `Tag code harus diawali 'TAG-', aktual: ${createdTracks[0].tagCode}`);
    console.log(`   ✅ Berhasil mendaftarkan 3 item pakaian: ${createdTracks.map((t: any) => t.tagCode).join(', ')}`);

    // 2. Scan item pertama menggunakan tagCode
    const scanTag = createdTracks[0].tagCode;
    const scanRes = await fetch(`${baseUrl}/api/laundry/core2/items/scan/${scanTag}`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(scanRes.status === 200, `GET /items/scan/:tagCode harus HTTP 200, aktual: ${scanRes.status}`);
    const scanData = await scanRes.json();
    assert(scanData.data.tagCode === scanTag, 'Tag code hasil scan harus cocok');
    assert(scanData.data.order.invoiceNumber === order1.invoiceNumber, 'Invoice number order harus cocok');
    assert(scanData.data.garmentName === 'Kemeja Katun Putih Zara', 'Nama pakaian harus cocok');
    console.log(`   ✅ Quick Scan tag "${scanTag}" berhasil mengembalikan detail pakaian & order.`);

    // 3. Update status per pakaian (misal Kemeja Katun telah selesai disetrika)
    const updateItemRes = await fetch(`${baseUrl}/api/laundry/core2/items/${createdTracks[0].id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        currentStage: 'IRONING',
        rackCode: 'RAK-A-03',
        notes: 'Sudah selesai setrika, siap gantung',
      }),
    });
    assert(updateItemRes.status === 200, 'PATCH /items/:id harus HTTP 200');
    const updatedItemData = await updateItemRes.json();
    assert(updatedItemData.data.currentStage === 'IRONING', 'Stage item harus IRONING');
    assert(updatedItemData.data.rackCode === 'RAK-A-03', 'Rack code harus RAK-A-03');
    console.log('   ✅ Item-Level tracking update stage & lokasi rak berhasil.\n');

    // --------------------------------------------------------------------------
    // MODUL D: SPLIT ORDER / PARTIAL HANDOVER
    // --------------------------------------------------------------------------
    console.log('▶️ [MODUL D] Menguji Split Order / Partial Handover (Serah Ambil Bertahap)...');

    // 1. Serahkan 2 pakaian lebih awal (Item 0 dan Item 1)
    const partialRes1 = await fetch(`${baseUrl}/api/laundry/core2/orders/${order1.id}/partial-handover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        itemIds: [createdTracks[0].id, createdTracks[1].id],
        receivedByName: 'Ibu Ratna (Customer)',
        notes: 'Ambil kemeja dan celana dulu untuk kerja besok',
      }),
    });
    assert(partialRes1.status === 200, `POST /partial-handover harus HTTP 200, aktual: ${partialRes1.status}`);
    const partial1Data = await partialRes1.json();
    assert(partial1Data.data.isFullyHandedOver === false, 'isFullyHandedOver harus false karena masih ada 1 jaket');
    assert(partial1Data.data.handedOverNow === 2, 'handedOverNow harus 2');
    assert(partial1Data.data.totalHandedOver === 2, 'totalHandedOver harus 2');
    assert(partial1Data.data.totalItems === 3, 'totalItems harus 3');

    // Verifikasi order belum COMPLETED
    const order1Check1 = await prisma.order.findUnique({ where: { id: order1.id } });
    assert(order1Check1!.orderStatus === OrderStatus.IN_PROGRESS, 'Order wajib tetap IN_PROGRESS');
    console.log('   ✅ Tahap 1: 2 dari 3 pakaian berhasil diserahkan. Status order tetap IN_PROGRESS.');

    // 2. Serahkan 1 pakaian tersisa (Jaket Denim) -> Auto Complete
    const partialRes2 = await fetch(`${baseUrl}/api/laundry/core2/orders/${order1.id}/partial-handover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        itemIds: [createdTracks[2].id],
        receivedByName: 'Bpk Joko (Suami Ibu Ratna)',
        notes: 'Ambil sisa jaket denim',
      }),
    });
    assert(partialRes2.status === 200, `POST /partial-handover harus HTTP 200, aktual: ${partialRes2.status}`);
    const partial2Data = await partialRes2.json();
    assert(partial2Data.data.isFullyHandedOver === true, 'isFullyHandedOver harus true setelah item ke-3 diserahkan');
    assert(partial2Data.data.handedOverNow === 1, 'handedOverNow harus 1');
    assert(partial2Data.data.totalHandedOver === 3, 'totalHandedOver harus 3');
    assert(partial2Data.data.totalItems === 3, 'totalItems harus 3');

    // Verifikasi order otomatis berubah menjadi COMPLETED
    const order1CheckFinal = await prisma.order.findUnique({
      where: { id: order1.id },
      include: { laundryDetail: true },
    });
    assert(order1CheckFinal!.orderStatus === OrderStatus.COMPLETED, 'Order status harus otomatis COMPLETED');
    assert(order1CheckFinal!.laundryDetail?.status === 'COMPLETED', 'Laundry detail status harus COMPLETED');
    assert(order1CheckFinal!.laundryDetail?.currentStage === 'HANDOVER', 'Stage laundry detail harus HANDOVER');
    assert(Boolean(order1CheckFinal!.laundryDetail?.pickedUpAt), 'pickedUpAt harus tercatat');
    assert(order1CheckFinal!.laundryDetail?.pickedUpBy === 'Bpk Joko (Suami Ibu Ratna)', 'pickedUpBy harus sesuai');
    console.log('   ✅ Tahap 2: Item terakhir diserahkan. Order otomatis COMPLETED & pickedUpAt tercatat sempurna.\n');

    console.log('================================================================================');
    console.log('🎉 SELURUH PENGUJIAN LAUNDRY CORE PHASE 2 BATCH 1 LULUS 100%!');
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
        `DELETE FROM "laundry_order_item_tracks" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_batch_items" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_batches" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_machines" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_stage_logs" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_order_details" WHERE "tenant_id" = $1`,
        `DELETE FROM "orders" WHERE "tenant_id" = $1`,
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
