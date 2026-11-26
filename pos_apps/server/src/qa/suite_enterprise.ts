import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import {
  assert,
  createIsolatedQATenant,
  createTransientQAServer,
  cleanupQATenant,
  printSuiteSummary,
  TestScenarioResult,
} from './qa_helpers';

export async function runEnterpriseSuite(): Promise<boolean> {
  console.log('================================================================================');
  console.log('🏢 [SUITE 3/4] QA: ENTERPRISE, SDM, SHIFT TEMPLATES, REVIEWS & DELIVERY');
  console.log('================================================================================\n');

  const results: TestScenarioResult[] = [];
  let tenantData: any = null;
  let serverInstance: any = null;

  try {
    console.log('🌱 Menyiapkan data seeder tenant & transient Express server...');
    tenantData = await createIsolatedQATenant('QA_ENT');
    serverInstance = await createTransientQAServer();
    const { baseUrl } = serverInstance;
    const { tenantId, outletId, shiftId, ownerId, authHeaders, timestamp } = tenantData;

    let createdTemplateId = '';
    let testOrderId = '';
    let createdCustomerId = '';
    let testInventoryItemId = '';

    // Siapkan Inventory Item untuk Procurement PR
    const item = await prisma.inventoryItem.create({
      data: {
        tenantId,
        itemCode: `ITM-ENT-${timestamp.slice(-4)}`,
        name: 'Deterjen Laundry 5L QA',
        canonicalUom: 'BOTTLE',
        averageCost: new Prisma.Decimal(45000),
      },
    });
    testInventoryItemId = item.id;

    // Siapkan Order & Customer untuk Insiden & Dompet
    const custRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Pelanggan Enterprise QA', phone: `+62813${timestamp.slice(-8)}` }),
    });
    createdCustomerId = (await custRes.json() as any).data.id;

    const testOrder = await prisma.order.create({
      data: {
        tenantId,
        outletId,
        userId: ownerId,
        shiftId,
        customerId: createdCustomerId,
        invoiceNumber: `INV-ENT-${timestamp.slice(-4)}`,
        subtotal: new Prisma.Decimal(75000),
        totalAmount: new Prisma.Decimal(75000),
        orderStatus: 'COMPLETED',
        paymentStatus: 'PAID',
      },
    });
    testOrderId = testOrder.id;

    // -------------------------------------------------------------------------
    // 1. Shift Templates & Roster Jadwal CRUD & Persistence
    // -------------------------------------------------------------------------
    const t0 = Date.now();
    try {
      console.log('▶️ [1/7] Menguji Shift Templates & Roster Jadwal...');
      const createTplRes = await fetch(`${baseUrl}/api/attendance/shift-templates`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          name: 'Shift Pagi Produksi QA',
          startTime: '07:00',
          endTime: '15:00',
          colorHex: '#2563EB',
          graceMinutes: 15,
          isOffDay: false,
        }),
      });
      assert(createTplRes.status === 201, `Gagal membuat shift template: HTTP ${createTplRes.status}`);
      createdTemplateId = (await createTplRes.json() as any).data.id;

      // Update Template
      const updateTplRes = await fetch(`${baseUrl}/api/attendance/shift-templates/${createdTemplateId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Shift Pagi Produksi QA (Revisi)',
          startTime: '08:00',
          endTime: '16:00',
          colorHex: '#1D4ED8',
          graceMinutes: 25,
          isActive: true,
        }),
      });
      assert(updateTplRes.status === 200, `Gagal update shift template: HTTP ${updateTplRes.status}`);

      // Re-fetch dan assert
      const getTplRes = await fetch(`${baseUrl}/api/attendance/shift-templates?outletId=${outletId}`, { headers: authHeaders });
      const tplList = (await getTplRes.json() as any).data;
      const verifiedTpl = tplList.find((t: any) => t.id === createdTemplateId);
      assert(verifiedTpl?.name === 'Shift Pagi Produksi QA (Revisi)', 'Nama shift template tidak persisten');
      assert(verifiedTpl?.graceMinutes === 25, 'graceMinutes shift template tidak persisten');
      assert(verifiedTpl?.colorHex === '#1D4ED8', 'colorHex shift template tidak persisten');

      results.push({ name: 'Shift Templates & Roster CRUD & GraceMinutes Persistence', status: 'PASS', durationMs: Date.now() - t0 });
    } catch (err: any) {
      results.push({ name: 'Shift Templates & Roster CRUD & GraceMinutes Persistence', status: 'FAIL', durationMs: Date.now() - t0, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 2. Insiden Produksi & Proteksi Kompensasi
    // -------------------------------------------------------------------------
    const t1 = Date.now();
    try {
      console.log('▶️ [2/7] Menguji Insiden Produksi & Kompensasi...');
      const createIncRes = await fetch(`${baseUrl}/api/laundry/incidents`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          orderId: testOrderId,
          incidentType: 'DAMAGED',
          itemDescription: 'Blouse Sutra Merah',
          stage: 'IRONING',
          notes: 'Noda panas setrika di kelim baju',
          estimatedCompensation: 50000,
        }),
      });
      assert(createIncRes.status === 201, `Gagal membuat insiden: HTTP ${createIncRes.status}`);
      const incId = (await createIncRes.json() as any).data.id;

      // Update Insiden
      const updateIncRes = await fetch(`${baseUrl}/api/laundry/incidents/${incId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          status: 'APPROVED',
          approvedCompensation: 65000,
          resolutionNotes: 'Disetujui kompensasi tunai Rp 65.000',
        }),
      });
      assert(updateIncRes.status === 200, `Gagal update insiden: HTTP ${updateIncRes.status}`);

      // Re-fetch dan assert
      const getIncRes = await fetch(`${baseUrl}/api/laundry/incidents?outletId=${outletId}`, { headers: authHeaders });
      const incList = (await getIncRes.json() as any).data;
      const verifiedInc = incList.find((i: any) => i.id === incId);
      assert(verifiedInc?.status === 'APPROVED', 'Status insiden tidak persisten');
      assert(Number(verifiedInc?.approvedCompensation) === 65000, 'approvedCompensation insiden tidak persisten');

      results.push({ name: 'Insiden Produksi & Kompensasi Approval Persistence', status: 'PASS', durationMs: Date.now() - t1 });
    } catch (err: any) {
      results.push({ name: 'Insiden Produksi & Kompensasi Approval Persistence', status: 'FAIL', durationMs: Date.now() - t1, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 3. Evaluasi Kinerja Karyawan (Rentang Skor 0 - 100)
    // -------------------------------------------------------------------------
    const t2 = Date.now();
    try {
      console.log('▶️ [3/7] Menguji Evaluasi Kinerja Karyawan...');
      const createReviewRes = await fetch(`${baseUrl}/api/laundry/staff-performance/reviews`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          userId: ownerId,
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          disciplineScore: 95,
          productivityScore: 92,
          qualityScore: 90,
          customerScore: 94,
          overallScore: 93,
          grade: 'A',
          reviewerNotes: 'Kinerja operasional prima sepanjang bulan',
        }),
      });
      assert(createReviewRes.status === 201, `Gagal mencatat review performa: HTTP ${createReviewRes.status}`);

      // Re-fetch dan assert
      const getReviewRes = await fetch(`${baseUrl}/api/laundry/staff-performance/reviews?outletId=${outletId}&userId=${ownerId}`, { headers: authHeaders });
      const reviewList = (await getReviewRes.json() as any).data;
      assert(reviewList.length > 0, 'Review performa harus ada di list');
      assert(Number(reviewList[0].disciplineScore) === 95, 'disciplineScore review tidak persisten');
      assert(reviewList[0].grade === 'A', 'grade review tidak persisten');

      results.push({ name: 'Evaluasi Kinerja Karyawan (0 - 100 Boundary & Persistence)', status: 'PASS', durationMs: Date.now() - t2 });
    } catch (err: any) {
      results.push({ name: 'Evaluasi Kinerja Karyawan (0 - 100 Boundary & Persistence)', status: 'FAIL', durationMs: Date.now() - t2, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 4. Konfigurasi Delivery & Zona Ongkir
    // -------------------------------------------------------------------------
    const t3 = Date.now();
    try {
      console.log('▶️ [4/7] Menguji Konfigurasi Delivery & Zona Ongkir...');
      const updateDelivRes = await fetch(`${baseUrl}/api/laundry/delivery-config`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          config: {
            enabled: true,
            freeDeliveryMinAmount: 80000,
            freeDeliveryMinWeightKg: 10,
            roundTripMultiplier: 1.8,
            zones: [
              { id: 'zone_1', name: 'Ring 1 (< 3km)', fee: 10000, maxKm: 3 },
              { id: 'zone_2', name: 'Ring 2 (3-7km)', fee: 18000, maxKm: 7 },
            ],
          },
        }),
      });
      assert(updateDelivRes.status === 200, `Gagal update delivery config: HTTP ${updateDelivRes.status}`);

      const getDelivRes = await fetch(`${baseUrl}/api/laundry/delivery-config?outletId=${outletId}`, { headers: authHeaders });
      const delivData = (await getDelivRes.json() as any).data;
      assert(delivData.freeDeliveryMinAmount === 80000, 'freeDeliveryMinAmount tidak persisten');
      assert(delivData.zones.length === 2, 'Jumlah zona delivery harus 2');

      results.push({ name: 'Konfigurasi Delivery & Zona Ongkir Persistence', status: 'PASS', durationMs: Date.now() - t3 });
    } catch (err: any) {
      results.push({ name: 'Konfigurasi Delivery & Zona Ongkir Persistence', status: 'FAIL', durationMs: Date.now() - t3, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 5. Dompet Deposit Pelanggan (Top-Up Saldo & Kuota)
    // -------------------------------------------------------------------------
    const t4 = Date.now();
    try {
      console.log('▶️ [5/7] Menguji Dompet Deposit Pelanggan & Top-Up...');
      // Top-up Saldo
      const topupBalRes = await fetch(`${baseUrl}/api/laundry/customers/${createdCustomerId}/wallet/topup`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          type: 'BALANCE',
          amount: 150000,
          bonusAmount: 15000,
          pricePaid: 150000,
          paymentMethod: 'CASH',
          validityDays: 90,
          outletId,
        }),
      });
      assert(topupBalRes.status === 200, `Gagal top-up saldo: HTTP ${topupBalRes.status}`);

      // Top-up Kuota
      const topupQuotaRes = await fetch(`${baseUrl}/api/laundry/customers/${createdCustomerId}/wallet/topup`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          type: 'QUOTA_KG',
          kg: 25,
          quotaBonusKg: 2.5,
          pricePaid: 180000,
          paymentMethod: 'CASH',
          validityDays: 60,
          outletId,
        }),
      });
      assert(topupQuotaRes.status === 200, `Gagal top-up kuota: HTTP ${topupQuotaRes.status}`);

      // Re-fetch wallet
      const getWalletRes = await fetch(`${baseUrl}/api/laundry/customers/${createdCustomerId}/wallet`, { headers: authHeaders });
      const walletData = (await getWalletRes.json() as any).data;
      assert(Number(walletData.balanceAmount) === 165000, 'Saldo deposit harus 165.000');
      assert(Number(walletData.quotaKg) === 27.5, 'Kuota deposit harus 27.5 Kg');

      results.push({ name: 'Dompet Deposit & Kuota Top-up Persistence', status: 'PASS', durationMs: Date.now() - t4 });
    } catch (err: any) {
      results.push({ name: 'Dompet Deposit & Kuota Top-up Persistence', status: 'FAIL', durationMs: Date.now() - t4, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 6. Procurement 6-Tahap, Workforce & Global Audit Trail (Core Phase 4 Backend)
    // -------------------------------------------------------------------------
    const t5 = Date.now();
    try {
      console.log('▶️ [6/7] Menguji Procurement PR, Workforce Overtime & Global Audit Trail...');
      // Purchase Request
      const createPrRes = await fetch(`${baseUrl}/api/enterprise/core4/procurement/requests`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          notes: 'Pengadaan Deterjen Laundry Ramah Lingkungan 100L',
          items: [
            {
              inventoryItemId: testInventoryItemId,
              quantityRequested: 10,
              estimatedUnitCost: 45000,
            },
          ],
        }),
      });
      assert(createPrRes.status === 201, `Gagal membuat PR: HTTP ${createPrRes.status}`);
      const prId = (await createPrRes.json() as any).data.id;

      // Approve PR
      const approvePrRes = await fetch(`${baseUrl}/api/enterprise/core4/procurement/requests/${prId}/review`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      assert(approvePrRes.status === 200, `Gagal approve PR: HTTP ${approvePrRes.status}`);

      // Pengajuan Lembur
      const overtimeRes = await fetch(`${baseUrl}/api/enterprise/core4/workforce/overtimes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          userId: ownerId,
          workDate: '2026-11-26',
          durationHours: 2.5,
          hourlyRate: 35000,
          reason: 'Lembur penyelesaian antrean cucian prioritas hotel',
        }),
      });
      assert(overtimeRes.status === 201, `Gagal membuat pengajuan lembur: HTTP ${overtimeRes.status}`);

      // Cek Global Audit Log
      const auditRes = await fetch(`${baseUrl}/api/enterprise/core4/audit-logs?module=PROCUREMENT`, { headers: authHeaders });
      assert(auditRes.status === 200, `Gagal memuat audit log: HTTP ${auditRes.status}`);
      const auditLogs = (await auditRes.json() as any).data;
      assert(auditLogs.length > 0, 'Audit log aktivitas PROCUREMENT harus tercatat');

      results.push({ name: 'Procurement PR Approval, Workforce Overtime & Global Audit Trail', status: 'PASS', durationMs: Date.now() - t5 });
    } catch (err: any) {
      results.push({ name: 'Procurement PR Approval, Workforce Overtime & Global Audit Trail', status: 'FAIL', durationMs: Date.now() - t5, error: err.message });
      throw err;
    }

    // -------------------------------------------------------------------------
    // 7. Negative & Boundary Validations
    // -------------------------------------------------------------------------
    const t6 = Date.now();
    try {
      console.log('▶️ [7/7] Validasi Negatif: GraceMinutes < 0, Skor > 100, dan Kompensasi Negatif...');
      // graceMinutes < 0
      const resNegGrace = await fetch(`${baseUrl}/api/attendance/shift-templates`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ outletId, name: 'X', startTime: '08:00', endTime: '16:00', graceMinutes: -10 }),
      });
      assert(resNegGrace.status === 400, 'graceMinutes negatif harus ditolak HTTP 400');

      // Review score > 100
      const resNegScore = await fetch(`${baseUrl}/api/laundry/staff-performance/reviews`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ outletId, userId: ownerId, periodStart: '2026-11-01', periodEnd: '2026-11-30', disciplineScore: 120 }),
      });
      assert(resNegScore.status === 400, 'Skor review > 100 harus ditolak HTTP 400');

      // Kompensasi negatif
      const resNegComp = await fetch(`${baseUrl}/api/laundry/incidents`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ outletId, orderId: testOrderId, incidentType: 'DAMAGED', itemDescription: 'X', notes: 'X', estimatedCompensation: -5000 }),
      });
      assert(resNegComp.status === 400, 'Kompensasi insiden negatif harus ditolak HTTP 400');

      results.push({ name: 'Negative Assertion: Reject GraceMinutes < 0, Review Score > 100 & Negative Comp (400)', status: 'PASS', durationMs: Date.now() - t6 });
    } catch (err: any) {
      results.push({ name: 'Negative Assertion: Reject GraceMinutes < 0, Review Score > 100 & Negative Comp (400)', status: 'FAIL', durationMs: Date.now() - t6, error: err.message });
      throw err;
    }

  } finally {
    if (serverInstance) {
      await serverInstance.close();
    }
    if (tenantData?.tenantId) {
      await cleanupQATenant(tenantData.tenantId);
    }
  }

  return printSuiteSummary('qa:enterprise', results);
}

// Eksekusi langsung jika dipanggil via CLI
if (require.main === module) {
  runEnterpriseSuite()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('Fatal Suite Error:', err);
      process.exit(1);
    });
}
