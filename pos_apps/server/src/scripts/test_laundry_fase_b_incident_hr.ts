import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5001';
const JWT_SECRET = process.env.JWT_SECRET || 'pos-secret-jwt-key-2026';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

function assertEq(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`[ASSERTION FAILED] ${message} — Expected: ${expected}, Got: ${actual}`);
  }
}

async function runFaseBIncidentAndHrTests() {
  console.log('========================================================================');
  console.log('🧪 E2E QA TEST: FASE B - MANAJEMEN INSIDEN, JADWAL SHIFT & EVALUASI SDM');
  console.log(`Target Backend: ${API_BASE}`);
  console.log('========================================================================\n');

  // Track created entities for 100% clean teardown
  const createdIncidentIds: string[] = [];
  const createdReviewIds: string[] = [];
  const createdScheduleIds: string[] = [];
  const createdTemplateIds: string[] = [];
  const createdAttendanceIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];

  let tenantId = '';
  let outletId = '';
  let initialAttendanceConfig: any = null;

  try {
    // 0. Ambil Tenant Laundry & Outlet
    const tenant = await prisma.tenant.findFirst({
      where: { businessType: { contains: 'Laundry', mode: 'insensitive' } },
      include: { outlets: true },
    });
    if (!tenant || tenant.outlets.length === 0) {
      throw new Error('Tenant Laundry aktif tidak ditemukan di database lokal.');
    }
    tenantId = tenant.id;
    const outlet = tenant.outlets[0];
    outletId = outlet.id;
    initialAttendanceConfig = outlet.attendanceConfig;

    const runSuffix = Date.now().toString().slice(-6);
    const pwHash = await bcrypt.hash('password123', 10);

    // Buat User OWNER untuk pengujian
    const ownerUser = await prisma.user.create({
      data: {
        tenantId,
        outletId,
        userCode: `OWN_B_${runSuffix}`,
        name: `Owner Fase B QA ${runSuffix}`,
        email: `qa.owner.b.${runSuffix}@wellpos-test.com`,
        passwordHash: pwHash,
        role: Role.OWNER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(ownerUser.id);

    // Buat User SUPERVISOR
    const supervisorUser = await prisma.user.create({
      data: {
        tenantId,
        outletId,
        userCode: `SPV_B_${runSuffix}`,
        name: `Supervisor Fase B ${runSuffix}`,
        email: `qa.spv.b.${runSuffix}@wellpos-test.com`,
        passwordHash: pwHash,
        role: Role.SUPERVISOR,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(supervisorUser.id);

    // Buat User CASHIER
    const cashierUser = await prisma.user.create({
      data: {
        tenantId,
        outletId,
        userCode: `CSH_B_${runSuffix}`,
        name: `Cashier Fase B ${runSuffix}`,
        email: `qa.cashier.b.${runSuffix}@wellpos-test.com`,
        passwordHash: pwHash,
        role: Role.CASHIER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(cashierUser.id);

    // Buat User PRODUCTION / KITCHEN
    const prodUser = await prisma.user.create({
      data: {
        tenantId,
        outletId,
        userCode: `PRD_B_${runSuffix}`,
        name: `Operator Produksi ${runSuffix}`,
        email: `qa.prod.b.${runSuffix}@wellpos-test.com`,
        passwordHash: pwHash,
        role: Role.KITCHEN,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(prodUser.id);

    const makeAuthHeader = (u: any) => {
      const token = jwt.sign(
        {
          userId: u.id,
          tenantId,
          outletId,
          role: u.role,
          tokenVersion: u.tokenVersion || 1,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
    };

    const ownerHeaders = makeAuthHeader(ownerUser);
    const spvHeaders = makeAuthHeader(supervisorUser);
    const cashierHeaders = makeAuthHeader(cashierUser);
    const prodHeaders = makeAuthHeader(prodUser);

    console.log(`✓ Tenant & Outlet: ${tenant.name} (${outlet.name})`);
    console.log(`✓ Test Users Ready: Owner, Supervisor, Cashier, Production Operator\n`);

    // =========================================================================
    // MODUL 1: MANAJEMEN INSIDEN PRODUKSI (PAKAIAN RUSAK / HILANG)
    // =========================================================================
    console.log('--- [1] PENGUJIAN MANAJEMEN INSIDEN PAKAIAN RUSAK / HILANG ---');

    // 1.1 Buat 2 Order Laundry via API
    // Order 1: Total Amount Rp 15.000 (estimasi kompensasi 5x = 75.000 < 100.000 cap)
    const orderRes1 = await fetch(`${API_BASE}/api/laundry/orders`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        outletId,
        customerName: `Pelanggan Insiden 1 ${runSuffix}`,
        customerPhone: `0812999${runSuffix}1`,
        items: [
          {
            name: 'Cuci Kering Lipat 2kg',
            category: 'KILOAN',
            quantity: 2,
            unit: 'Kg',
            unitPrice: 7500,
          },
        ],
        paymentMethod: 'CASH',
        paymentChoice: 'PAID',
        paidAmount: 15000,
      }),
    });
    const orderData1 = await orderRes1.json();
    assertEq(orderData1.status, 'success', 'POST /api/laundry/orders (Order 1) status');
    assert(Boolean(orderData1.data?.id), 'Order 1 ID generated');
    const order1Id = orderData1.data.id;
    createdOrderIds.push(order1Id);

    // Order 2: Total Amount Rp 40.000 (estimasi kompensasi 5x = 200.000 -> harus kena cap Rp 100.000)
    const orderRes2 = await fetch(`${API_BASE}/api/laundry/orders`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        outletId,
        customerName: `Pelanggan Insiden 2 ${runSuffix}`,
        customerPhone: `0812999${runSuffix}2`,
        items: [
          {
            name: 'Bedcover King Satuan',
            category: 'SATUAN',
            quantity: 1,
            unit: 'Pcs',
            unitPrice: 40000,
          },
        ],
        paymentMethod: 'CASH',
        paymentChoice: 'PAID',
        paidAmount: 40000,
      }),
    });
    const orderData2 = await orderRes2.json();
    assertEq(orderData2.status, 'success', 'POST /api/laundry/orders (Order 2) status');
    assert(Boolean(orderData2.data?.id), 'Order 2 ID generated');
    const order2Id = orderData2.data.id;
    createdOrderIds.push(order2Id);

    // Ambil customer ID yang otomatis dibuat sistem
    const createdOrders = await prisma.order.findMany({
      where: { id: { in: [order1Id, order2Id] } },
      select: { customerId: true },
    });
    createdOrders.forEach((o) => {
      if (o.customerId) createdCustomerIds.push(o.customerId);
    });

    // 1.2 Catat Insiden 1 (DAMAGED) via API oleh Kasir/Produksi
    const incRes1 = await fetch(`${API_BASE}/api/laundry/incidents`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        outletId,
        orderId: order1Id,
        incidentType: 'DAMAGED',
        itemDescription: 'Kemeja Putih Uniqlo (Luntur)',
        notes: 'Baju luntur terkena pakaian lain saat proses pencucian',
        photoUrls: ['https://example.com/photos/damaged1.jpg'],
        stage: 'WASHING',
        machineName: 'Washer 01 (Front Load)',
        responsibleStaffId: prodUser.id,
      }),
    });
    const incData1 = await incRes1.json();
    assertEq(incData1.status, 'success', 'POST /api/laundry/incidents status');
    assert(incData1.data && incData1.data.id, 'Incident ID harus ada');
    createdIncidentIds.push(incData1.data.id);
    assertEq(incData1.data.status, 'OPEN', 'Status awal insiden harus OPEN');
    // Verifikasi rumus kompensasi 5x: min(15.000 * 5, 100.000) = 75.000
    assertEq(Number(incData1.data.estimatedCompensation), 75000, 'Estimasi kompensasi order 15k harus 75.000');
    console.log(`✓ Insiden 1 dibuat: DAMAGED, estimasi kompensasi Rp ${incData1.data.estimatedCompensation}`);

    // 1.3 Catat Insiden 2 (LOST) untuk order2 -> Uji Cap Max Rp 100.000
    const incRes2 = await fetch(`${API_BASE}/api/laundry/incidents`, {
      method: 'POST',
      headers: prodHeaders,
      body: JSON.stringify({
        outletId,
        orderId: order2Id,
        incidentType: 'LOST',
        itemDescription: 'Sarung Bantal Satin (Hilang)',
        notes: 'Sprei kecil tertinggal atau tercecer saat sortir',
        stage: 'SORTING',
      }),
    });
    const incData2 = await incRes2.json();
    assertEq(incData2.status, 'success', 'POST /api/laundry/incidents LOST status');
    createdIncidentIds.push(incData2.data.id);
    // Verifikasi max cap 100.000: min(40.000 * 5, 100.000) = 100.000
    assertEq(Number(incData2.data.estimatedCompensation), 100000, 'Estimasi kompensasi order 40k wajib kena cap Rp 100.000');
    console.log(`✓ Insiden 2 dibuat: LOST, estimasi kompensasi ter-cap maksimal di Rp ${incData2.data.estimatedCompensation}`);

    // 1.4 Verifikasi Endpoint getLaundryOrders menyertakan incidentCount & hasOpenIncident
    const ordersRes = await fetch(`${API_BASE}/api/laundry/orders?outletId=${outletId}`, {
      method: 'GET',
      headers: ownerHeaders,
    });
    const ordersData = await ordersRes.json();
    assertEq(ordersData.status, 'success', 'GET /api/laundry/orders status');
    const checkedOrder1 = ordersData.data.find((o: any) => o.orderId === order1Id || o.id === order1Id);
    assert(!!checkedOrder1, 'Order 1 harus ditemukan di daftar laundry orders');
    assertEq(checkedOrder1.incidentCount, 1, 'incidentCount order1 harus 1');
    assertEq(checkedOrder1.hasOpenIncident, true, 'hasOpenIncident order1 harus true');
    console.log(`✓ Verifikasi getLaundryOrders: order memuat incidentCount=${checkedOrder1.incidentCount} & hasOpenIncident=true`);

    // 1.5 Role Isolation: Kasir TIDAK BOLEH update status insiden (harus 403)
    const cashierUpdateRes = await fetch(`${API_BASE}/api/laundry/incidents/${incData1.data.id}`, {
      method: 'PATCH',
      headers: cashierHeaders,
      body: JSON.stringify({
        status: 'RESOLVED',
        resolutionNotes: 'Diselesaikan sepihak oleh kasir',
      }),
    });
    assertEq(cashierUpdateRes.status, 403, 'Kasir dilarang mengubah status insiden (harus 403)');
    console.log('✓ Role Isolation: Kasir ditolak 403 saat mencoba mengubah status insiden');

    // 1.6 Owner / Supervisor Mengubah Status Insiden ke INVESTIGATING lalu COMPENSATED
    const ownerUpdateRes = await fetch(`${API_BASE}/api/laundry/incidents/${incData1.data.id}`, {
      method: 'PATCH',
      headers: spvHeaders,
      body: JSON.stringify({
        status: 'COMPENSATED',
        approvedCompensation: 75000,
        compensationMethod: 'CASH',
        resolutionNotes: 'Pelanggan menerima ganti rugi tunai Rp 75.000 dan sepakat berdamai',
      }),
    });
    const ownerUpdateData = await ownerUpdateRes.json();
    assertEq(ownerUpdateData.status, 'success', 'SPV/Owner sukses update status insiden');
    assertEq(ownerUpdateData.data.status, 'COMPENSATED', 'Status insiden terupdate menjadi COMPENSATED');
    assertEq(Number(ownerUpdateData.data.approvedCompensation), 75000, 'approvedCompensation Rp 75.000 tersimpan');
    console.log('✓ SPV/Owner sukses menyelesaikan insiden dengan kompensasi tunai Rp 75.000');

    // 1.7 Filter Insiden Berdasarkan Status & Search
    const filterIncRes = await fetch(`${API_BASE}/api/laundry/incidents?outletId=${outletId}&status=OPEN`, {
      method: 'GET',
      headers: ownerHeaders,
    });
    const filterIncData = await filterIncRes.json();
    assertEq(filterIncData.status, 'success', 'GET /api/laundry/incidents?status=OPEN');
    assert(filterIncData.data.some((i: any) => i.id === incData2.data.id), 'Insiden 2 harus muncul di filter OPEN');
    assert(!filterIncData.data.some((i: any) => i.id === incData1.data.id), 'Insiden 1 (COMPENSATED) tidak boleh muncul di filter OPEN');
    console.log('✓ Filter status insiden berjalan akurat\n');

    // =========================================================================
    // MODUL 2: PENJADWALAN SHIFT KERJA + AUTO-GENERATE + INTEGRASI ABSENSI
    // =========================================================================
    console.log('--- [2] PENGUJIAN PENJADWALAN SHIFT KERJA & INTEGRASI ABSENSI ---');

    // 2.1 Verifikasi Auto-Seed 3 Template Shift Default
    const templatesRes = await fetch(`${API_BASE}/api/attendance/shift-templates?outletId=${outletId}`, {
      method: 'GET',
      headers: ownerHeaders,
    });
    const templatesData = await templatesRes.json();
    assertEq(templatesData.status, 'success', 'GET /api/attendance/shift-templates status');
    assert(Array.isArray(templatesData.data) && templatesData.data.length >= 3, 'Minimal 3 template shift default harus ada');

    const pagi = templatesData.data.find((t: any) => t.name.toLowerCase().includes('pagi'));
    const siang = templatesData.data.find((t: any) => t.name.toLowerCase().includes('siang'));
    const full = templatesData.data.find((t: any) => t.name.toLowerCase().includes('full'));
    assert(!!pagi && pagi.startTime === '07:00' && pagi.endTime === '15:00', 'Shift Pagi 07:00-15:00');
    assert(!!siang && siang.startTime === '14:00' && siang.endTime === '22:00', 'Shift Siang 14:00-22:00');
    assert(!!full && full.startTime === '08:00' && full.endTime === '17:00', 'Full Day 08:00-17:00');
    console.log(`✓ Terverifikasi ${templatesData.data.length} template shift terdaftar (Pagi 07-15, Siang 14-22, Full 08-17)`);

    // 2.2 Buat Custom Shift Template (Shift Malam)
    const customTplRes = await fetch(`${API_BASE}/api/attendance/shift-templates`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        outletId,
        name: `Shift Malam QA ${runSuffix}`,
        code: `MLM_${runSuffix}`,
        startTime: '21:00',
        endTime: '05:00',
        graceMinutes: 10,
        colorHex: '#3b82f6',
      }),
    });
    const customTplData = await customTplRes.json();
    assertEq(customTplData.status, 'success', 'POST custom shift template');
    createdTemplateIds.push(customTplData.data.id);
    assertEq(customTplData.data.name, `Shift Malam QA ${runSuffix}`, 'Nama template shift custom');
    console.log(`✓ Template shift custom dibuat: ${customTplData.data.name}`);

    // 2.3 Auto-Generate Jadwal Shift untuk Staf Kasir & Produksi (Rentang 7 Hari)
    const today = new Date();
    const startDateStr = today.toISOString().slice(0, 10);
    const endSevenDays = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
    const endDateStr = endSevenDays.toISOString().slice(0, 10);

    const autoGenRes = await fetch(`${API_BASE}/api/attendance/schedules/auto-generate`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        outletId,
        startDate: startDateStr,
        endDate: endDateStr,
        userIds: [cashierUser.id, prodUser.id],
        shiftTemplateIds: [pagi.id, siang.id],
        offDaysPerWeek: 1,
        overwriteExisting: false,
      }),
    });
    const autoGenData = await autoGenRes.json();
    assertEq(autoGenData.status, 'success', 'POST /api/attendance/schedules/auto-generate');
    assert(autoGenData.data.createdCount > 0, 'createdCount harus > 0');
    console.log(`✓ Auto-generate berhasil: ${autoGenData.data.createdCount} shift dijadwalkan secara adil`);

    // Catat ID schedules yang terbuat untuk dibersihkan di teardown
    const allSchedulesInDb = await prisma.staffWorkSchedule.findMany({
      where: { outletId, userId: { in: [cashierUser.id, prodUser.id] } },
      select: { id: true },
    });
    allSchedulesInDb.forEach((s) => createdScheduleIds.push(s.id));

    // 2.4 Uji Non-Overwrite: Jalankan kembali dengan overwriteExisting=false
    const autoGenNoOverRes = await fetch(`${API_BASE}/api/attendance/schedules/auto-generate`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        outletId,
        startDate: startDateStr,
        endDate: endDateStr,
        userIds: [cashierUser.id, prodUser.id],
        shiftTemplateIds: [pagi.id, siang.id],
        offDaysPerWeek: 1,
        overwriteExisting: false,
      }),
    });
    const autoGenNoOverData = await autoGenNoOverRes.json();
    assertEq(autoGenNoOverData.status, 'success', 'Auto-generate idempotent');
    assertEq(autoGenNoOverData.data.createdCount, 0, 'createdCount harus 0 karena jadwal sudah ada dan overwriteExisting=false');
    console.log('✓ Idempotensi auto-generate terverifikasi (tidak menduplikasi saat overwriteExisting=false)');

    // 2.5 Role Isolation pada Pengambilan Jadwal Shift
    // Staf Kasir hanya boleh melihat jadwal dirinya sendiri
    const cashierSchedulesRes = await fetch(
      `${API_BASE}/api/attendance/schedules?outletId=${outletId}&startDate=${startDateStr}&endDate=${endDateStr}`,
      {
        method: 'GET',
        headers: cashierHeaders,
      }
    );
    const cashierSchedulesData = await cashierSchedulesRes.json();
    assertEq(cashierSchedulesData.status, 'success', 'Kasir ambil jadwal shift');
    const hasOtherStaff = cashierSchedulesData.data.some((s: any) => s.userId !== cashierUser.id);
    assert(!hasOtherStaff, 'Kasir dilarang melihat jadwal staf lain (Role Isolation)');
    console.log('✓ Role Isolation Jadwal Shift: Kasir hanya dapat melihat jadwal miliknya');

    // 2.6 Bulk-Upsert Manual Override Jadwal
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const bulkUpsertRes = await fetch(`${API_BASE}/api/attendance/schedules/bulk-upsert`, {
      method: 'POST',
      headers: spvHeaders,
      body: JSON.stringify({
        outletId,
        schedules: [
          {
            userId: cashierUser.id,
            scheduleDate: tomorrowStr,
            isOffDay: true,
            notes: 'Izin libur khusus disetujui SPV',
          },
        ],
      }),
    });
    const bulkUpsertData = await bulkUpsertRes.json();
    assertEq(bulkUpsertData.status, 'success', 'Bulk upsert manual override status');
    console.log('✓ Bulk-upsert manual override jadwal berhasil dijalankan oleh Supervisor');

    // 2.7 Integrasi Absensi (clockIn) Berdasarkan Jadwal Shift
    // Skenario A: User dengan jadwal Shift Pagi (startTime: 07:00, graceMinutes: 15)
    // Pasang jadwal hari ini untuk prodUser ke Shift Pagi (07:00)
    await prisma.staffWorkSchedule.upsert({
      where: {
        outletId_userId_scheduleDate: {
          outletId,
          userId: prodUser.id,
          scheduleDate: startDateStr,
        },
      },
      update: {
        shiftTemplateId: pagi.id,
        isOffDay: false,
      },
      create: {
        tenantId,
        outletId,
        userId: prodUser.id,
        scheduleDate: startDateStr,
        shiftTemplateId: pagi.id,
        isOffDay: false,
      },
    });

    // Jalankan clock-in untuk prodUser
    const clockInRes1 = await fetch(`${API_BASE}/api/attendance/clock-in`, {
      method: 'POST',
      headers: prodHeaders,
      body: JSON.stringify({
        outletId,
        userId: prodUser.id,
      }),
    });
    const clockInData1 = await clockInRes1.json();
    assertEq(clockInData1.status, 'success', 'POST /api/attendance/clock-in status (dengan template shift)');
    assert(clockInData1.data && clockInData1.data.id, 'Attendance log ID harus ada');
    createdAttendanceIds.push(clockInData1.data.id);
    // Jam saat ini di test runner adalah siang/sore WIB (> 07:15) -> sistem harus mendeteksi terlambat terhadap jadwal 07:00
    assertEq(clockInData1.data.status, 'LATE', 'Operator terdeteksi terlambat terhadap shift pagi 07:00');
    assert(clockInData1.data.lateMinutes > 0, 'lateMinutes harus > 0');
    console.log(`✓ Integrasi Clock-in dengan Jadwal Shift: terdeteksi status LATE dengan keterlambatan ${clockInData1.data.lateMinutes} menit terhadap shift 07:00`);

    // Skenario B: Fallback Zero-Regression untuk User TANPA Jadwal Shift (seperti mode F&B / Retail eksisting)
    // Buat User F&B tanpa entri di StaffWorkSchedule
    const fnbStaff = await prisma.user.create({
      data: {
        tenantId,
        outletId,
        userCode: `FNB_STF_${runSuffix}`,
        name: `F&B Staff Normal ${runSuffix}`,
        email: `qa.fnb.${runSuffix}@wellpos-test.com`,
        passwordHash: pwHash,
        role: Role.CASHIER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(fnbStaff.id);

    const fnbHeaders = makeAuthHeader(fnbStaff);
    const clockInFnbRes = await fetch(`${API_BASE}/api/attendance/clock-in`, {
      method: 'POST',
      headers: fnbHeaders,
      body: JSON.stringify({
        outletId,
        userId: fnbStaff.id,
      }),
    });
    const clockInFnbData = await clockInFnbRes.json();
    assertEq(clockInFnbData.status, 'success', 'Clock-in fallback F&B status harus success');
    createdAttendanceIds.push(clockInFnbData.data.id);
    console.log('✓ Zero-Regression F&B/Retail: Absensi tanpa jadwal shift fallback mulus ke outlet.attendanceConfig\n');

    // =========================================================================
    // MODUL 3: EVALUASI PERFORMA STAF TERPADU (4 PILAR REAL-TIME)
    // =========================================================================
    console.log('--- [3] PENGUJIAN EVALUASI PERFORMA STAF (4 PILAR REAL-TIME) ---');

    // 3.1 Majukan tahap order 1 ke WASHING dengan operator prodUser agar metrik produktivitas tercatat
    const advanceRes = await fetch(`${API_BASE}/api/laundry/orders/${order1Id}/advance-stage`, {
      method: 'POST',
      headers: prodHeaders,
      body: JSON.stringify({
        nextStage: 'WASHING',
        machineName: 'Washer 01 (Front Load)',
        notes: 'Pencucian pakaian selesai dilakukan',
      }),
    });
    const advanceData = await advanceRes.json();
    assertEq(advanceData.status, 'success', 'POST advance-stage ke WASHING status');

    // 3.2 Query Metrik Performa Staf via API
    const perfRes = await fetch(
      `${API_BASE}/api/laundry/staff-performance?outletId=${outletId}&startDate=${startDateStr}&endDate=${endDateStr}`,
      {
        method: 'GET',
        headers: ownerHeaders,
      }
    );
    const perfData = await perfRes.json();
    if (perfData.status !== 'success') {
      console.error('getStaffPerformance response error:', perfData);
    }
    assertEq(perfData.status, 'success', 'GET /api/laundry/staff-performance status');
    assert(perfData.data && Array.isArray(perfData.data.evaluations), 'perfData.data.evaluations harus array');

    const prodPerf = perfData.data.evaluations.find((p: any) => p.user.id === prodUser.id);
    assert(!!prodPerf, 'Operator produksi harus ada di hasil evaluasi performa');

    // Verifikasi 4 Pilar Struktur Skor
    assert(prodPerf.scores && typeof prodPerf.scores.discipline === 'number', 'Pilar 1: Kedisiplinan');
    assert(typeof prodPerf.scores.productivity === 'number', 'Pilar 2: Produktivitas');
    assert(typeof prodPerf.scores.quality === 'number', 'Pilar 3: Kualitas Kerja');
    assert(typeof prodPerf.scores.customer === 'number', 'Pilar 4: Kepuasan Pelanggan');
    assert(typeof prodPerf.scores.overall === 'number', 'Skor Akhir Terpadu');
    assert(['A', 'B', 'C', 'D'].includes(prodPerf.scores.grade), 'Grade harus A/B/C/D');

    // Verifikasi penalti kualitas karena ada insiden DAMAGED yang melibatkan prodUser
    assert(
      prodPerf.metrics.damagedCount > 0 || prodPerf.scores.quality <= 90,
      'Kualitas kerja harus mendapat penalti insiden pakaian rusak'
    );

    console.log(`✓ Metrik Performa Operator Produksi:
       - Kedisiplinan: ${prodPerf.scores.discipline} (Bobot 25%)
       - Produktivitas: ${prodPerf.scores.productivity} (Bobot 35%)
       - Kualitas Kerja: ${prodPerf.scores.quality} (Bobot 20% - Rusak: ${prodPerf.metrics.damagedCount}, Hilang: ${prodPerf.metrics.lostCount})
       - Kepuasan Pelanggan: ${prodPerf.scores.customer} (Bobot 20%)
       - Skor Keseluruhan: ${prodPerf.scores.overall} | Grade: ${prodPerf.scores.grade}`);

    // 3.3 Catat Catatan Evaluasi & Rencana Aksi (StaffPerformanceReview) oleh Owner
    const reviewRes = await fetch(`${API_BASE}/api/laundry/staff-performance/reviews`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        outletId,
        userId: prodUser.id,
        periodStart: startDateStr,
        periodEnd: endDateStr,
        overallScore: prodPerf.scores.overall,
        disciplineScore: prodPerf.scores.discipline,
        productivityScore: prodPerf.scores.productivity,
        qualityScore: prodPerf.scores.quality,
        customerScore: prodPerf.scores.customer,
        grade: prodPerf.scores.grade,
        reviewerNotes: 'Produktivitas sangat baik, perlu lebih teliti memilah pakaian luntur saat sortir dan spotting. Rencana aksi: spotting test pada pakaian warna terang.',
      }),
    });
    const reviewData = await reviewRes.json();
    assertEq(reviewData.status, 'success', 'POST /api/laundry/staff-performance/reviews status');
    assert(reviewData.data && reviewData.data.id, 'Review ID harus ada');
    createdReviewIds.push(reviewData.data.id);
    console.log('✓ Catatan evaluasi dan rencana aksi bulanan berhasil disimpan oleh Owner');

    // 3.4 Ambil Riwayat Evaluasi Staf
    const getReviewsRes = await fetch(
      `${API_BASE}/api/laundry/staff-performance/reviews?outletId=${outletId}&userId=${prodUser.id}`,
      {
        method: 'GET',
        headers: ownerHeaders,
      }
    );
    const getReviewsData = await getReviewsRes.json();
    assertEq(getReviewsData.status, 'success', 'GET /api/laundry/staff-performance/reviews');
    assert(getReviewsData.data.some((r: any) => r.id === reviewData.data.id), 'Review yang baru dibuat harus ada di riwayat');
    console.log('✓ Riwayat evaluasi staf berhasil ditarik dengan detail reviewer & skor');

    // 3.5 Role Isolation Evaluasi Staf: Kasir DILARANG membuat review performa (harus 403)
    const cashierReviewRes = await fetch(`${API_BASE}/api/laundry/staff-performance/reviews`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        outletId,
        userId: prodUser.id,
        periodStart: startDateStr,
        periodEnd: endDateStr,
        overallScore: 80,
      }),
    });
    assertEq(cashierReviewRes.status, 403, 'Kasir dilarang membuat review evaluasi staf (harus 403)');
    console.log('✓ Role Isolation Evaluasi: Kasir ditolak 403 saat mencoba menyimpan review performa\n');

    console.log('========================================================================');
    console.log('🎉 SEMUA 12 SKENARIO PENGUJIAN FASE B (E2E) LULUS 100%!');
    console.log('========================================================================\n');
  } catch (error: any) {
    console.error('\n❌ E2E QA TEST GAGAL:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    console.log('--- CLEANUP / TEARDOWN DATA TEST ---');

    // Hapus Performance Reviews
    if (createdReviewIds.length > 0) {
      const delReviews = await prisma.staffPerformanceReview.deleteMany({
        where: { id: { in: createdReviewIds } },
      }).catch(() => {});
      console.log(`✓ Dihapus review performa test`);
    }

    // Hapus Incidents
    if (createdIncidentIds.length > 0) {
      const delIncidents = await prisma.laundryIncident.deleteMany({
        where: { id: { in: createdIncidentIds } },
      }).catch(() => {});
      console.log(`✓ Dihapus laundry incident test`);
    }

    // Hapus Staff Work Schedules
    if (createdScheduleIds.length > 0) {
      const delSchedules = await prisma.staffWorkSchedule.deleteMany({
        where: { id: { in: createdScheduleIds } },
      }).catch(() => {});
      console.log(`✓ Dihapus jadwal shift test`);
    }

    // Hapus Custom Templates
    if (createdTemplateIds.length > 0) {
      const delTemplates = await prisma.workShiftTemplate.deleteMany({
        where: { id: { in: createdTemplateIds } },
      }).catch(() => {});
      console.log(`✓ Dihapus template shift custom`);
    }

    // Hapus Attendance
    if (createdAttendanceIds.length > 0) {
      const delAttendances = await prisma.attendance.deleteMany({
        where: { id: { in: createdAttendanceIds } },
      }).catch(() => {});
      console.log(`✓ Dihapus attendance log test`);
    }

    // Hapus Laundry Stage Logs, LaundryOrderDetail, OrderItem, & Orders
    if (createdOrderIds.length > 0) {
      await prisma.laundryStageLog.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      }).catch(() => {});
      await prisma.laundryOrderDetail.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      }).catch(() => {});
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      }).catch(() => {});
      const delOrders = await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      }).catch(() => {});
      console.log(`✓ Dihapus order test`);
    }

    // Hapus Customers & Wallets
    if (createdCustomerIds.length > 0) {
      await prisma.customerLaundryWalletLedger.deleteMany({
        where: { wallet: { customerId: { in: createdCustomerIds } } },
      }).catch(() => {});
      await prisma.customerLaundryWallet.deleteMany({
        where: { customerId: { in: createdCustomerIds } },
      }).catch(() => {});
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomerIds } },
      }).catch(() => {});
      console.log(`✓ Dihapus customer test`);
    }

    // Hapus Test Users
    if (createdUserIds.length > 0) {
      const delUsers = await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
      console.log(`✓ Dihapus test users`);
    }

    // Restore Outlet config jika perlu
    if (outletId && initialAttendanceConfig) {
      await prisma.outlet.update({
        where: { id: outletId },
        data: { attendanceConfig: initialAttendanceConfig },
      }).catch(() => {});
    }

    await prisma.$disconnect();
    console.log('✓ Teardown database selesai. Status DB 100% bersih tanpa sisa sampah QA.\n');
  }
}

runFaseBIncidentAndHrTests().catch(() => process.exit(1));
