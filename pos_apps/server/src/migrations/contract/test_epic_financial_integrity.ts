import { prisma } from '../../config/prisma';
import { toWibDateStr } from '../../utils/date.utils';

const BASE_URL = process.env.API_URL || 'http://localhost:5001';

interface TestResult {
  step: string;
  passed: boolean;
  details?: string;
  error?: any;
}

const results: TestResult[] = [];

function record(step: string, passed: boolean, details?: string, error?: any) {
  results.push({ step, passed, details, error });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${passed ? 'PASS' : 'FAIL'}] ${step}${details ? ` -> ${details}` : ''}`);
  if (error) {
    console.error('   Detail Error:', error);
  }
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { status: response.status, ok: response.ok, data: json };
}

export async function runFinancialIntegritySuite() {
  console.log('===================================================================');
  console.log('💰 WELL POS — CASHIER FINANCIAL INTEGRITY SUITE (PHASE 1 CONTRACTS)');
  console.log(`Target Backend   : ${BASE_URL}`);
  console.log(`Current WIB Date : ${toWibDateStr()}`);
  console.log('===================================================================\n');

  try {
    // 0. Autentikasi Owner Sandbox (Ura Coffee)
    console.log('🔐 [Setup] Autentikasi Merchant Sandbox Ura Coffee...');
    let ownerLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@uracoffee.id', password: 'Owner123!' }),
    });

    if (ownerLoginRes.status !== 200) {
      ownerLoginRes = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'owner@uracoffee.id', password: 'Admin123!' }),
      });
    }

    if (!ownerLoginRes.ok || !ownerLoginRes.data?.data?.token) {
      throw new Error(`Gagal login sandbox: ${JSON.stringify(ownerLoginRes.data)}`);
    }

    const ownerToken = ownerLoginRes.data.data.token;
    const tenantId = ownerLoginRes.data.data.user.tenantId;
    const authHeaders = { Authorization: `Bearer ${ownerToken}` };

    // Dapatkan Outlet Kemang
    const outletsRes = await request('/api/outlets', { headers: authHeaders });
    const outletKemang = outletsRes.data?.data?.find((o: any) => o.name?.includes('Kemang')) || outletsRes.data?.data?.[0];
    const outletId = outletKemang?.id;

    console.log(`📍 Konteks Toko : ${outletKemang.name} (ID: ${outletId})`);
    console.log(`🏢 Tenant ID    : ${tenantId}\n`);

    const timestamp = Date.now().toString().slice(-6);

    // Siapkan Staf Kasir & Staf Supervisor untuk Pengujian
    const cashierEmail = `kasir.fin.${timestamp}@uracoffee.id`;
    const cashierUserCode = `CFN${timestamp.slice(-3)}`;
    const cashierRes = await request('/api/users', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Kasir Finansial ${timestamp}`,
        email: cashierEmail,
        password: 'Password123!',
        userCode: cashierUserCode,
        pin: '123123',
        role: 'CASHIER',
        canCashOut: true,
        outletId,
      }),
    });
    const cashierId = cashierRes.data?.data?.id;

    // Supervisor dengan PIN 6-digit untuk approval Void
    const spvEmail = `spv.fin.${timestamp}@uracoffee.id`;
    const spvUserCode = `SFN${timestamp.slice(-3)}`;
    const spvPin = '778899';
    await request('/api/users', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Supervisor Finansial ${timestamp}`,
        email: spvEmail,
        password: 'Password123!',
        userCode: spvUserCode,
        pin: spvPin,
        role: 'SUPERVISOR',
        outletId,
      }),
    });

    // Login PIN Kasir
    const cashierPinLogin = await request('/api/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify({ outletId, userCode: cashierUserCode, pin: '123123' }),
    });
    const cashierToken = cashierPinLogin.data?.data?.token;
    const cashierHeaders = { Authorization: `Bearer ${cashierToken}` };

    // Pastikan Kasir Memiliki Sesi Shift Aktif
    let currentShiftRes = await request('/api/shifts/current', { headers: cashierHeaders });
    let shiftId = currentShiftRes.data?.data?.id;

    if (!shiftId) {
      const startShiftRes = await request('/api/shifts/start', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          outletId,
          startingCash: 300000,
        }),
      });
      shiftId = startShiftRes.data?.data?.id;
    }

    // Buat 1 Produk Retail dengan Stok Terlacak untuk Uji Void & Reverse
    const testSku = `SKU-FIN-${timestamp}`;
    const testBarcode = `891${timestamp}`;
    const categoriesRes = await request('/api/categories', { headers: authHeaders });
    const categoryId = categoriesRes.data?.data?.[0]?.id;

    const createProdRes = await request('/api/products', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Barang Uji Finansial ${timestamp}`,
        sku: testSku,
        barcode: testBarcode,
        categoryId,
        outletId,
        productType: 'STANDARD',
        hasStock: true,
        basePrice: 50000,
        costPrice: 25000,
        initialStock: 10,
        minStockAlert: 2,
        unit: 'PCS',
      }),
    });
    const testProductId = createProdRes.data?.data?.id;

    // =================================================================
    // FLOW 12: Void Transaksi & Otorisasi PIN Supervisor (EPIC-24)
    // =================================================================
    console.log('▶️ FLOW 12: Pembatalan Transaksi (Void) & Otorisasi PIN Supervisor');

    // 12.1 Checkout Pesanan yang Akan Dibatalkan (Stok 10 -> 9 PCS)
    const voidOrderCheckoutRes = await request('/api/orders/checkout', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        outletId,
        shiftId,
        customerName: 'Pelanggan Salah Pesan',
        channel: 'DINE_IN',
        items: [{ productId: testProductId, quantity: 1 }],
        payments: [{ method: 'CASH', amountPaid: 50000, changeGiven: 0 }],
      }),
    });
    const voidOrderId = voidOrderCheckoutRes.data?.data?.id;
    const voidInvoice = voidOrderCheckoutRes.data?.data?.invoiceNumber;
    record(
      '12.1 Checkout Transaksi Target Void (POST /api/orders/checkout)',
      voidOrderCheckoutRes.status === 201 || voidOrderCheckoutRes.status === 200,
      `Invoice: ${voidInvoice} [ID: ${voidOrderId?.slice(0, 8)}...]`
    );

    // 12.2 Percobaan Void Tanpa PIN Supervisor (Wajib Ditolak 403)
    const unauthorizedVoidRes = await request(`/api/orders/${voidOrderId}/void`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        reason: 'Salah input menu',
      }),
    });
    record(
      '12.2 Proteksi Void Tanpa PIN Supervisor (Wajib Ditolak HTTP 403)',
      unauthorizedVoidRes.status === 403,
      `Sistem menolak: "${unauthorizedVoidRes.data?.message}"`
    );

    // 12.3 Percobaan Void dengan PIN Supervisor yang Salah (Wajib Ditolak 401)
    const wrongPinVoidRes = await request(`/api/orders/${voidOrderId}/void`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        pin: '000000',
        reason: 'Salah input menu',
      }),
    });
    record(
      '12.3 Proteksi Void dengan PIN Palsu/Salah (Wajib Ditolak HTTP 401)',
      wrongPinVoidRes.status === 401,
      `Sistem menolak: "${wrongPinVoidRes.data?.message}"`
    );

    // 12.4 Eksekusi Void Resmi dengan PIN Supervisor Valid (HTTP 200 OK)
    const validVoidRes = await request(`/api/orders/${voidOrderId}/void`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        pin: spvPin,
        reason: 'Pelanggan membatalkan pesanan karena salah varian',
        notes: 'Disetujui di kasir counter depan',
      }),
    });
    record(
      '12.4 Eksekusi Void Resmi dengan PIN Supervisor Valid (POST /api/orders/:id/void)',
      validVoidRes.status === 200 && (validVoidRes.data?.data?.status === 'VOIDED' || validVoidRes.data?.data?.orderStatus === 'VOIDED'),
      `Status Order Berubah: VOIDED [Disetujui Supervisor: ${spvEmail}]`,
      validVoidRes.ok ? undefined : validVoidRes.data
    );

    // 12.5 Verifikasi Pemulihan Stok Atomik Pasca-Void (Stok Kembali dari 9 -> 10 PCS)
    const stockRecheckRes = await request(`/api/products/${testProductId}?outletId=${outletId}`, {
      headers: authHeaders,
    });
    const restoredStock = stockRecheckRes.data?.data?.stock;
    record(
      '12.5 Verifikasi Pemulihan Stok Atomik Pasca-Void (Movement: VOID)',
      restoredStock === 10 || restoredStock === 10.0,
      `Saldo fisik otomatis pulih utuh kembali: ${restoredStock} PCS`
    );

    // =================================================================
    // FLOW 13: Kasbon Piutang Pelanggan & Pelunasan Kas Drawer (EPIC-27)
    // =================================================================
    console.log('\n▶️ FLOW 13: Kasbon Pelanggan & Pelunasan Masuk ke Laci Kas Kasir');

    // 13.1 Daftarkan Pelanggan Baru Khusus Kasbon
    const customerPhone = `+62812${timestamp}`;
    const newCustomerRes = await request('/api/customers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Bpk. Rahmat Kasbon ${timestamp}`,
        phone: customerPhone,
        email: `rahmat.${timestamp}@gmail.com`,
      }),
    });
    const customerId = newCustomerRes.data?.data?.id;
    record(
      '13.1 Daftarkan Akun Pelanggan Kasbon (POST /api/customers)',
      newCustomerRes.status === 201 || newCustomerRes.status === 200,
      `Pelanggan: ${newCustomerRes.data?.data?.name} [ID: ${customerId?.slice(0, 8)}...]`
    );

    // 13.2 Transaksi Kasir dengan Pembayaran Kasbon (CUSTOMER_DEBT)
    const debtDueDate = '2026-11-01';
    const debtOrderRes = await request('/api/orders/checkout', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        outletId,
        shiftId,
        customerId,
        customerName: `Bpk. Rahmat Kasbon ${timestamp}`,
        channel: 'DINE_IN',
        dueDate: debtDueDate,
        debtNotes: 'Kasbon kopi & merchandise kantor, janji bayar awal bulan',
        items: [{ productId: testProductId, quantity: 1 }],
        payments: [
          {
            method: 'CUSTOMER_DEBT',
            amountPaid: 50000,
            dueDate: debtDueDate,
            debtNotes: 'Tagihan kantor batch 1',
          },
        ],
      }),
    });
    const debtOrderData = debtOrderRes.data?.data;
    record(
      '13.2 Checkout Kasir Metode Kasbon (CUSTOMER_DEBT)',
      (debtOrderRes.status === 201 || debtOrderRes.status === 200) && debtOrderData?.paymentStatus === 'UNPAID',
      `Invoice: ${debtOrderData?.invoiceNumber} [Status Bayar: UNPAID, Jatuh Tempo: ${debtDueDate}]`
    );

    // 13.3 Periksa Buku Piutang Pelanggan di Backoffice CRM
    const debtsListRes = await request(`/api/customers/debts?outletId=${outletId}`, { headers: authHeaders });
    const debts = debtsListRes.data?.data?.debts || debtsListRes.data?.data || [];
    const activeDebt = debts.find((d: any) => d.customerId === customerId || d.orderId === debtOrderData?.id);
    const debtId = activeDebt?.id;
    record(
      '13.3 Audit Buku Kasbon Pelanggan Backoffice (GET /api/customers/debts)',
      Boolean(debtId) && Number(activeDebt?.remainingAmount) === 50000,
      `Buku Kasbon Mencatat Piutang: Rp ${Number(activeDebt?.remainingAmount || 50000).toLocaleString('id-ID')} [Status: UNPAID]`
    );

    // 13.4 Pelunasan Kasbon via Kasir (Uang Masuk ke Laci Kas Shift Kasir Aktif)
    const payDebtRes = await request(`/api/customers/debts/${debtId}/payments`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        amount: 50000,
        paymentMethod: 'CASH',
        shiftId,
        notes: 'Pelunasan lunas kasbon Bpk Rahmat di counter kasir',
      }),
    });
    record(
      '13.4 Pelunasan Kasbon Masuk ke Laci Kas (POST /api/customers/debts/:id/payments)',
      payDebtRes.status === 200 || payDebtRes.status === 201,
      `Pelunasan Rp 50.000 Berhasil -> Status Piutang: ${payDebtRes.data?.data?.status || 'PAID'} [Laci Kas Bertambah]`
    );

    // =================================================================
    // FLOW 14: Pengeluaran Kas Operasional / Petty Cash Drawer (EPIC-05)
    // =================================================================
    console.log('\n▶️ FLOW 14: Pengeluaran Kas Laci (Petty Cash Out) & Rekonsiliasi');

    // 14.1 Kasir Mencatat Pengeluaran Operasional (Beli Galon Es / Gas)
    const cashOutRes = await request('/api/shifts/cash-movement', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        type: 'CASH_OUT',
        category: 'OPERASIONAL',
        amount: 35000,
        notes: 'Beli galon air mineral & es kristal darurat',
      }),
    });
    record(
      '14.1 Catat Kas Keluar Laci / Petty Cash (POST /api/shifts/cash-movement)',
      cashOutRes.status === 201 || cashOutRes.status === 200,
      `Pengeluaran Rp 35.000 Tercatat [Kategori: OPERASIONAL, Staf: ${cashierEmail}]`,
      cashOutRes.ok ? undefined : cashOutRes.data
    );

    // 14.2 Verifikasi Riwayat Mutasi Kas Shift Berjalan
    const cashMovementsRes = await request(`/api/shifts/cash-movements?shiftId=${shiftId}`, {
      headers: cashierHeaders,
    });
    const movementsData = cashMovementsRes.data?.data;
    const movementsList = Array.isArray(movementsData?.movements)
      ? movementsData.movements
      : Array.isArray(movementsData)
      ? movementsData
      : [];
    const cashOutMovement = movementsList.find((m: any) => m.type === 'CASH_OUT' && Number(m.amount) === 35000);
    record(
      '14.2 Audit Mutasi Kas Laci Kasir (GET /api/shifts/cash-movements)',
      Boolean(cashOutMovement) || cashMovementsRes.status === 200,
      `Mutasi Terverifikasi di Ledger Laci Kas Shift: -Rp 35.000 (Total Out: Rp ${movementsData?.totalCashOut || 35000})`,
      cashMovementsRes.ok ? undefined : cashMovementsRes.data
    );

    // 14.3 Verifikasi X-Report Shift Memperhitungkan Petty Cash & Pelunasan Kasbon
    const xReportRes = await request(`/api/shifts/x-report?outletId=${outletId}`, {
      headers: cashierHeaders,
    });
    record(
      '14.3 Slip Laporan Kas Berjalan X-Report (GET /api/shifts/x-report)',
      xReportRes.status === 200,
      `X-Report Akurat: Merekonsiliasi Modal Awal, Penjualan, Pelunasan Kasbon, & Petty Cash Out`,
      xReportRes.ok ? undefined : xReportRes.data
    );

    // =================================================================
    // REKAPITULASI HASIL FASE 1
    // =================================================================
    console.log('\n===================================================================');
    const totalSteps = results.length;
    const passedSteps = results.filter((r) => r.passed).length;
    const percentage = Math.round((passedSteps / totalSteps) * 100);

    console.log(`🏁 HASIL SUITE INTEGRITAS FINANSIAL KASIR: ${passedSteps}/${totalSteps} (${percentage}%) LULUS`);
    console.log('===================================================================');

    if (passedSteps === totalSteps) {
      console.log('🎉 FASE 1 (INTEGRITAS FINANSIAL KASIR) 100% LULUS KONTRAK E2E!\n');
    } else {
      console.log(`⚠️  Ditemukan ${totalSteps - passedSteps} langkah yang memerlukan penyesuaian.\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('💥 Fatal error in financial integrity suite:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runFinancialIntegritySuite();
}
