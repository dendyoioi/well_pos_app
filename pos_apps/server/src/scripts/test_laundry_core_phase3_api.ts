/**
 * Test Suite: Laundry Core Engine — CORE PHASE 3 (Growth, Self-Service & Automation) — BATCH 1
 * 
 * Menguji secara komprehensif:
 * 1. Schema Patcher Idempotency (runAutoSchemaPatcher dijalankan 2x berturut-turut tanpa error)
 * 2. Pilar 1: Customer Self-Service Portal API (/api/public/laundry/portal/*)
 *    - Info publik outlet & delivery config
 *    - Login / session portal via nomor HP (JWT sesi CUSTOMER_PORTAL)
 *    - Cek profil, saldo deposit, kuota kiloan, & order aktif (/me)
 *    - Kirim permintaan jemput cucian mandiri (LaundryPickupRequest)
 * 3. Pilar 2: Driver Board & Task Management + Delivery Failure (/api/laundry/core3/*)
 *    - Penugasan kurir & update status permintaan jemput
 *    - Pencatatan gagal jemput (attemptCount, lastFailureReason, rescheduledAt)
 *    - Papan tugas terpadu kurir (pickupTasks & deliveryTasks)
 *    - Pencatatan gagal antar cucian (deliveryAttemptCount, deliveryStatus)
 * 4. Pilar 3: Centralized Notification Automation Engine
 *    - 7 canonical events (DEFAULT_AUTOMATION_RULES)
 *    - Toggle on/off & kustomisasi template WhatsApp/In-App
 *    - Simulasi event & render variabel {{placeholder}}
 *    - Log dispatch & retry mekanisme notifikasi gagal
 * 5. Zero Database Residue (Pembersihan tuntas di blok finally)
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role, OrderStatus, PaymentStatus } from '@prisma/client';
import { runAutoSchemaPatcher } from '../migrations/schema_patcher';
import publicLaundryPortalRouter from '../routes/public_laundry_portal.routes';
import laundryCorePhase3Router from '../routes/laundry_core_phase3.routes';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'wellpos-default-jwt-secret';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('🧪 RUNNING LAUNDRY CORE ENGINE PHASE 3 INTEGRATION TESTS (BATCH 1)');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // LANGKAH 1: UJI IDEMPOTENSI AUTO SCHEMA PATCHER (2x EKSEKUSI)
  // --------------------------------------------------------------------------
  console.log('▶️ [LANGKAH 1] Menguji Idempotensi Auto Schema Patcher...');
  console.log('   Running Schema Patcher Pass 1...');
  await runAutoSchemaPatcher(prisma);
  console.log('   Running Schema Patcher Pass 2 (Idempotency Check)...');
  await runAutoSchemaPatcher(prisma);
  console.log('   ✅ Schema Patcher Phase 3 terbukti 100% idempotent tanpa error.\n');

  const timestamp = Date.now().toString();
  let createdTenantId = '';

  // Setup Express server transient
  const app = express();
  app.use(express.json());
  app.use('/api/public/laundry/portal', publicLaundryPortalRouter);
  app.use('/api/laundry/core3', laundryCorePhase3Router);

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
        name: `Tenant Uji Core Phase 3 ${timestamp.slice(-4)}`,
        slug: `test-core-phase3-${timestamp}`,
        businessType: 'LAUNDRY',
      },
    });
    createdTenantId = tenant.id;

    // 2. Business
    const business = await prisma.business.create({
      data: {
        tenantId: tenant.id,
        name: 'Laundry Express Hub',
        slug: `laundry-hub-${timestamp}`,
        vertical: 'LAUNDRY',
        isActive: true,
      },
    });

    // 3. Outlet dengan laundryDeliveryConfig
    const outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        businessId: business.id,
        code: `OUT-P3-${timestamp.slice(-4)}`,
        name: 'Laundry Central Delivery Hub',
        address: 'Jl. Merdeka Barat No. 88, Jakarta',
        phone: '+6287711223399',
        industries: ['LAUNDRY'],
        isActive: true,
        laundryDeliveryConfig: {
          enabled: true,
          fixedFee: 15000,
          freeDeliveryThreshold: 100000,
          maxCoverageKm: 10,
        },
      },
    });

    // 4. Staff Users (Owner & Driver/Cashier)
    const ownerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        userCode: `OWN-${timestamp.slice(-4)}`,
        name: 'Pak Budi Core3 Owner',
        email: `owner.p3.${timestamp}@wellpos.test`,
        passwordHash: 'dummy-hash',
        role: Role.OWNER,
        isActive: true,
      },
    });

    const driverUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userCode: `DRV-${timestamp.slice(-4)}`,
        name: 'Dani Express Driver',
        email: `driver.p3.${timestamp}@wellpos.test`,
        passwordHash: 'dummy-hash',
        role: Role.CASHIER,
        isActive: true,
      },
    });

    const ownerToken = jwt.sign(
      {
        userId: ownerUser.id,
        role: ownerUser.role,
        outletId: outlet.id,
        tenantId: tenant.id,
        tokenVersion: 1,
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 5. Customer dengan Wallet Deposit & Kuota Kiloan
    const customerPhone = '+6281234567800';
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        code: `CUST3-${timestamp.slice(-4)}`,
        name: 'Ibu Maya Mandiri',
        phone: customerPhone,
        address: 'Jl. Melati Blok C2 No. 15',
        loyaltyPoints: 120,
        tier: 'GOLD',
        laundryPreferences: {
          detergentType: 'Hypoallergenic',
          perfumeVariant: 'Lavender Breeze',
          hangingRatio: 50,
        },
      },
    });

    const wallet = await prisma.customerLaundryWallet.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        balanceAmount: 50000, // Rp 50.000 saldo deposit
        quotaKg: 15.0,  // 15 Kg paket laundry aktif
      },
    });

    // 6. Active Delivery Order
    const order1 = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: driverUser.id,
        customerId: customer.id,
        invoiceNumber: `INV-P3-${timestamp.slice(-4)}`,
        subtotal: 75000,
        totalAmount: 75000,
        orderStatus: OrderStatus.IN_PROGRESS,
        paymentStatus: PaymentStatus.PAID,
      },
    });

    const detail1 = await prisma.laundryOrderDetail.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        orderId: order1.id,
        currentStage: 'WASHING',
        totalWeightKg: 4.5,
        totalPieces: 12,
        deliveryType: 'PICKUP_AND_DELIVERY',
        deliveryStatus: 'PENDING',
        rackCode: 'RCK-01',
      },
    });

    console.log('   ✅ Seeding tenant, outlet, owner, driver, customer & order berhasil.\n');

    // ==========================================================================
    // PILAR 1: CUSTOMER SELF-SERVICE PORTAL API (/api/public/laundry/portal/*)
    // ==========================================================================
    console.log('▶️ [PILAR 1] Pengujian Customer Self-Service Portal API...');

    // 1.1 Info Publik Outlet & Katalog Layanan
    console.log('   1.1 Menguji GET /api/public/laundry/portal/outlet/:outletId...');
    const outletInfoRes = await fetch(`${baseUrl}/api/public/laundry/portal/outlet/${outlet.id}`);
    assert(outletInfoRes.status === 200, `GET outlet info harus 200, aktual: ${outletInfoRes.status}`);
    const outletInfoData = await outletInfoRes.json();
    assert(outletInfoData.status === 'success', 'Status harus success');
    assert(outletInfoData.data.outlet.name === 'Laundry Central Delivery Hub', 'Nama outlet harus sesuai');
    assert(outletInfoData.data.outlet.deliveryConfig?.enabled === true, 'deliveryConfig.enabled harus true');
    assert(outletInfoData.data.outlet.deliveryConfig?.fixedFee === 15000, 'fixedFee harus 15000');
    console.log('   ✅ 1.1 Info publik outlet & delivery config berhasil diambil.');

    // 1.2 Mulai / Verifikasi Sesi Portal via Nomor HP
    console.log('   1.2 Menguji POST /api/public/laundry/portal/session (Known Customer)...');
    const sessionRes = await fetch(`${baseUrl}/api/public/laundry/portal/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: outlet.id,
        phone: customerPhone,
      }),
    });
    assert(sessionRes.status === 200, `POST session harus 200, aktual: ${sessionRes.status}`);
    const sessionData = await sessionRes.json();
    assert(sessionData.status === 'success', 'Status harus success');
    assert(sessionData.data.isNewCustomer === false, 'isNewCustomer harus false untuk pelanggan terdaftar');
    assert(Boolean(sessionData.data.token), 'JWT token sesi portal harus ada');
    assert(sessionData.data.customer.name === 'Ibu Maya Mandiri', 'Nama customer harus Ibu Maya Mandiri');
    const portalToken = sessionData.data.token;
    console.log('   ✅ 1.2 Sesi portal pelanggan berhasil dibuat & token JWT terverifikasi.');

    // 1.3 Cek Profil, Saldo/Kuota Laundry, & Order Aktif (/me)
    console.log('   1.3 Menguji GET /api/public/laundry/portal/me...');
    const meRes = await fetch(`${baseUrl}/api/public/laundry/portal/me`, {
      headers: { Authorization: `Bearer ${portalToken}` },
    });
    assert(meRes.status === 200, `GET /me harus 200, aktual: ${meRes.status}`);
    const meData = await meRes.json();
    assert(meData.data.customer.id === customer.id, 'Customer ID harus cocok');
    assert(Number(meData.data.wallet.balanceAmount) === 50000, 'Saldo wallet harus Rp 50.000');
    assert(Number(meData.data.wallet.quotaKg) === 15.0, 'Kuota kiloan harus 15.0 Kg');
    assert(meData.data.activeOrders.length >= 1, 'Harus ada minimal 1 active order');
    assert(meData.data.activeOrders[0].invoiceNumber === `INV-P3-${timestamp.slice(-4)}`, 'Invoice number harus sesuai');
    console.log('   ✅ 1.3 Profil akun, wallet deposit Rp 50.000, kuota 15 Kg & order aktif valid.');

    // 1.4 Kirim Permintaan Jemput Cucian Mandiri (LaundryPickupRequest)
    console.log('   1.4 Menguji POST /api/public/laundry/portal/pickup-requests...');
    const pickupReqRes = await fetch(`${baseUrl}/api/public/laundry/portal/pickup-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${portalToken}`,
      },
      body: JSON.stringify({
        customerName: 'Ibu Maya Mandiri',
        pickupAddress: 'Jl. Melati Blok C2 No. 15, Dekat Pos Satpam',
        pickupNotes: 'Tolong jemput sebelum jam 2 siang, ada di rumah.',
        estimatedWeightKg: 5.5,
        serviceCategory: 'KILOAN',
      }),
    });
    assert(pickupReqRes.status === 201, `POST pickup-requests harus 201, aktual: ${pickupReqRes.status}`);
    const pickupReqData = await pickupReqRes.json();
    assert(pickupReqData.status === 'success', 'Status harus success');
    const createdPickup = pickupReqData.data;
    assert(createdPickup.requestCode.startsWith('PKP-'), 'Request code harus diawali PKP-');
    assert(createdPickup.status === 'PENDING', 'Status awal harus PENDING');
    assert(createdPickup.customerId === customer.id, 'Customer ID harus terhubung otomatis');
    assert(Number(createdPickup.estimatedWeightKg) === 5.5, 'Estimasi berat harus 5.5 Kg');
    console.log(`   ✅ 1.4 Permintaan jemput berhasil dibuat: ${createdPickup.requestCode} (Status: PENDING).\n`);

    // ==========================================================================
    // PILAR 2: DRIVER ASSIGNMENT & FAILED ATTEMPT HANDLING
    // ==========================================================================
    console.log('▶️ [PILAR 2] Pengujian Driver Assignment & Failed Attempt Handling...');

    // 2.1 Ambil Daftar Permintaan Jemput oleh Staff
    console.log('   2.1 Menguji GET /api/laundry/core3/pickup-requests...');
    const listPickupsRes = await fetch(`${baseUrl}/api/laundry/core3/pickup-requests`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(listPickupsRes.status === 200, `GET pickup-requests harus 200, aktual: ${listPickupsRes.status}`);
    const listPickupsData = await listPickupsRes.json();
    assert(listPickupsData.data.length >= 1, 'Harus ada minimal 1 permintaan jemput');
    const targetPickup = listPickupsData.data.find((p: any) => p.id === createdPickup.id);
    assert(Boolean(targetPickup), 'Permintaan jemput yang baru dibuat harus ditemukan di antrean');
    console.log('   ✅ 2.1 Permintaan jemput muncul di daftar antrean staf.');

    // 2.2 Tugaskan Kurir (Assign Pickup Request)
    console.log('   2.2 Menguji PATCH /api/laundry/core3/pickup-requests/:id/assign...');
    const assignRes = await fetch(`${baseUrl}/api/laundry/core3/pickup-requests/${createdPickup.id}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        courierName: 'Dani Express',
        courierPhone: '+6287711223399',
        assignedDriverId: driverUser.id,
        routeOrder: 1,
        status: 'DRIVER_ASSIGNED',
      }),
    });
    assert(assignRes.status === 200, `PATCH assign harus 200, aktual: ${assignRes.status}`);
    const assignData = await assignRes.json();
    assert(assignData.data.status === 'DRIVER_ASSIGNED', 'Status harus DRIVER_ASSIGNED');
    assert(assignData.data.courierName === 'Dani Express', 'Nama kurir harus Dani Express');
    assert(assignData.data.routeOrder === 1, 'Route order harus 1');

    // Verifikasi otomatis terkirim notifikasi PICKUP_REQUEST_CONFIRMED
    const pickupNotifLog = await prisma.notificationDispatchLog.findFirst({
      where: {
        tenantId: tenant.id,
        eventKey: 'PICKUP_REQUEST_CONFIRMED',
        referenceId: createdPickup.id,
      },
    });
    assert(Boolean(pickupNotifLog), 'Log notifikasi PICKUP_REQUEST_CONFIRMED harus otomatis ter-create');
    assert(pickupNotifLog!.status === 'SENT', 'Notifikasi harus SENT');
    console.log('   ✅ 2.2 Penugasan kurir berhasil & notifikasi konfirmasi jemput otomatis tercatat.');

    // 2.3 Catat Percobaan Jemput Gagal (Failed Attempt)
    console.log('   2.3 Menguji POST /api/laundry/core3/pickup-requests/:id/failed-attempt...');
    const failedPickupRes = await fetch(
      `${baseUrl}/api/laundry/core3/pickup-requests/${createdPickup.id}/failed-attempt`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          reason: 'Pintu pagar terkunci & telepon tidak diangkat',
          rescheduledAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      }
    );
    assert(failedPickupRes.status === 200, `POST failed-attempt harus 200, aktual: ${failedPickupRes.status}`);
    const failedPickupData = await failedPickupRes.json();
    assert(failedPickupData.data.status === 'FAILED_ATTEMPT', 'Status harus FAILED_ATTEMPT');
    assert(failedPickupData.data.attemptCount === 1, 'attemptCount harus 1');
    assert(
      failedPickupData.data.lastFailureReason === 'Pintu pagar terkunci & telepon tidak diangkat',
      'Alasan kegagalan harus sesuai'
    );
    assert(Boolean(failedPickupData.data.rescheduledAt), 'rescheduledAt harus tercatat');

    // Verifikasi otomatis terkirim notifikasi DELIVERY_FAILED
    const failedNotifLog = await prisma.notificationDispatchLog.findFirst({
      where: {
        tenantId: tenant.id,
        eventKey: 'DELIVERY_FAILED',
        referenceId: createdPickup.id,
      },
    });
    assert(Boolean(failedNotifLog), 'Log notifikasi DELIVERY_FAILED harus otomatis dibuat');
    console.log('   ✅ 2.3 Percobaan jemput gagal tercatat (attempt: 1) & notifikasi terkirim.');

    // 2.4 Papan Tugas Terpadu Driver (Driver Board)
    console.log('   2.4 Menguji GET /api/laundry/core3/driver-board...');
    const driverBoardRes = await fetch(`${baseUrl}/api/laundry/core3/driver-board`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(driverBoardRes.status === 200, `GET driver-board harus 200, aktual: ${driverBoardRes.status}`);
    const driverBoardData = await driverBoardRes.json();
    assert(driverBoardData.data.pickupTasks.length >= 1, 'Harus ada tugas jemput di driver board');
    assert(driverBoardData.data.deliveryTasks.length >= 1, 'Harus ada tugas antar di driver board');
    assert(driverBoardData.data.summary.totalFailedAttempts >= 1, 'Summary totalFailedAttempts harus >= 1');
    assert(driverBoardData.data.summary.totalActiveDeliveries >= 1, 'Summary totalActiveDeliveries harus >= 1');
    console.log('   ✅ 2.4 Driver board memuat penjemputan & pengantaran terintegrasi.');

    // 2.5 Catat Percobaan Antar Pesanan Gagal (Delivery Failed)
    console.log('   2.5 Menguji POST /api/laundry/core3/orders/:orderId/delivery-failed...');
    const orderDeliveryFailedRes = await fetch(
      `${baseUrl}/api/laundry/core3/orders/${order1.id}/delivery-failed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          reason: 'Penerima sedang keluar kota & hujan lebat',
          rescheduledAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      }
    );
    assert(
      orderDeliveryFailedRes.status === 200,
      `POST delivery-failed harus 200, aktual: ${orderDeliveryFailedRes.status}`
    );
    const orderDeliveryFailedData = await orderDeliveryFailedRes.json();
    assert(
      orderDeliveryFailedData.data.deliveryStatus === 'FAILED_ATTEMPT',
      'deliveryStatus harus FAILED_ATTEMPT'
    );
    assert(
      orderDeliveryFailedData.data.deliveryAttemptCount === 1,
      'deliveryAttemptCount harus 1'
    );
    assert(
      orderDeliveryFailedData.data.deliveryLastFailureReason === 'Penerima sedang keluar kota & hujan lebat',
      'Alasan gagal antar harus sesuai'
    );
    console.log('   ✅ 2.5 Percobaan antar pesanan gagal tercatat sempurna pada LaundryOrderDetail.\n');

    // ==========================================================================
    // PILAR 3: NOTIFICATION & AUTOMATION ENGINE
    // ==========================================================================
    console.log('▶️ [PILAR 3] Pengujian Notification & Automation Engine...');

    // 3.1 Ambil 7 Canonical Rules
    console.log('   3.1 Menguji GET /api/laundry/core3/automation/rules...');
    const rulesRes = await fetch(`${baseUrl}/api/laundry/core3/automation/rules`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(rulesRes.status === 200, `GET rules harus 200, aktual: ${rulesRes.status}`);
    const rulesData = await rulesRes.json();
    assert(rulesData.data.length === 7, `Harus ada 7 aturan baku otomasi, aktual: ${rulesData.data.length}`);
    const orderReadyRule = rulesData.data.find((r: any) => r.eventKey === 'ORDER_READY');
    assert(Boolean(orderReadyRule), 'Aturan ORDER_READY harus tersedia');
    console.log('   ✅ 3.1 Tujuh aturan baku notifikasi otomatis terkonfirmasi lengkap.');

    // 3.2 Nonaktifkan Aturan ORDER_READY (Toggle Off)
    console.log('   3.2 Menguji PUT /api/laundry/core3/automation/rules/ORDER_READY (Disable)...');
    const disableRuleRes = await fetch(
      `${baseUrl}/api/laundry/core3/automation/rules/ORDER_READY`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          isEnabled: false,
          channels: ['WHATSAPP', 'IN_APP'],
          messageTemplate: 'Halo {{customerName}}, cucian Anda #{{invoiceNumber}} sudah SELESAI di {{outletName}}.',
        }),
      }
    );
    assert(disableRuleRes.status === 200, `PUT rule harus 200, aktual: ${disableRuleRes.status}`);
    const disableRuleData = await disableRuleRes.json();
    assert(disableRuleData.data.isEnabled === false, 'isEnabled harus false setelah di-disable');

    // Simulasi event ORDER_READY saat disabled -> harus SKIPPED
    console.log('   3.3 Simulasi ORDER_READY saat disabled (harus SKIPPED)...');
    const simSkippedRes = await fetch(`${baseUrl}/api/laundry/core3/automation/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        eventKey: 'ORDER_READY',
        recipientPhone: customerPhone,
        recipientName: 'Ibu Maya Mandiri',
        variables: {
          orderNumber: 'ORD-TEST-001',
          outletName: 'Laundry Central',
          totalAmount: '45.000',
        },
      }),
    });
    assert(simSkippedRes.status === 200, `POST simulate harus 200, aktual: ${simSkippedRes.status}`);
    const simSkippedData = await simSkippedRes.json();
    assert(simSkippedData.data[0].status === 'SKIPPED', 'Status dispatch harus SKIPPED saat rule dimatikan');
    console.log('   ✅ 3.3 Event otomatis di-skip (tidak terkirim) saat status rule nonaktif.');

    // 3.4 Aktifkan Kembali dengan Template Kustom
    console.log('   3.4 Menguji PUT /api/laundry/core3/automation/rules/ORDER_READY (Enable + Custom Template)...');
    const customTemplate = 'Halo {{customerName}}, cucian Anda {{orderNumber}} di {{outletName}} telah SELESAI & WANGI! Total: Rp {{totalAmount}}.';
    const enableRuleRes = await fetch(
      `${baseUrl}/api/laundry/core3/automation/rules/ORDER_READY`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          isEnabled: true,
          channels: ['WHATSAPP', 'IN_APP'],
          messageTemplate: customTemplate,
        }),
      }
    );
    assert(enableRuleRes.status === 200, `PUT rule enable harus 200, aktual: ${enableRuleRes.status}`);
    const enableRuleData = await enableRuleRes.json();
    assert(enableRuleData.data.isEnabled === true, 'isEnabled harus true');
    assert(enableRuleData.data.messageTemplate === customTemplate, 'Template kustom harus tersimpan');

    // Simulasi event ORDER_READY saat enabled -> harus SENT & template variabel ter-render
    console.log('   3.5 Simulasi ORDER_READY saat enabled (harus SENT & ter-render)...');
    const simSentRes = await fetch(`${baseUrl}/api/laundry/core3/automation/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        eventKey: 'ORDER_READY',
        recipientPhone: customerPhone,
        recipientName: 'Ibu Maya Mandiri',
        variables: {
          customerName: 'Ibu Maya Mandiri',
          orderNumber: 'ORD-TEST-001',
          outletName: 'Laundry Central',
          totalAmount: '45.000',
        },
      }),
    });
    assert(simSentRes.status === 200, `POST simulate sent harus 200, aktual: ${simSentRes.status}`);
    const simSentData = await simSentRes.json();
    assert(simSentData.data[0].status === 'SENT', 'Status dispatch harus SENT');
    assert(
      simSentData.data[0].messageBody === 'Halo Ibu Maya Mandiri, cucian Anda ORD-TEST-001 di Laundry Central telah SELESAI & WANGI! Total: Rp 45.000.',
      'Variabel template harus ter-render sempurna'
    );
    console.log('   ✅ 3.5 Template variabel {{placeholder}} berhasil di-render & status SENT.');

    // 3.6 Riwayat Log Notifikasi
    console.log('   3.6 Menguji GET /api/laundry/core3/automation/logs...');
    const logsRes = await fetch(`${baseUrl}/api/laundry/core3/automation/logs`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(logsRes.status === 200, `GET logs harus 200, aktual: ${logsRes.status}`);
    const logsData = await logsRes.json();
    assert(logsData.data.length >= 3, 'Log notifikasi harus mencatat minimal 3 aktivitas');
    assert(Boolean(logsData.summary), 'Metadata summary harus ada');
    console.log('   ✅ 3.6 Riwayat dispatch log beserta paginasi berhasil diambil.');

    // 3.7 Mekanisme Retry Pengiriman Notifikasi Gagal
    console.log('   3.7 Menguji POST /api/laundry/core3/automation/logs/:logId/retry...');
    // Buat dummy log gagal langsung di database
    const failedLog = await prisma.notificationDispatchLog.create({
      data: {
        tenantId: tenant.id,
        eventKey: 'QUOTA_EXPIRING',
        channel: 'WHATSAPP',
        recipientPhone: customerPhone,
        recipientName: 'Ibu Maya Mandiri',
        messageBody: 'Kuota laundry Anda tersisa 3 hari lagi.',
        status: 'FAILED',
        errorMessage: 'Simulated network timeout connection refused',
      },
    });

    const retryRes = await fetch(`${baseUrl}/api/laundry/core3/automation/logs/${failedLog.id}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(retryRes.status === 200, `POST retry harus 200, aktual: ${retryRes.status}`);
    const retryData = await retryRes.json();
    assert(retryData.data.status === 'RETRIED', 'Status setelah retry harus RETRIED');
    assert(retryData.data.retryCount === 1, 'retryCount harus bertambah menjadi 1');
    assert(retryData.data.errorMessage === null, 'errorMessage harus ter-reset null');
    console.log('   ✅ 3.7 Log gagal berhasil di-retry (retryCount: 1, status: RETRIED).\n');

    console.log('================================================================================');
    console.log('🎉 SELURUH PENGUJIAN LAUNDRY CORE PHASE 3 BATCH 1 LULUS 100%!');
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
        `DELETE FROM "notification_dispatch_logs" WHERE "tenant_id" = $1`,
        `DELETE FROM "notification_automation_rules" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_pickup_requests" WHERE "tenant_id" = $1`,
        `DELETE FROM "laundry_order_details" WHERE "tenant_id" = $1`,
        `DELETE FROM "orders" WHERE "tenant_id" = $1`,
        `DELETE FROM "customer_laundry_wallets" WHERE "tenant_id" = $1`,
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
