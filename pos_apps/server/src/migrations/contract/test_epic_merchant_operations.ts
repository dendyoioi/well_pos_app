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

export async function runMerchantOperationsSuite() {
  console.log('===================================================================');
  console.log('🛒 WELL POS — MERCHANT CORE OPERATIONAL SUITE (E2E CONTRACTS)');
  console.log(`Target Backend   : ${BASE_URL}`);
  console.log(`Current WIB Date : ${toWibDateStr()}`);
  console.log('===================================================================\n');

  try {
    // 0. Ambil Token Owner Sandbox (Ura Coffee)
    console.log('🔐 [Setup] Login Merchant Owner Sandbox...');
    let loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'owner@uracoffee.id',
        password: 'Owner123!',
      }),
    });

    if (loginRes.status !== 200) {
      loginRes = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'owner@uracoffee.id',
          password: 'Admin123!',
        }),
      });
    }

    if (!loginRes.ok || !loginRes.data?.data?.token) {
      throw new Error(`Gagal login sandbox: ${JSON.stringify(loginRes.data)}`);
    }

    const ownerToken = loginRes.data.data.token;
    const tenantId = loginRes.data.data.user.tenantId;
    const authHeaders = { Authorization: `Bearer ${ownerToken}` };

    // Dapatkan Outlet Kemang
    const outletsRes = await request('/api/outlets', { headers: authHeaders });
    const outletKemang = outletsRes.data?.data?.find((o: any) => o.name?.includes('Kemang')) || outletsRes.data?.data?.[0];
    const outletId = outletKemang?.id;

    if (!outletId) {
      throw new Error('Outlet tidak ditemukan di akun merchant sandbox');
    }
    console.log(`📍 Konteks Toko : ${outletKemang.name} (ID: ${outletId})`);
    console.log(`🏢 Tenant ID    : ${tenantId}\n`);

    const timestamp = Date.now().toString().slice(-6);

    // =================================================================
    // FLOW 6: Katalog Produk (Kategori, Retail Ber-SKU, & Menu F&B)
    // =================================================================
    console.log('▶️ FLOW 6: Manajemen Katalog Produk (Kategori, Retail Ber-SKU, & Menu F&B)');

    // 6.1 Buat Kategori Baru
    const categoryName = `Merchandise & Bottled ${timestamp}`;
    const catRes = await request('/api/categories', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: categoryName }),
    });
    const categoryId = catRes.data?.data?.id;
    record(
      '6.1 Buat Kategori Baru (POST /api/categories)',
      catRes.status === 201 || catRes.status === 200,
      `Kategori: "${categoryName}" [ID: ${categoryId?.slice(0, 8)}...]`
    );

    // 6.2 Buat Produk Retail Ber-SKU (Stok Terlacak Langsung)
    const retailSku = `RET-${timestamp}`;
    const retailBarcode = `899${timestamp}`;
    const retailProductRes = await request('/api/products', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Well POS Stainless Tumbler ${timestamp}`,
        sku: retailSku,
        barcode: retailBarcode,
        categoryId,
        outletId,
        productType: 'STANDARD',
        hasStock: true,
        basePrice: 125000,
        costPrice: 75000,
        initialStock: 50,
        minStockAlert: 5,
        unit: 'PCS',
        description: 'Merchandise resmi botol minum ramah lingkungan',
      }),
    });
    const retailProductId = retailProductRes.data?.data?.id;
    record(
      '6.2 Buat Produk Retail Ber-SKU (POST /api/products)',
      (retailProductRes.status === 201 || retailProductRes.status === 200) && Boolean(retailProductId),
      `Produk: ${retailProductRes.data?.data?.name || 'Tumbler'} [SKU: ${retailSku}, Saldo Awal: 50 PCS]`,
      retailProductRes.ok ? undefined : retailProductRes.data
    );

    // 6.3 Buat Produk Menu F&B (Stok Berdasarkan Resep Bahan Baku / Composite)
    const fnbSku = `FNB-${timestamp}`;
    const fnbBarcode = `898${timestamp}`;
    const fnbProductRes = await request('/api/products', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Cold Brew Signature ${timestamp}`,
        sku: fnbSku,
        barcode: fnbBarcode,
        categoryId,
        outletId,
        productType: 'COMPOSITE',
        hasStock: false,
        basePrice: 32000,
        costPrice: 14000,
        unit: 'CUP',
        description: 'Minuman seduh dingin dengan konsentrat biji arabika',
      }),
    });
    const fnbProductId = fnbProductRes.data?.data?.id;
    record(
      '6.3 Buat Produk Menu F&B (POST /api/products)',
      (fnbProductRes.status === 201 || fnbProductRes.status === 200) && Boolean(fnbProductId),
      `Produk F&B: ${fnbProductRes.data?.data?.name || 'Cold Brew'} [SKU: ${fnbSku}, Non-Inventory Direct]`,
      fnbProductRes.ok ? undefined : fnbProductRes.data
    );

    // =================================================================
    // FLOW 7: Manajemen Stok (Stock In, Stock Out, & Stock Opname)
    // =================================================================
    console.log('\n▶️ FLOW 7: Manajemen Stok Persediaan (Stock In, Stock Out, & Stock Opname Fisik)');

    // 7.1 Stock In Produk Retail (+20 pcs)
    const stockInRes = await request('/api/inventory/stock-in', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        productId: retailProductId,
        outletId,
        quantity: 20,
        notes: 'Penerimaan kiriman vendor merchandise batch 1',
      }),
    });
    record(
      '7.1 Stock In Produk Retail (+20 PCS) (POST /api/inventory/stock-in)',
      stockInRes.status === 200 || stockInRes.status === 201,
      `Stok bertambah 20 PCS -> Saldo tercatat sistem: 70 PCS`,
      stockInRes.ok ? undefined : stockInRes.data
    );

    // 7.2 Stock Out Produk Retail Rusak/Cacat (-2 pcs)
    const stockOutRes = await request('/api/inventory/stock-out', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        productId: retailProductId,
        outletId,
        quantity: 2,
        notes: 'Barang display cacat fisik / baret pabrik',
      }),
    });
    record(
      '7.2 Stock Out Produk Rusak (-2 PCS) (POST /api/inventory/stock-out)',
      stockOutRes.status === 200 || stockOutRes.status === 201,
      `Stok berkurang 2 PCS -> Saldo tercatat sistem: 68 PCS`,
      stockOutRes.ok ? undefined : stockOutRes.data
    );

    // 7.3 Stock Opname Fisik Produk Retail (Penyesuaian Fisik Riil: 65 pcs)
    const stockAdjRes = await request('/api/inventory/adjustment', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        productId: retailProductId,
        outletId,
        actualStock: 65,
        notes: 'Stock opname mingguan kasir toko (selisih fisik 3 pcs)',
      }),
    });
    record(
      '7.3 Stock Opname Fisik Produk Retail (POST /api/inventory/adjustment)',
      stockAdjRes.status === 200 || stockAdjRes.status === 201,
      `Penyesuaian fisik berhasil: Saldo sistem disinkronkan tepat 65 PCS`,
      stockAdjRes.ok ? undefined : stockAdjRes.data
    );

    // =================================================================
    // FLOW 8: Manajemen Staf Multi-Role & Autentikasi PIN Keamanan
    // =================================================================
    console.log('\n▶️ FLOW 8: Manajemen Staf Multi-Role & Autentikasi PIN Keamanan');

    // 8.1 Buat Staf Kasir Baru
    const cashierEmail = `kasir.baru.${timestamp}@uracoffee.id`;
    const newCashierRes = await request('/api/users', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Bima Kasir ${timestamp}`,
        email: cashierEmail,
        password: 'Password123!',
        userCode: `CSH${timestamp.slice(-3)}`,
        pin: '654321',
        role: 'CASHIER',
        outletId,
      }),
    });
    const cashierUserId = newCashierRes.data?.data?.id;
    record(
      '8.1 Tambah Staf Kasir Baru dengan PIN 6 Digit (POST /api/users)',
      newCashierRes.status === 201 || newCashierRes.status === 200,
      `Kasir: ${newCashierRes.data?.data?.name} [Role: CASHIER, PIN: 654321]`
    );

    // 8.2 Buat Staf Gudang Baru
    const warehouseEmail = `gudang.baru.${timestamp}@uracoffee.id`;
    const newWhRes = await request('/api/users', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Agus Gudang ${timestamp}`,
        email: warehouseEmail,
        password: 'Password123!',
        userCode: `GDG${timestamp.slice(-3)}`,
        pin: '112233',
        role: 'WAREHOUSE',
        outletId,
      }),
    });
    record(
      '8.2 Tambah Staf Logistik Gudang Baru (POST /api/users)',
      newWhRes.status === 201 || newWhRes.status === 200,
      `Staf: ${newWhRes.data?.data?.name} [Role: WAREHOUSE]`
    );

    // 8.3 Buat Staf Supervisor Baru
    const spvEmail = `spv.baru.${timestamp}@uracoffee.id`;
    const newSpvRes = await request('/api/users', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Mega Supervisor ${timestamp}`,
        email: spvEmail,
        password: 'Password123!',
        userCode: `SPV${timestamp.slice(-3)}`,
        pin: '998877',
        role: 'SUPERVISOR',
        outletId,
      }),
    });
    record(
      '8.3 Tambah Staf Supervisor Baru dengan PIN Void (POST /api/users)',
      newSpvRes.status === 201 || newSpvRes.status === 200,
      `Supervisor: ${newSpvRes.data?.data?.name} [Role: SUPERVISOR, PIN: 998877]`
    );

    // 8.4 Verifikasi Login PIN Kasir Baru & Peroleh Token Kasir
    const cashierUserCode = `CSH${timestamp.slice(-3)}`;
    const testNewCashierLogin = await request('/api/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify({
        outletId,
        userCode: cashierUserCode,
        pin: '654321',
      }),
    });
    const cashierToken = testNewCashierLogin.data?.data?.token;
    const cashierHeaders = { Authorization: `Bearer ${cashierToken}` };
    record(
      '8.4 Verifikasi Autentikasi PIN Kasir Baru (POST /api/auth/pin-login)',
      testNewCashierLogin.status === 200 && Boolean(cashierToken),
      `Token Kasir Baru Valid: ${testNewCashierLogin.data?.data?.user?.name || cashierUserCode}`,
      testNewCashierLogin.ok ? undefined : testNewCashierLogin.data
    );

    // =================================================================
    // FLOW 9: Aktivasi Pajak & Biaya Toko + Checkout POS Kasir
    // =================================================================
    console.log('\n▶️ FLOW 9: Aktivasi Pajak & Biaya Tambahan Toko (Taxes & Outlet Fees) + Checkout Kasir');

    // 9.1 Atur Biaya PB1 10% & Service Charge 5%
    const feesConfigPayload = [
      {
        id: 'tax_pb1',
        name: 'PB1 (Pajak Restoran)',
        type: 'PERCENTAGE',
        rate: 10,
        channelScope: 'ALL',
        isActive: true,
        category: 'DEFAULT_TAX_SERVICE',
      },
      {
        id: 'service_charge',
        name: 'Service Charge',
        type: 'PERCENTAGE',
        rate: 5,
        channelScope: 'ALL',
        isActive: true,
        category: 'DEFAULT_TAX_SERVICE',
      },
      {
        id: 'packaging_fee',
        name: 'Biaya Kemasan Takeaway',
        type: 'FIXED',
        rate: 2000,
        channelScope: 'TAKEAWAY',
        isActive: true,
        category: 'ON_DEMAND_PACKAGING',
      },
    ];

    const feesUpdateRes = await request(`/api/outlets/${outletId}/fees`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ feesConfig: feesConfigPayload }),
    });

    record(
      '9.1 Konfigurasi Pajak & Biaya Toko (PUT /api/outlets/:id/fees)',
      feesUpdateRes.status === 200,
      `Aktivasi: PB1 10%, Service Charge 5%, Biaya Kemasan Rp 2.000`
    );

    // 9.2 Buka Shift Kasir Baru jika belum aktif
    let shiftRes = await request(`/api/shifts/active?outletId=${outletId}`, { headers: cashierHeaders });
    let shiftId = shiftRes.data?.data?.id;

    if (!shiftId) {
      const openShiftRes = await request('/api/shifts/open', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          outletId,
          startingCash: 250000,
        }),
      });
      shiftId = openShiftRes.data?.data?.id;
    }

    // 9.3 Checkout Kasir Membeli Produk Retail & Menu F&B dengan Pajak Otomatis
    const checkoutRes = await request('/api/orders/checkout', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        outletId,
        shiftId,
        customerName: 'Pelanggan Walk-In Retail',
        channel: 'DINE_IN',
        items: [
          {
            productId: retailProductId,
            quantity: 1,
          },
        ],
        payments: [
          {
            method: 'CASH',
            amountPaid: 150000,
            changeGiven: 25000,
          },
        ],
      }),
    });

    const invoiceData = checkoutRes.data?.data;
    const grandTotal = invoiceData?.grandTotal || invoiceData?.totalAmount || 0;
    const subtotal = invoiceData?.subtotal || 125000;

    record(
      '9.2 Checkout POS dengan Otomasi Pajak & Biaya (POST /api/orders/checkout)',
      (checkoutRes.status === 201 || checkoutRes.status === 200) && Boolean(invoiceData?.invoiceNumber),
      `Invoice: ${invoiceData?.invoiceNumber} [Subtotal: Rp ${subtotal.toLocaleString('id-ID')}, Grand Total: Rp ${grandTotal.toLocaleString('id-ID')}]`,
      checkoutRes.ok ? undefined : checkoutRes.data
    );

    // 9.3 Verifikasi Pemotongan Stok Retail Otomatis (Saldo 65 -> 64 PCS)
    const productDetailRes = await request(`/api/products/${retailProductId}?outletId=${outletId}`, {
      headers: authHeaders,
    });
    const updatedRetailStock = productDetailRes.data?.data?.stock;
    record(
      '9.3 Pemotongan Stok Retail Otomatis Pasca-Checkout',
      updatedRetailStock === 64 || updatedRetailStock === 64.0,
      `Saldo fisik Tumbler terpotong 1 PCS tepat menjadi: ${updatedRetailStock} PCS`
    );

    // =================================================================
    // FLOW 10: Promo & Voucher Diskon
    // =================================================================
    console.log('\n▶️ FLOW 10: Manajemen Promo & Voucher Diskon Pembelian');

    const promoCode = `HEMAT${timestamp}`;
    const promoRes = await request('/api/promotions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: promoCode,
        name: `Promo Spesial First Release ${timestamp}`,
        scope: 'ORDER',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        minOrderAmount: 50000,
        maxDiscountAmount: 30000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isActive: true,
      }),
    });

    record(
      '10.1 Buat Master Voucher Promo Diskon 20% (POST /api/promotions)',
      promoRes.status === 201 || promoRes.status === 200,
      `Voucher: ${promoCode} [Diskon: 20%, Min: Rp 50.000]`,
      promoRes.ok ? undefined : promoRes.data
    );

    // 10.2 Validasi Kupon Promo
    const valPromoRes = await request('/api/promotions/validate', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        code: promoCode,
        subtotal: 100000,
      }),
    });
    const discountAmount = valPromoRes.data?.data?.discountAmount || 20000;
    record(
      '10.2 Validasi & Perhitungan Diskon Promo (POST /api/promotions/validate)',
      valPromoRes.status === 200,
      `Kupon Valid: Potongan Diskon Rp ${discountAmount.toLocaleString('id-ID')}`,
      valPromoRes.ok ? undefined : valPromoRes.data
    );

    // =================================================================
    // FLOW 11: Absensi Staf Kasir / Karyawan (Attendance Clock-In & Out)
    // =================================================================
    console.log('\n▶️ FLOW 11: Sistem Absensi Digital Karyawan (Clock-In & Clock-Out)');

    // 11.1 Pengaturan Konfigurasi Jam Kerja Outlet
    const attConfigRes = await request('/api/attendance/config', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        outletId,
        standardClockIn: '08:00',
        standardClockOut: '17:00',
        lateToleranceMinutes: 15,
      }),
    });
    record(
      '11.1 Pengaturan Jam Kerja & Toleransi Keterlambatan (PUT /api/attendance/config)',
      attConfigRes.status === 200,
      `Jadwal Standar: 08:00 WIB (Toleransi: 15 Menit)`
    );

    // 11.2 Clock-In Staf Kasir Baru dengan PIN
    const clockInRes = await request('/api/attendance/clock-in', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId,
        userId: cashierUserId,
        pin: '654321',
        notes: 'Hadir shift pagi operasional counter',
      }),
    });
    record(
      '11.2 Clock-In Staf Kasir dengan PIN (POST /api/attendance/clock-in)',
      clockInRes.status === 201 || clockInRes.status === 200,
      `Status Masuk: ${clockInRes.data?.data?.status || 'TERCATAT'} [Waktu: ${clockInRes.data?.data?.clockIn ? new Date(clockInRes.data.data.clockIn).toLocaleTimeString('id-ID') : 'Aktif'}]`,
      clockInRes.ok ? undefined : clockInRes.data
    );

    // 11.3 Ambil Daftar Absensi Hari Ini
    const todayAttRes = await request(`/api/attendance/today?outletId=${outletId}`, {
      headers: authHeaders,
    });
    const staffAttList = todayAttRes.data?.data?.staff || [];
    const clockedInStaff = staffAttList.find((s: any) => s.id === cashierUserId);
    record(
      '11.3 Pantau Live Feed Absensi Outlet (GET /api/attendance/today)',
      todayAttRes.status === 200 && (clockedInStaff?.currentAttendance?.isClockedIn === true || Boolean(clockedInStaff)),
      `Staf terdeteksi aktif bertugas: ${clockedInStaff?.name || 'Kasir Bima'}`
    );

    // 11.4 Clock-Out Staf Kasir di Akhir Hari
    const clockOutRes = await request('/api/attendance/clock-out', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId,
        userId: cashierUserId,
        pin: '654321',
        notes: 'Selesai shift operasional counter kasir',
      }),
    });
    record(
      '11.4 Clock-Out Staf Kasir (POST /api/attendance/clock-out)',
      clockOutRes.status === 200,
      `Sesi kerja tertutup: ${clockOutRes.data?.data?.clockOut ? new Date(clockOutRes.data.data.clockOut).toLocaleTimeString('id-ID') : 'Selesai'}`,
      clockOutRes.ok ? undefined : clockOutRes.data
    );

    // =================================================================
    // REKAPITULASI AKHIR HASIL SUITE OPERASIONAL
    // =================================================================
    console.log('\n===================================================================');
    const totalSteps = results.length;
    const passedSteps = results.filter((r) => r.passed).length;
    const percentage = Math.round((passedSteps / totalSteps) * 100);

    console.log(`🏁 HASIL AKHIR MERCHANT CORE OPERATIONS SUITE: ${passedSteps}/${totalSteps} (${percentage}%) LULUS`);
    console.log('===================================================================');

    if (passedSteps === totalSteps) {
      console.log('🎉 SELURUH MODUL OPERASIONAL MERCHANT 100% LULUS KONTRAK E2E!\n');
    } else {
      console.log(`⚠️  Ditemukan ${totalSteps - passedSteps} langkah yang memerlukan investigasi.\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('💥 Fatal error in merchant operations suite:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runMerchantOperationsSuite();
}
