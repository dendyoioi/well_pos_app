import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_dev_pos_jwt_12345';

async function runTestFase11() {
  console.log('========================================================================');
  console.log('🧪 TEST FASE 11: SISTEM KOMISI OTOMATIS STAF PRODUKSI & KURIR');
  console.log('========================================================================\n');

  let testOrderId1: string | null = null;
  let testOrderId2: string | null = null;
  let testOrderId3: string | null = null;
  let testCustomerId: string | null = null;

  try {
    // 1. Ambil outlet & owner laundry
    const owner = await prisma.user.findFirst({
      where: { email: 'owner.laundry@wellpos.id' },
      include: { tenant: { include: { outlets: true } } },
    });

    if (!owner || !owner.tenant) {
      throw new Error('User owner laundry tidak ditemukan');
    }

    const outlet = owner.tenant.outlets.find((o) => {
      const ind = Array.isArray(o.industries) ? o.industries : [];
      return ind.some((i: any) => String(i).toLowerCase().includes('laundry')) || o.name.toLowerCase().includes('laundry');
    }) || owner.tenant.outlets[0];

    if (!outlet) {
      throw new Error('Outlet laundry tidak ditemukan');
    }

    const loginRes = await fetch('http://127.0.0.1:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner.laundry@wellpos.id', password: 'pastiwell789' }),
    });
    const loginData: any = await loginRes.json();
    const token = loginData.data?.token;
    if (!token) {
      throw new Error(`Gagal login ke API: ${JSON.stringify(loginData)}`);
    }

    console.log(`🏢 Tenant: ${owner.tenant.name}`);
    console.log(`🏪 Outlet: ${outlet.name}\n`);

    // =======================================================================
    // TEST 1: Update & Get Laundry Commission Config
    // =======================================================================
    console.log('--- TEST 1: Update & Ambil Konfigurasi Komisi ---');
    const customConfig = {
      enabled: true,
      washingPerKg: 300,
      dryingPerKg: 200,
      ironingPerKg: 500,
      packingPerOrder: 500,
      deliveryPerTrip: 3000,
      pickupPerTrip: 2000,
      rewashPenaltyPerCase: 5000,
    };

    const putRes = await fetch('http://127.0.0.1:5001/api/laundry/commission-config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        outletId: outlet.id,
        config: customConfig,
      }),
    });
    const putJson = await putRes.json();
    console.log('PUT /commission-config status:', putRes.status, putJson.status);

    if (putRes.status !== 200 || putJson.status !== 'success') {
      throw new Error(`Gagal menyimpan konfigurasi komisi: ${JSON.stringify(putJson)}`);
    }

    const getRes = await fetch(`http://127.0.0.1:5001/api/laundry/commission-config?outletId=${outlet.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getJson = await getRes.json();
    console.log('GET /commission-config washingPerKg:', getJson.data?.config?.washingPerKg);

    if (getJson.data?.config?.washingPerKg !== 300 || getJson.data?.config?.ironingPerKg !== 500) {
      throw new Error('Config yang dikembalikan tidak sesuai dengan yang disimpan');
    }
    console.log('✅ [TEST 1] Update & Ambil Konfigurasi Komisi -> PASS\n');

    // =======================================================================
    // TEST 2: Buat Data Uji Produksi & Kurir
    // =======================================================================
    console.log('--- TEST 2: Menyiapkan Data Stage Logs & Deliveries Uji ---');
    const now = new Date();

    // Buat dummy customer
    const customer = await prisma.customer.create({
      data: {
        tenantId: outlet.tenantId,
        name: `[UAT-COMM] Pelanggan Komisi ${Date.now()}`,
        phone: `0819${Date.now().toString().slice(-8)}`,
      },
    });
    testCustomerId = customer.id;

    // Order 1 (Staff A: Budi)
    const order1 = await prisma.order.create({
      data: {
        tenant: { connect: { id: outlet.tenantId } },
        outlet: { connect: { id: outlet.id } },
        cashier: { connect: { id: owner.id } },
        invoiceNumber: `[UAT-COMM]-001-${Date.now()}`,
        orderStatus: 'IN_PROGRESS',
        paymentStatus: 'PAID',
        totalAmount: 100000,
        subtotal: 100000,
        customer: { connect: { id: customer.id } },
        laundryDetail: {
          create: {
            tenant: { connect: { id: outlet.tenantId } },
            outlet: { connect: { id: outlet.id } },
            status: 'PROCESSING',
            currentStage: 'IRONING',
            totalWeightKg: 10,
            deliveryType: 'NONE',
          },
        },
      },
      include: { laundryDetail: true },
    });
    testOrderId1 = order1.id;

    // Order 2 (Staff B: Siti)
    const order2 = await prisma.order.create({
      data: {
        tenant: { connect: { id: outlet.tenantId } },
        outlet: { connect: { id: outlet.id } },
        cashier: { connect: { id: owner.id } },
        invoiceNumber: `[UAT-COMM]-002-${Date.now()}`,
        orderStatus: 'IN_PROGRESS',
        paymentStatus: 'PAID',
        totalAmount: 150000,
        subtotal: 150000,
        customer: { connect: { id: customer.id } },
        laundryDetail: {
          create: {
            tenant: { connect: { id: outlet.tenantId } },
            outlet: { connect: { id: outlet.id } },
            status: 'PROCESSING',
            currentStage: 'COMPLETED',
            totalWeightKg: 15,
            deliveryType: 'NONE',
          },
        },
      },
      include: { laundryDetail: true },
    });
    testOrderId2 = order2.id;

    // Order 3 (Staff C / Kurir: Ahmad)
    const order3 = await prisma.order.create({
      data: {
        tenant: { connect: { id: outlet.tenantId } },
        outlet: { connect: { id: outlet.id } },
        cashier: { connect: { id: owner.id } },
        invoiceNumber: `[UAT-COMM]-003-${Date.now()}`,
        orderStatus: 'COMPLETED',
        paymentStatus: 'PAID',
        totalAmount: 50000,
        subtotal: 50000,
        customer: { connect: { id: customer.id } },
        laundryDetail: {
          create: {
            tenant: { connect: { id: outlet.tenantId } },
            outlet: { connect: { id: outlet.id } },
            status: 'COMPLETED',
            currentStage: 'COMPLETED',
            totalWeightKg: 5,
            deliveryType: 'PICKUP_AND_DELIVERY', // 1 jemput + 1 antar = 2 trip
            deliveryStatus: 'DELIVERED',
            courierName: '[UAT] Ahmad Kurir',
            deliveredAt: now,
          },
        },
      },
      include: { laundryDetail: true },
    });
    testOrderId3 = order3.id;

    // Tambah stage logs untuk Staff A ([UAT] Budi Santoso)
    await prisma.laundryStageLog.createMany({
      data: [
        {
          tenantId: outlet.tenantId,
          orderId: order1.id,
          laundryDetailId: order1.laundryDetail!.id,
          stage: 'CUCI', // Alias Bahasa Indonesia
          operatorName: '[UAT] Budi Santoso',
          weightKg: 10,
          completedAt: now,
        },
        {
          tenantId: outlet.tenantId,
          orderId: order1.id,
          laundryDetailId: order1.laundryDetail!.id,
          stage: 'KERING',
          operatorName: '[UAT] Budi Santoso',
          weightKg: 10,
          completedAt: now,
        },
        {
          tenantId: outlet.tenantId,
          orderId: order1.id,
          laundryDetailId: order1.laundryDetail!.id,
          stage: 'SETRIKA',
          operatorName: '[UAT] Budi Santoso',
          weightKg: 5,
          completedAt: now,
        },
        {
          tenantId: outlet.tenantId,
          orderId: order1.id,
          laundryDetailId: order1.laundryDetail!.id,
          stage: 'PENGEMASAN',
          operatorName: '[UAT] Budi Santoso',
          completedAt: now,
        },
        {
          tenantId: outlet.tenantId,
          orderId: order1.id,
          laundryDetailId: order1.laundryDetail!.id,
          stage: 'PACKING',
          operatorName: '[UAT] Budi Santoso',
          completedAt: now,
        },
      ],
    });

    // Tambah stage logs untuk Staff B ([UAT] Siti Aminah)
    await prisma.laundryStageLog.createMany({
      data: [
        {
          tenantId: outlet.tenantId,
          orderId: order2.id,
          laundryDetailId: order2.laundryDetail!.id,
          stage: 'IRONING',
          operatorName: '[UAT] Siti Aminah',
          weightKg: 15,
          completedAt: now,
        },
        {
          tenantId: outlet.tenantId,
          orderId: order2.id,
          laundryDetailId: order2.laundryDetail!.id,
          stage: 'PACKING',
          operatorName: '[UAT] Siti Aminah',
          completedAt: now,
        },
        {
          tenantId: outlet.tenantId,
          orderId: order2.id,
          laundryDetailId: order2.laundryDetail!.id,
          stage: 'REWASH',
          operatorName: '[UAT] Siti Aminah',
          completedAt: now,
        },
      ],
    });

    console.log('✅ [TEST 2] Data uji stage logs & deliveries berhasil disiapkan\n');

    // =======================================================================
    // TEST 3: Verifikasi Perhitungan Komisi GET /api/laundry/commissions
    // =======================================================================
    console.log('--- TEST 3: Verifikasi Kalkulasi Komisi Otomatis ---');
    const todayStr = now.toISOString().split('T')[0];
    const commRes = await fetch(
      `http://127.0.0.1:5001/api/laundry/commissions?outletId=${outlet.id}&startDate=${todayStr}&endDate=${todayStr}&search=%5BUAT%5D`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const commJson = await commRes.json();
    console.log('GET /commissions status:', commRes.status, commJson.status);

    if (commRes.status !== 200 || commJson.status !== 'success') {
      throw new Error(`Gagal mengambil data komisi: ${JSON.stringify(commJson)}`);
    }

    const { summary, staff } = commJson.data;
    console.log('Total Staf Terhitung:', summary.totalStaff);
    console.log('Total Komisi Produksi:', summary.totalProductionCommission);
    console.log('Total Komisi Delivery:', summary.totalDeliveryCommission);
    console.log('Total Penalti Rewash:', summary.totalPenalty);
    console.log('Grand Total Komisi:', summary.grandTotalCommission);

    // Verifikasi Staff A: Budi Santoso
    const budi = staff.find((s: any) => s.name === '[UAT] Budi Santoso');
    if (!budi) throw new Error('Staff Budi Santoso tidak ditemukan dalam laporan');

    console.log('\nVerifikasi Budi Santoso:');
    console.log(`- Cuci: ${budi.washingKg} Kg -> Rp ${budi.washingCommission}`);
    console.log(`- Kering: ${budi.dryingKg} Kg -> Rp ${budi.dryingCommission}`);
    console.log(`- Setrika: ${budi.ironingKg} Kg -> Rp ${budi.ironingCommission}`);
    console.log(`- Packing: ${budi.packingOrders} Nota -> Rp ${budi.packingCommission}`);
    console.log(`- Total Komisi Budi: Rp ${budi.totalCommission} (Peran: ${budi.roleType})`);

    // 10*300=3000, 10*200=2000, 5*500=2500, 2*500=1000 => Total = 8500
    if (budi.washingCommission !== 3000) throw new Error(`Komisi cuci Budi salah: ${budi.washingCommission}`);
    if (budi.dryingCommission !== 2000) throw new Error(`Komisi kering Budi salah: ${budi.dryingCommission}`);
    if (budi.ironingCommission !== 2500) throw new Error(`Komisi setrika Budi salah: ${budi.ironingCommission}`);
    if (budi.packingCommission !== 1000) throw new Error(`Komisi packing Budi salah: ${budi.packingCommission}`);
    if (budi.totalCommission !== 8500) throw new Error(`Total komisi Budi salah: ${budi.totalCommission}`);
    if (budi.roleType !== 'OPERATOR') throw new Error(`Role Budi salah: ${budi.roleType}`);

    // Verifikasi Staff B: Siti Aminah
    const siti = staff.find((s: any) => s.name === '[UAT] Siti Aminah');
    if (!siti) throw new Error('Staff Siti Aminah tidak ditemukan dalam laporan');

    console.log('\nVerifikasi Siti Aminah:');
    console.log(`- Setrika: ${siti.ironingKg} Kg -> Rp ${siti.ironingCommission}`);
    console.log(`- Packing: ${siti.packingOrders} Nota -> Rp ${siti.packingCommission}`);
    console.log(`- Penalti Rewash: -Rp ${siti.rewashPenalty}`);
    console.log(`- Total Komisi Siti: Rp ${siti.totalCommission} (Peran: ${siti.roleType})`);

    // 15*500=7500, 1*500=500, rewash penalty 1*5000=5000 => Total = (7500+500) - 5000 = 3000
    if (siti.ironingCommission !== 7500) throw new Error(`Komisi setrika Siti salah: ${siti.ironingCommission}`);
    if (siti.packingCommission !== 500) throw new Error(`Komisi packing Siti salah: ${siti.packingCommission}`);
    if (siti.rewashPenalty !== 5000) throw new Error(`Penalti rewash Siti salah: ${siti.rewashPenalty}`);
    if (siti.totalCommission !== 3000) throw new Error(`Total komisi Siti salah: ${siti.totalCommission}`);

    // Verifikasi Staff C: Ahmad Kurir
    const ahmad = staff.find((s: any) => s.name === '[UAT] Ahmad Kurir');
    if (!ahmad) throw new Error('Staff Ahmad Kurir tidak ditemukan dalam laporan');

    console.log('\nVerifikasi Ahmad Kurir:');
    console.log(`- Trip Jemput: ${ahmad.pickupTrips}`);
    console.log(`- Trip Antar: ${ahmad.deliveryTrips}`);
    console.log(`- Komisi Delivery: Rp ${ahmad.deliveryCommission}`);
    console.log(`- Total Komisi Ahmad: Rp ${ahmad.totalCommission} (Peran: ${ahmad.roleType})`);

    // 1 jemput @ 2000 + 1 antar @ 3000 = 5000
    if (ahmad.pickupTrips !== 1) throw new Error(`Pickup trips Ahmad salah: ${ahmad.pickupTrips}`);
    if (ahmad.deliveryTrips !== 1) throw new Error(`Delivery trips Ahmad salah: ${ahmad.deliveryTrips}`);
    if (ahmad.deliveryCommission !== 5000) throw new Error(`Komisi delivery Ahmad salah: ${ahmad.deliveryCommission}`);
    if (ahmad.totalCommission !== 5000) throw new Error(`Total komisi Ahmad salah: ${ahmad.totalCommission}`);
    if (ahmad.roleType !== 'COURIER') throw new Error(`Role Ahmad salah: ${ahmad.roleType}`);

    console.log('✅ [TEST 3] Seluruh kalkulasi komisi (Cuci, Kering, Setrika, Packing, Kurir & Penalti) -> 100% PASS\n');
  } catch (error: any) {
    console.error('❌ FATAL ERROR TEST FASE 11:', error.message);
    process.exit(1);
  } finally {
    console.log('🧹 Membersihkan data uji [UAT-COMM] dari DB lokal...');
    try {
      if (testOrderId1) {
        await prisma.laundryStageLog.deleteMany({ where: { orderId: testOrderId1 } });
        await prisma.laundryOrderDetail.deleteMany({ where: { orderId: testOrderId1 } });
        await prisma.order.delete({ where: { id: testOrderId1 } }).catch(() => {});
      }
      if (testOrderId2) {
        await prisma.laundryStageLog.deleteMany({ where: { orderId: testOrderId2 } });
        await prisma.laundryOrderDetail.deleteMany({ where: { orderId: testOrderId2 } });
        await prisma.order.delete({ where: { id: testOrderId2 } }).catch(() => {});
      }
      if (testOrderId3) {
        await prisma.laundryStageLog.deleteMany({ where: { orderId: testOrderId3 } });
        await prisma.laundryOrderDetail.deleteMany({ where: { orderId: testOrderId3 } });
        await prisma.order.delete({ where: { id: testOrderId3 } }).catch(() => {});
      }
      if (testCustomerId) {
        await prisma.customer.delete({ where: { id: testCustomerId } }).catch(() => {});
      }
      console.log('✅ Pembersihan data uji selesai (DB lokal bersih).\n');
    } catch (cleanErr: any) {
      console.warn('Peringatan pembersihan data uji:', cleanErr.message);
    }
    await prisma.$disconnect();
  }
}

runTestFase11().catch(console.error);
