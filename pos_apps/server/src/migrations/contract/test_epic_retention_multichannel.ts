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

export async function runRetentionMultichannelSuite() {
  console.log('===================================================================');
  console.log('🎁 WELL POS — CRM RETENTION & MULTI-CHANNEL SUITE (PHASE 3 CONTRACTS)');
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
    const outlets = outletsRes.data?.data || [];
    const outletKemang = outlets.find((o: any) => o.name?.includes('Kemang')) || outlets[0];
    const outletId = outletKemang?.id;

    console.log(`📍 Konteks Toko : ${outletKemang.name} (ID: ${outletId})`);
    console.log(`🏢 Tenant ID    : ${tenantId}\n`);

    const timestamp = Date.now().toString().slice(-6);

    // Buat 1 Produk Retail Khusus Pengujian CRM & Multi-Kanal (Harga Rp 25.000)
    const testSku = `SKU-CRM-${timestamp}`;
    const testBarcode = `892${timestamp}`;
    const categoriesRes = await request('/api/categories', { headers: authHeaders });
    const categoryId = categoriesRes.data?.data?.[0]?.id;

    const createProdRes = await request('/api/products', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Kopi Cold Brew CRM ${timestamp}`,
        sku: testSku,
        barcode: testBarcode,
        categoryId,
        outletId,
        productType: 'STANDARD',
        hasStock: true,
        basePrice: 25000,
        costPrice: 12000,
        initialStock: 200,
        minStockAlert: 5,
        unit: 'BOTOL',
      }),
    });

    const sampleProduct = createProdRes.data?.data;
    if (!sampleProduct || !sampleProduct.id) {
      throw new Error(`Gagal membuat produk uji: ${JSON.stringify(createProdRes.data)}`);
    }

    const testPrice = 25000;
    console.log(`☕ Produk Pengujian: ${sampleProduct.name} (Harga: Rp ${testPrice.toLocaleString('id-ID')})\n`);

    // Pastikan Kasir Memiliki Shift Aktif
    const cashierUserCode = `CRM${timestamp.slice(-3)}`;
    const cashierEmail = `kasir.crm.${timestamp}@uracoffee.id`;
    const createCashierRes = await request('/api/users', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `Kasir CRM ${timestamp}`,
        email: cashierEmail,
        password: 'Password123!',
        userCode: cashierUserCode,
        pin: '123456',
        role: 'CASHIER',
        outletId,
      }),
    });

    const cashierUser = createCashierRes.data?.data;
    const cashierLoginRes = await request('/api/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        outletId,
        userCode: cashierUserCode,
        pin: '123456',
      }),
    });

    const cashierToken = cashierLoginRes.data?.data?.token;
    const cashierAuthHeaders = { Authorization: `Bearer ${cashierToken}` };

    // Buka shift kasir
    let shiftId: string | null = null;
    const startShiftRes = await request('/api/shifts/start', {
      method: 'POST',
      headers: cashierAuthHeaders,
      body: JSON.stringify({
        outletId,
        startingCash: 100000,
        notes: 'Shift Pengujian CRM & Multi-Kanal',
      }),
    });
    shiftId = startShiftRes.data?.data?.id;
    if (!shiftId) {
      const currentShiftRes = await request('/api/shifts/current', { headers: cashierAuthHeaders });
      shiftId = currentShiftRes.data?.data?.id;
    }

    if (!shiftId) {
      throw new Error(`Gagal membuka shift kasir: ${JSON.stringify(startShiftRes.data)}`);
    }

    // =========================================================================
    // FLOW 18: Program Loyalitas CRM & Poin Reward Pelanggan
    // =========================================================================
    console.log('--- [FLOW 18] Program Loyalitas CRM & Poin Reward Pelanggan ---');

    // 18.1 Konfigurasi Program Loyalitas di Outlet
    const configLoyaltyRes = await request(`/api/outlets/${outletId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        name: outletKemang.name,
        loyaltyConfig: {
          isActive: true,
          pointsPerSpend: 10000, // Rp 10.000 = 1 poin
          pointValueIdr: 100,    // 1 poin = Rp 100
          minPointsToRedeem: 10,
        },
      }),
    });

    record(
      'FLOW 18.1: Aktivasi Konfigurasi Program Loyalitas Outlet',
      configLoyaltyRes.status === 200 && configLoyaltyRes.data?.data?.loyaltyConfig?.isActive === true,
      `Loyalty Aktif: 1 Poin per Rp 10.000 (Nilai: Rp 100/poin)`
    );

    // 18.2 Pendaftaran Member CRM Pelanggan Baru
    const memberName = `Ahmad Fauzi Member ${timestamp}`;
    const memberPhone = `+62812${timestamp}99`;
    const memberEmail = `member.${timestamp}@uracoffee.id`;

    const createMemberRes = await request('/api/customers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: memberName,
        phone: memberPhone,
        email: memberEmail,
        address: 'Jl. Kemang Raya No. 12B, Jakarta Selatan',
      }),
    });

    const memberCustomer = createMemberRes.data?.data;
    const memberId = memberCustomer?.id;

    record(
      'FLOW 18.2: Registrasi Member CRM Baru',
      createMemberRes.status === 201 && !!memberId,
      `Member ID: ${memberId}, Poin Awal: ${memberCustomer?.loyaltyPoints || 0}, Tier: ${memberCustomer?.tier || 'BRONZE'}`
    );

    // 18.3 Transaksi 1 (Akumulasi Poin Reward Belanja)
    // Belanja 4 pcs @ testPrice (misal 4 * 25.000 = Rp 100.000)
    const qtySpend1 = Math.max(1, Math.ceil(100000 / testPrice));
    const subtotalSpend1 = qtySpend1 * testPrice;

    const checkoutSpend1Res = await request('/api/orders/checkout', {
      method: 'POST',
      headers: cashierAuthHeaders,
      body: JSON.stringify({
        outletId,
        shiftId: shiftId!,
        customerId: memberId,
        customerName: memberName,
        items: [
          {
            productId: sampleProduct.id,
            quantity: qtySpend1,
            unitPrice: testPrice,
            subtotal: subtotalSpend1,
          },
        ],
        payments: [
          {
            method: 'CASH',
            amountPaid: 200000,
          },
        ],
      }),
    });

    const spend1Order = checkoutSpend1Res.data?.data;
    const grandTotalSpend1 = Number(spend1Order?.grandTotal || spend1Order?.totalAmount || subtotalSpend1);

    // Periksa poin terkumpul di database
    const memberAfterSpend1 = await prisma.customer.findUnique({
      where: { id: memberId },
    });
    const pointsAfterSpend1 = Number(memberAfterSpend1?.loyaltyPoints || 0);
    const expectedPoints1 = Math.floor(grandTotalSpend1 / 10000);

    record(
      'FLOW 18.3: Akumulasi Poin Reward Belanja Member',
      (checkoutSpend1Res.status === 201 || checkoutSpend1Res.status === 200) && pointsAfterSpend1 >= expectedPoints1,
      `Belanja: Rp ${grandTotalSpend1.toLocaleString('id-ID')} -> Saldo Poin: ${pointsAfterSpend1} Poin (Expected >= ${expectedPoints1})`
    );

    // 18.4 Transaksi 2 (Penukaran / Redeem Poin Diskon Belanja)
    // Member menukarkan 10 poin (Diskon 10 * Rp 100 = Rp 1.000)
    const pointsToRedeem = 10;
    const expectedPointDiscount = pointsToRedeem * 100;
    const qtySpend2 = Math.max(1, Math.ceil(50000 / testPrice));
    const subtotalSpend2 = qtySpend2 * testPrice;

    const checkoutRedeemRes = await request('/api/orders/checkout', {
      method: 'POST',
      headers: cashierAuthHeaders,
      body: JSON.stringify({
        outletId,
        shiftId: shiftId!,
        customerId: memberId,
        customerName: memberName,
        pointsToRedeem,
        items: [
          {
            productId: sampleProduct.id,
            quantity: qtySpend2,
            unitPrice: testPrice,
            subtotal: subtotalSpend2,
          },
        ],
        payments: [
          {
            method: 'CASH',
            amountPaid: 200000,
          },
        ],
      }),
    });

    const redeemOrder = checkoutRedeemRes.data?.data;
    const grandTotalSpend2 = Number(redeemOrder?.grandTotal || redeemOrder?.totalAmount || subtotalSpend2);
    const memberAfterRedeem = await prisma.customer.findUnique({
      where: { id: memberId },
    });
    const pointsAfterRedeem = Number(memberAfterRedeem?.loyaltyPoints || 0);

    // Catatan: Poin setelah redeem adalah (pointsAfterSpend1 - 10) + poin baru dari belanja 2
    const pointsGainedInSpend2 = Math.floor(grandTotalSpend2 / 10000);
    const expectedFinalPoints = pointsAfterSpend1 - pointsToRedeem + pointsGainedInSpend2;

    record(
      'FLOW 18.4: Penukaran Poin Loyalitas (Redeem Discount) di Kasir',
      (checkoutRedeemRes.status === 201 || checkoutRedeemRes.status === 200) &&
        Number(redeemOrder?.pointDiscountAmount || 0) === expectedPointDiscount &&
        pointsAfterRedeem === expectedFinalPoints,
      `Potongan Poin: Rp ${expectedPointDiscount.toLocaleString('id-ID')}, Saldo Poin Akhir: ${pointsAfterRedeem} Poin (Dipotong ${pointsToRedeem}, Dapat +${pointsGainedInSpend2})`
    );

    // =========================================================================
    // FLOW 19: Mitra Online Delivery & Multi-Kanal (Sales Channels)
    // =========================================================================
    console.log('\n--- [FLOW 19] Mitra Online Delivery & Multi-Kanal (Sales Channels) ---');

    // 19.1 Konfigurasi Sales Channel Outlet
    const channelsPayload = [
      {
        id: 'channel_dine_in',
        code: 'DINE_IN',
        name: 'Dine In',
        group: 'DIRECT',
        isActive: true,
        color: '#2563eb',
        badge: 'Makan di Tempat',
        requiresTable: true,
        requiresOnlineOrderId: false,
      },
      {
        id: 'channel_takeaway',
        code: 'TAKEAWAY',
        name: 'Takeaway',
        group: 'DIRECT',
        isActive: true,
        color: '#d97706',
        badge: 'Bungkus / Bawa Pulang',
        requiresTable: false,
        requiresOnlineOrderId: false,
      },
      {
        id: 'channel_gofood',
        code: 'GOFOOD',
        name: 'GoFood',
        group: 'ONLINE_DELIVERY',
        isActive: true,
        color: '#dc2626',
        badge: 'Mitra Gojek',
        requiresTable: false,
        requiresOnlineOrderId: true,
      },
      {
        id: 'channel_grabfood',
        code: 'GRABFOOD',
        name: 'GrabFood',
        group: 'ONLINE_DELIVERY',
        isActive: true,
        color: '#15803d',
        badge: 'Mitra Grab',
        requiresTable: false,
        requiresOnlineOrderId: true,
      },
    ];

    const configChannelsRes = await request(`/api/outlets/${outletId}/channels`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        channelsConfig: channelsPayload,
      }),
    });

    record(
      'FLOW 19.1: Konfigurasi Multi-Kanal Penjualan (GoFood & GrabFood)',
      configChannelsRes.status === 200 && Array.isArray(configChannelsRes.data?.data),
      `4 Kanal Terkonfigurasi: DINE_IN, TAKEAWAY, GOFOOD, GRABFOOD`
    );

    // 19.2 Transaksi Kasir Kanal GoFood
    const gofoodOnlineId = `GF-${timestamp}`;
    const gofoodCheckoutRes = await request('/api/orders/checkout', {
      method: 'POST',
      headers: cashierAuthHeaders,
      body: JSON.stringify({
        outletId,
        shiftId: shiftId!,
        channel: 'GOFOOD',
        orderType: 'DELIVERY',
        onlineOrderId: gofoodOnlineId,
        notes: 'Driver Gojek sedang menuju outlet',
        items: [
          {
            productId: sampleProduct.id,
            quantity: 2,
            unitPrice: testPrice,
            subtotal: 2 * testPrice,
          },
        ],
        payments: [
          {
            method: 'QRIS',
            amountPaid: 100000,
            qrisReference: `MID-${gofoodOnlineId}`,
          },
        ],
      }),
    });

    const gofoodOrder = gofoodCheckoutRes.data?.data;
    const isGofoodChannelMatch = gofoodOrder?.channel === 'GOFOOD';
    const isGofoodNotesTagged = gofoodOrder?.notes?.includes(`[GOFOOD #${gofoodOnlineId}]`);

    record(
      'FLOW 19.2: Transaksi Kasir Kanal GoFood (Mitra Gojek)',
      (gofoodCheckoutRes.status === 201 || gofoodCheckoutRes.status === 200) && isGofoodChannelMatch && isGofoodNotesTagged,
      `Invoice: ${gofoodOrder?.invoiceNumber}, Channel: ${gofoodOrder?.channel}, Tag: [GOFOOD #${gofoodOnlineId}]`
    );

    // 19.3 Transaksi Kasir Kanal GrabFood
    const grabfoodOnlineId = `GRB-${timestamp}`;
    const grabfoodCheckoutRes = await request('/api/orders/checkout', {
      method: 'POST',
      headers: cashierAuthHeaders,
      body: JSON.stringify({
        outletId,
        shiftId: shiftId!,
        channel: 'GRABFOOD',
        orderType: 'DELIVERY',
        onlineOrderId: grabfoodOnlineId,
        notes: 'Driver Grab pesanan takeaway segera siap',
        items: [
          {
            productId: sampleProduct.id,
            quantity: 3,
            unitPrice: testPrice,
            subtotal: 3 * testPrice,
          },
        ],
        payments: [
          {
            method: 'QRIS',
            amountPaid: 150000,
            qrisReference: `MID-${grabfoodOnlineId}`,
          },
        ],
      }),
    });

    const grabfoodOrder = grabfoodCheckoutRes.data?.data;
    const isGrabfoodChannelMatch = grabfoodOrder?.channel === 'GRABFOOD';
    const isGrabfoodNotesTagged = grabfoodOrder?.notes?.includes(`[GRABFOOD #${grabfoodOnlineId}]`);

    record(
      'FLOW 19.3: Transaksi Kasir Kanal GrabFood (Mitra Grab)',
      (grabfoodCheckoutRes.status === 201 || grabfoodCheckoutRes.status === 200) && isGrabfoodChannelMatch && isGrabfoodNotesTagged,
      `Invoice: ${grabfoodOrder?.invoiceNumber}, Channel: ${grabfoodOrder?.channel}, Tag: [GRABFOOD #${grabfoodOnlineId}]`
    );

    // 19.4 Audit Penyaringan Laporan Transaksi Per Kanal Penjualan
    const gofoodFilterRes = await request(`/api/orders?outletId=${outletId}&channel=GOFOOD`, {
      headers: authHeaders,
    });
    const grabfoodFilterRes = await request(`/api/orders?outletId=${outletId}&channel=GRABFOOD`, {
      headers: authHeaders,
    });

    const gofoodOrdersList = gofoodFilterRes.data?.data || [];
    const grabfoodOrdersList = grabfoodFilterRes.data?.data || [];

    const gofoodFound = gofoodOrdersList.some((o: any) => o.id === gofoodOrder?.id);
    const grabfoodFound = grabfoodOrdersList.some((o: any) => o.id === grabfoodOrder?.id);
    const crossChannelClean = !gofoodOrdersList.some((o: any) => o.id === grabfoodOrder?.id);

    record(
      'FLOW 19.4: Isolasi & Penyaringan Laporan Per Kanal Penjualan',
      gofoodFilterRes.status === 200 &&
        grabfoodFilterRes.status === 200 &&
        gofoodFound &&
        grabfoodFound &&
        crossChannelClean,
      `Penyaringan Akurat: GoFood (${gofoodOrdersList.length} transaksi), GrabFood (${grabfoodOrdersList.length} transaksi), Cross-channel terisolasi`
    );

    // =========================================================================
    // RINGKASAN HASIL PENGUJIAN FASE 3
    // =========================================================================
    console.log('\n===================================================================');
    console.log('📊 REKAPITULASI PENGUJIAN CRM RETENSI & MULTI-KANAL (FASE 3)');
    console.log('===================================================================');

    const totalTests = results.length;
    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Skenario : ${totalTests}`);
    console.log(`Lulus (PASS)   : ${passedTests}`);
    console.log(`Gagal (FAIL)   : ${failedTests}`);
    console.log(`Tingkat Lulus  : ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

    if (failedTests > 0) {
      console.error('❌ Terdapat skenario yang gagal:');
      results.filter((r) => !r.passed).forEach((r) => console.error(` - ${r.step}: ${r.details || r.error}`));
      process.exit(1);
    } else {
      console.log('🎉 SELURUH SKENARIO FASE 3 (FLOW 18 - 19) BERHASIL 100%!');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('💥 FATAL ERROR saat menjalankan test suite CRM retensi & multi-kanal:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runRetentionMultichannelSuite();
}
