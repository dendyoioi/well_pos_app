import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient, Role, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
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

async function runLaundryRetentionE2ETest() {
  console.log('========================================================================');
  console.log('🧪 E2E QA TEST: 4 FITUR RETENSI & KEPUASAN PELANGGAN LAUNDRY (FASE A)');
  console.log(`Target Backend: ${API_BASE}`);
  console.log('========================================================================\n');

  // Track entities for teardown
  const createdOrderIds: string[] = [];
  const createdFeedbackIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdServiceIds: string[] = [];
  const createdUserIds: string[] = [];

  let outletId = '';
  let initialGoogleReviewUrl: string | null = null;

  try {
    // 0. Ambil Tenant Laundry & Outlet
    const tenant = await prisma.tenant.findFirst({
      where: { businessType: { contains: 'Laundry', mode: 'insensitive' } },
      include: { outlets: true },
    });
    if (!tenant || tenant.outlets.length === 0) {
      throw new Error('Tenant Laundry aktif tidak ditemukan di database lokal.');
    }
    const tenantId = tenant.id;
    const outlet = tenant.outlets[0];
    outletId = outlet.id;
    initialGoogleReviewUrl = outlet.googleReviewUrl;

    // Set googleReviewUrl pada outlet untuk pengujian
    const testGoogleReviewUrl = 'https://g.page/r/TestLaundryReview123';
    await prisma.outlet.update({
      where: { id: outletId },
      data: { googleReviewUrl: testGoogleReviewUrl },
    });

    // Ambil atau buat User OWNER untuk auth header
    let ownerUser = await prisma.user.findFirst({
      where: { tenantId, role: { in: [Role.OWNER, Role.ADMIN] }, isActive: true },
    });
    if (!ownerUser) {
      const pwHash = await bcrypt.hash('password123', 10);
      ownerUser = await prisma.user.create({
        data: {
          tenantId,
          outletId,
          userCode: 'OWN_RETENTION_QA',
          name: 'Owner Retention QA',
          email: 'qa.owner.retention@wellpos-test.com',
          passwordHash: pwHash,
          role: Role.OWNER,
          isActive: true,
          tokenVersion: 1,
        },
      });
      createdUserIds.push(ownerUser.id);
    }

    const token = jwt.sign(
      {
        userId: ownerUser.id,
        tenantId,
        outletId,
        role: ownerUser.role,
        tokenVersion: ownerUser.tokenVersion || 1,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    console.log(`✓ Tenant & Outlet OK: ${tenant.name} | Outlet: ${outlet.name}`);
    console.log(`✓ Authenticated as: ${ownerUser.name} (${ownerUser.role})\n`);

    // =========================================================================
    // MODUL 1: MULTI-LAYANAN DALAM 1 TRANSAKSI & SNAPSHOT PERFUME VARIANT
    // =========================================================================
    console.log('--- [1] PENGUJIAN MULTI-LAYANAN DALAM 1 TRANSAKSI ---');

    // Buat 2 layanan test (1 Kiloan + 1 Satuan)
    const srvKiloan = await prisma.laundryService.create({
      data: {
        tenantId,
        name: 'Cuci Kering Lipat Express QA',
        category: 'KILOAN',
        unit: 'Kg',
        price: 12000,
        minOrderQty: 1,
        durationHours: 24,
        expressMultiplier: 1.5,
        isActive: true,
      },
    });
    createdServiceIds.push(srvKiloan.id);

    const srvSatuan = await prisma.laundryService.create({
      data: {
        tenantId,
        name: 'Bedcover King Tebal QA',
        category: 'SATUAN',
        unit: 'Pcs',
        price: 35000,
        minOrderQty: 1,
        durationHours: 48,
        expressMultiplier: 1.0,
        isActive: true,
      },
    });
    createdServiceIds.push(srvSatuan.id);

    // Buat Pelanggan Baru untuk Nota Multi-Layanan
    const testCust1 = await prisma.customer.create({
      data: {
        tenantId,
        name: 'Budi Santoso Multi-Srv',
        phone: `0811${Date.now().toString().slice(-8)}`,
        totalSpent: 0,
        visitCount: 0,
      },
    });
    createdCustomerIds.push(testCust1.id);

    // Buat Nota Laundry Berisi 2 Layanan Campuran
    const postOrderRes = await fetch(`${API_BASE}/api/laundry/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId,
        customerId: testCust1.id,
        customerName: testCust1.name,
        customerPhone: testCust1.phone,
        items: [
          {
            serviceId: srvKiloan.id,
            name: srvKiloan.name,
            quantity: 3,
            unit: 'Kg',
            unitPrice: 12000,
            perfumeVariant: 'Lavender Supreme',
          },
          {
            serviceId: srvSatuan.id,
            name: srvSatuan.name,
            quantity: 2,
            unit: 'Pcs',
            unitPrice: 35000,
            perfumeVariant: 'Ocean Fresh',
          },
        ],
        totalPieces: 15,
        perfumeVariant: 'Lavender Supreme',
        depositAmount: 106000,
        paymentMethod: 'CASH',
      }),
    });

    const postOrderJson = await postOrderRes.json();
    assert(postOrderRes.status === 201, `Gagal membuat nota multi-layanan: ${postOrderJson.message}`);
    const order1 = postOrderJson.data;
    createdOrderIds.push(order1.id);

    console.log(`✓ Nota Multi-Layanan Berhasil Dibuat: ${order1.invoiceNumber}`);

    // Verifikasi snapshot di DB level order_items
    const orderItemsInDb = await prisma.orderItem.findMany({
      where: { orderId: order1.id },
      orderBy: { productName: 'asc' },
    });
    assertEq(orderItemsInDb.length, 2, 'Jumlah order_items harus 2');

    const kiloanItem = orderItemsInDb.find((it) => it.productName === srvKiloan.name);
    const satuanItem = orderItemsInDb.find((it) => it.productName === srvSatuan.name);

    assert(!!kiloanItem, 'Item kiloan harus ada di DB');
    assertEq(kiloanItem!.perfumeVariant, 'Lavender Supreme', 'perfume_variant item 1 harus akurat');
    assertEq(kiloanItem!.pricingBasis, 'KILOAN', 'pricing_basis item 1 harus KILOAN');

    assert(!!satuanItem, 'Item satuan harus ada di DB');
    assertEq(satuanItem!.perfumeVariant, 'Ocean Fresh', 'perfume_variant item 2 harus akurat');
    assertEq(satuanItem!.pricingBasis, 'SATUAN', 'pricing_basis item 2 harus SATUAN');

    console.log('✓ Snapshot perfumeVariant & pricingBasis tersimpan presisi di database');

    // Verifikasi pemanggilan GET /api/laundry/orders
    const getOrdersRes = await fetch(`${API_BASE}/api/laundry/orders?outletId=${outletId}&search=${encodeURIComponent(order1.invoiceNumber)}`, {
      headers: authHeaders,
    });
    const getOrdersJson = await getOrdersRes.json();
    assert(getOrdersRes.status === 200, `Gagal query getLaundryOrders: ${getOrdersJson.message}`);
    const foundOrder = getOrdersJson.data?.[0];
    assert(!!foundOrder, 'Nota harus ditemukan di getLaundryOrders');
    assertEq(foundOrder.itemsCount, 2, 'itemsCount harus 2');
    assert(
      foundOrder.serviceSummary.includes('(+1 layanan)'),
      `serviceSummary harus menyertakan penanda multi-layanan (+1 layanan), got: ${foundOrder.serviceSummary}`
    );
    assert(Array.isArray(foundOrder.items) && foundOrder.items.length === 2, 'Array items harus berisi 2 elemen');
    console.log(`✓ getLaundryOrders response: itemsCount=${foundOrder.itemsCount}, summary="${foundOrder.serviceSummary}"\n`);

    // =========================================================================
    // MODUL 2: PUBLIC TRACKING & AUTO-WA DROPOFF QR LINK
    // =========================================================================
    console.log('--- [2] PENGUJIAN PUBLIC TRACKING & LINK QR STRUK ---');

    const trackRes = await fetch(`${API_BASE}/api/laundry/public/track/${encodeURIComponent(order1.invoiceNumber)}`);
    const trackJson = await trackRes.json();
    assert(trackRes.status === 200, `Public tracking harus berhasil: ${trackJson.message}`);
    assertEq(trackJson.status, 'success', 'Status tracking harus success');
    assertEq(trackJson.data.invoiceNumber, order1.invoiceNumber, 'Invoice tracking harus cocok');
    assertEq(trackJson.data.itemsCount, 2, 'Tracking itemsCount harus 2');
    assertEq(trackJson.data.hasFeedback, false, 'hasFeedback awal harus false');
    assertEq(trackJson.data.googleReviewUrl, testGoogleReviewUrl, 'googleReviewUrl outlet harus muncul');
    console.log(`✓ Public tracking berhasil: /track/${order1.invoiceNumber}`);
    console.log(`✓ googleReviewUrl tersedia untuk rating redirection: ${trackJson.data.googleReviewUrl}\n`);

    // =========================================================================
    // MODUL 3: FORM RATING, SMART GOOGLE REVIEW REDIRECT & RESOLVE KOMPLAIN
    // =========================================================================
    console.log('--- [3] PENGUJIAN RATING, SMART GOOGLE REDIRECT & KOMPLAIN ---');

    // Ubah status order1 ke READY_FOR_PICKUP (syarat bisnis: ulasan hanya bisa dikirim jika cucian siap/selesai)
    await prisma.laundryOrderDetail.update({
      where: { orderId: order1.id },
      data: { status: 'READY_FOR_PICKUP' },
    });

    // 3a. Submit 5 Star Feedback (Testimoni Positif)
    const feedback5StarRes = await fetch(
      `${API_BASE}/api/laundry/public/track/${encodeURIComponent(order1.invoiceNumber)}/feedback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 5,
          comment: 'Hasil cucian sangat bersih, wangi Lavender tahan lama, pengerjaan cepat!',
        }),
      }
    );
    const feedback5Json = await feedback5StarRes.json();
    assert(feedback5StarRes.status === 201, `Submit 5-star feedback gagal: ${feedback5Json.message}`);
    const fb1 = feedback5Json.data.feedback;
    createdFeedbackIds.push(fb1.id);
    assertEq(fb1.isComplaint, false, 'Rating 5 bukan komplain (isComplaint: false)');
    assertEq(feedback5Json.data.googleReviewUrl, testGoogleReviewUrl, 'Response 5-star harus return googleReviewUrl');
    console.log('✓ Submit ulasan 5 bintang berhasil & otomatis menghasilkan URL Google Review');

    // 3b. Track Google Review Click
    const clickRes = await fetch(
      `${API_BASE}/api/laundry/public/track/${encodeURIComponent(order1.invoiceNumber)}/feedback/google-click`,
      { method: 'PATCH' }
    );
    assertEq(clickRes.status, 200, 'Track click Google review gagal');
    console.log('✓ Klik redirect Google Review tercatat di audit metric');

    // 3c. Anti-Duplicate Feedback Protection
    const dupFeedbackRes = await fetch(
      `${API_BASE}/api/laundry/public/track/${encodeURIComponent(order1.invoiceNumber)}/feedback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 4 }),
      }
    );
    assertEq(dupFeedbackRes.status, 409, 'Submit feedback kedua pada nota yang sama harus ditolak HTTP 409');
    console.log('✓ Proteksi anti-duplicate feedback terverifikasi (HTTP 409)');

    // 3d. Submit 2 Star Complaint (Internal Komplain) pada Nota Kedua
    const testCust2 = await prisma.customer.create({
      data: {
        tenantId,
        name: 'Rudi Hartono Komplain',
        phone: `0812${Date.now().toString().slice(-8)}`,
        totalSpent: 0,
        visitCount: 0,
      },
    });
    createdCustomerIds.push(testCust2.id);

    const postOrder2Res = await fetch(`${API_BASE}/api/laundry/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId,
        customerId: testCust2.id,
        customerName: testCust2.name,
        customerPhone: testCust2.phone,
        items: [
          {
            serviceId: srvKiloan.id,
            name: srvKiloan.name,
            quantity: 2,
            unit: 'Kg',
            unitPrice: 12000,
            perfumeVariant: 'Ocean Fresh',
          },
        ],
        totalPieces: 5,
        perfumeVariant: 'Ocean Fresh',
        depositAmount: 24000,
        paymentMethod: 'CASH',
      }),
    });
    const postOrder2Json = await postOrder2Res.json();
    const order2 = postOrder2Json.data;
    createdOrderIds.push(order2.id);

    // Ubah status order2 ke COMPLETED (cucian sudah diambil)
    await prisma.laundryOrderDetail.update({
      where: { orderId: order2.id },
      data: { status: 'COMPLETED' },
    });

    const complaintRes = await fetch(
      `${API_BASE}/api/laundry/public/track/${encodeURIComponent(order2.invoiceNumber)}/feedback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 2,
          category: 'CUCIAN_KURANG_BERSIH',
          comment: 'Masih ada noda minyak di kerah kemeja putih saya, tolong dicuci ulang.',
          photoUrl: 'https://wellpos-storage.com/complaints/noda-kerah-01.jpg',
        }),
      }
    );
    const complaintJson = await complaintRes.json();
    assert(complaintRes.status === 201, `Submit komplain gagal: ${complaintJson.message}`);
    const fb2 = complaintJson.data.feedback;
    createdFeedbackIds.push(fb2.id);
    assertEq(fb2.isComplaint, true, 'Rating 2 harus ditandai isComplaint: true');
    console.log(`✓ Komplain bintang 2 tercatat (isComplaint=true, status=${fb2.status}, category=${fb2.category})`);

    // 3e. Audit Komplain oleh Owner & Penyelesaian (Resolve)
    const listFeedbacksRes = await fetch(
      `${API_BASE}/api/laundry/feedbacks?outletId=${outletId}&onlyComplaints=true`,
      { headers: authHeaders }
    );
    const listFeedbacksJson = await listFeedbacksRes.json();
    assert(listFeedbacksRes.status === 200, `Gagal getLaundryFeedbacks: ${listFeedbacksJson.message}`);
    const feedbackList = Array.isArray(listFeedbacksJson.data)
      ? listFeedbacksJson.data
      : listFeedbacksJson.data?.feedbacks || [];
    const foundComplaint = feedbackList.find((f: any) => f.id === fb2.id);
    assert(!!foundComplaint, 'Komplain harus muncul di daftar feedback owner');

    // Selesaikan komplain
    const resolveRes = await fetch(`${API_BASE}/api/laundry/feedbacks/${fb2.id}/resolve`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'RESOLVED',
        resolutionNotes: 'Customer sudah dihubungi via WhatsApp. Pakaian telah dicuci ulang gratis dan dikirim kembali hari ini.',
      }),
    });
    const resolveJson = await resolveRes.json();
    assert(resolveRes.status === 200, `Gagal resolve komplain: ${resolveJson.message}`);
    assertEq(resolveJson.data.status, 'RESOLVED', 'Status komplain harus berubah menjadi RESOLVED');
    assert(
      resolveJson.data.resolutionNotes.includes('dicuci ulang gratis'),
      'Catatan resolusi harus tersimpan'
    );

    // Verifikasi public tracking merefleksikan status RESOLVED dan resolutionNotes
    const track2Res = await fetch(`${API_BASE}/api/laundry/public/track/${encodeURIComponent(order2.invoiceNumber)}`);
    const track2Json = await track2Res.json();
    assertEq(track2Json.status, 'success', 'Public tracking order2 harus berhasil');
    assertEq(track2Json.data.feedback?.status, 'RESOLVED', 'Status feedback di public tracking harus RESOLVED');
    assert(
      track2Json.data.feedback?.resolutionNotes?.includes('dicuci ulang gratis'),
      'resolutionNotes feedback harus muncul di public tracking'
    );
    console.log('✓ Public tracking merefleksikan status RESOLVED & resolutionNotes secara akurat');
    console.log('✓ Komplain berhasil diselesaikan oleh Owner dengan resolutionNotes tercatat\n');

    // =========================================================================
    // MODUL 4: PENGINGAT PELANGGAN PASIF (WIN-BACK WA CRM)
    // =========================================================================
    console.log('--- [4] PENGUJIAN PELANGGAN PASIF & WIN-BACK WA ---');

    // Buat Pelanggan Pasif (terakhir order 35 hari lalu)
    const dormantDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const testCustDormant = await prisma.customer.create({
      data: {
        tenantId,
        name: 'Anita Lestari Pasif',
        phone: `0813${Date.now().toString().slice(-8)}`,
        totalSpent: 150000,
        visitCount: 4,
        createdAt: dormantDate,
        updatedAt: dormantDate,
      },
    });
    createdCustomerIds.push(testCustDormant.id);

    // Buat riwayat order lama untuk pelanggan tersebut
    const oldOrder = await prisma.order.create({
      data: {
        tenantId,
        outletId,
        userId: ownerUser.id,
        customerId: testCustDormant.id,
        invoiceNumber: `ORD-DORMANT-${Date.now()}`,
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 50000,
        totalAmount: 50000,
        createdAt: dormantDate,
        updatedAt: dormantDate,
      },
    });
    createdOrderIds.push(oldOrder.id);

    // Tambahkan laundry_order_details untuk order lama
    await prisma.laundryOrderDetail.create({
      data: {
        tenantId,
        outletId,
        orderId: oldOrder.id,
        currentStage: 'HANDOVER',
        status: 'COMPLETED',
        perfumeVariant: 'Reguler',
      },
    });

    // Query daftar pelanggan pasif (> 30 hari)
    const dormantRes = await fetch(
      `${API_BASE}/api/laundry/customers/dormant?outletId=${outletId}&inactiveDays=30`,
      { headers: authHeaders }
    );
    const dormantJson = await dormantRes.json();
    assert(dormantRes.status === 200, `Gagal query dormant customers: ${dormantJson.message}`);
    const dormantList = Array.isArray(dormantJson.data)
      ? dormantJson.data
      : dormantJson.data?.customers || [];
    const foundDormant = dormantList.find((c: any) => (c.customerId || c.id) === testCustDormant.id);
    assert(!!foundDormant, 'Pelanggan pasif harus terdeteksi di API dormant customers');
    const inactiveDaysFound = foundDormant.daysSinceLastOrder || foundDormant.daysInactive;
    assert(inactiveDaysFound >= 30, `daysInactive harus >= 30, got: ${inactiveDaysFound}`);
    console.log(`✓ Pelanggan pasif terdeteksi: ${foundDormant.name} (${inactiveDaysFound} hari pasif)`);

    // Kirim pesan win-back via API
    const winbackRes = await fetch(
      `${API_BASE}/api/laundry/customers/${testCustDormant.id}/send-winback`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId,
          customMessage: 'Dapatkan diskon 15% untuk cucian kiloan Anda minggu ini!',
        }),
      }
    );
    const winbackJson = await winbackRes.json();
    assert(winbackRes.status === 200, `Kirim win-back gagal: ${winbackJson.message}`);

    // Verifikasi di DB bahwa lastWinbackSentAt telah terupdate
    const updatedCustInDb = await prisma.customer.findUnique({
      where: { id: testCustDormant.id },
    });
    assert(!!updatedCustInDb?.lastWinbackSentAt, 'lastWinbackSentAt harus terisi di DB');
    console.log(`✓ Pesan win-back sukses terkirim & lastWinbackSentAt terupdate: ${updatedCustInDb?.lastWinbackSentAt}`);

    // Coba kirim win-back lagi segera tanpa force -> Harus ditolak 409 Conflict (anti-spam 7 hari)
    const spamRes = await fetch(
      `${API_BASE}/api/laundry/customers/${testCustDormant.id}/send-winback`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ outletId }),
      }
    );
    assertEq(spamRes.status, 409, 'Pengiriman ulang sebelum 7 hari harus ditolak HTTP 409 Conflict');
    const spamJson = await spamRes.json();
    assertEq(spamJson.code, 'RECENTLY_CONTACTED', 'Error code harus RECENTLY_CONTACTED');
    console.log('✓ Perlindungan anti-spam 7 hari (HTTP 409 RECENTLY_CONTACTED) aktif & melindungi pelanggan dari spam');

    // Kirim dengan flag force: true -> Harus diizinkan
    const forceRes = await fetch(
      `${API_BASE}/api/laundry/customers/${testCustDormant.id}/send-winback`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ outletId, force: true }),
      }
    );
    assertEq(forceRes.status, 200, 'Pengiriman dengan force: true harus diizinkan');
    console.log('✓ Opsi paksa kirim (force=true) berfungsi dengan baik');

    console.log('\n========================================================================');
    console.log('🎉 SELURUH SKENARIO QA FASE A RETENSI LAUNDRY BERHASIL DIVERIFIKASI (100% PASS)');
    console.log('========================================================================\n');
  } catch (error: any) {
    console.error('\n❌ QA TEST GAGAL:');
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    console.log('🧹 Membersihkan seluruh entitas pengujian dari database lokal...');
    try {
      const validFbIds = createdFeedbackIds.filter(Boolean);
      if (validFbIds.length > 0) {
        await prisma.laundryCustomerFeedback.deleteMany({
          where: { id: { in: validFbIds } },
        });
      }
      if (createdOrderIds.length > 0) {
        await prisma.laundryStageLog.deleteMany({ where: { orderId: { in: createdOrderIds } } });
        await prisma.laundryOrderDetail.deleteMany({ where: { orderId: { in: createdOrderIds } } });
        await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
        await prisma.paymentTransaction.deleteMany({ where: { orderId: { in: createdOrderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
      }
      if (createdCustomerIds.length > 0) {
        await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
      }
      if (createdServiceIds.length > 0) {
        await prisma.laundryService.deleteMany({ where: { id: { in: createdServiceIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
      if (outletId) {
        await prisma.outlet.update({
          where: { id: outletId },
          data: { googleReviewUrl: initialGoogleReviewUrl },
        });
      }
      console.log('✓ Teardown selesai: Database lokal kembali 100% bersih seperti semula.');
    } catch (cleanupErr: any) {
      console.error('Peringatan saat cleanup:', cleanupErr.message);
    } finally {
      await prisma.$disconnect();
    }
  }
}

runLaundryRetentionE2ETest();
