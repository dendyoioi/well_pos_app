import { prisma } from '../src/config/prisma';
import { PaymentMethod } from '@prisma/client';

async function verifyPhase3() {
  console.log('===================================================================');
  console.log('🧪 VERIFIKASI AKHIR FASE 3: E2E SAAS ONBOARDING & POS ADVANCED');
  console.log('===================================================================\n');

  const BASE_URL = 'http://localhost:5001';

  // Bersihkan data dummy sisa uji jika ada
  const existingTestTenants = await prisma.tenant.findMany({
    where: { businessName: 'Kopi Senja Nusantara' },
  });
  for (const t of existingTestTenants) {
    await prisma.holdOrder.deleteMany({ where: { outlet: { tenantId: t.id } } });
    await prisma.payment.deleteMany({ where: { order: { tenantId: t.id } } });
    await prisma.orderItem.deleteMany({ where: { order: { tenantId: t.id } } });
    await prisma.order.deleteMany({ where: { tenantId: t.id } });
    await prisma.shift.deleteMany({ where: { outlet: { tenantId: t.id } } });
    await prisma.stockMovement.deleteMany({ where: { outlet: { tenantId: t.id } } });
    await prisma.outletProduct.deleteMany({ where: { outlet: { tenantId: t.id } } });
    await prisma.product.deleteMany({ where: { tenantId: t.id } });
    await prisma.category.deleteMany({ where: { tenantId: t.id } });
    await prisma.tenantSubscription.deleteMany({ where: { tenantId: t.id } });
    await prisma.user.deleteMany({ where: { tenantId: t.id } });
    await prisma.outlet.deleteMany({ where: { tenantId: t.id } });
    await prisma.tenant.delete({ where: { id: t.id } });
  }

  // 1. Registrasi Klien Mandiri
  console.log('1️⃣ Menguji Registrasi Mandiri Pemilik Tenant...');
  const regEmail = `owner-${Date.now()}@kopisenja.com`;
  const regRes = await fetch(`${BASE_URL}/api/saas/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Kopi Senja Nusantara',
      businessType: 'F&B / Kafe & Restoran',
      ownerName: 'Bagus Prakoso',
      email: regEmail,
      phone: '081399887766',
      password: 'password123',
      pin: '998877',
    }),
  });
  const regData = await regRes.json();
  if (regRes.status !== 201) throw new Error(`Gagal registrasi: ${JSON.stringify(regData)}`);
  const ownerToken = regData.data.token;
  const tenantId = regData.data.tenant.id;
  const outletId = regData.data.user.outlet.id;
  console.log(`   ✅ Tenant Terdaftar: "${regData.data.tenant.businessName}" | ID: ${tenantId.slice(0, 8)}...`);

  // 2. Wizard Onboarding 4 Langkah
  console.log('\n2️⃣ Menjalankan Setup Onboarding Wizard 4 Langkah...');
  const onbRes = await fetch(`${BASE_URL}/api/saas/onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      outletId,
      address: 'Jl. Senopati No. 12, Jakarta Selatan',
      phone: '081399887766',
      receiptSize: '58mm',
      receiptFooter: 'Terima kasih telah singgah di Kopi Senja!',
      cashierName: 'Asep (Kasir Senja)',
      cashierPin: '123456',
      seedSampleProducts: true,
    }),
  });
  const onbData = await onbRes.json();
  if (onbRes.status !== 200) throw new Error(`Gagal onboarding: ${JSON.stringify(onbData)}`);
  console.log(`   ✅ Onboarding Selesai: Outlet terkonfigurasi & ${onbData.data.seededProductsCount} produk sampel terisi`);

  // 3. Login Kasir Pertama dengan PIN 6-digit
  console.log('\n3️⃣ Menguji Login Kasir Baru dengan PIN (123456)...');
  const pinRes = await fetch(`${BASE_URL}/api/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '123456', email: onbData.data.createdCashier.email }),
  });
  const pinData = await pinRes.json();
  if (pinRes.status !== 200) throw new Error(`Gagal PIN login: ${JSON.stringify(pinData)}`);
  const cashierToken = pinData.data.token;
  console.log(`   ✅ Kasir Berhasil Login: ${pinData.data.user.name} | Outlet: ${pinData.data.user.outlet.name}`);

  // 4. Buka Shift Kasir
  console.log('\n4️⃣ Membuka Shift Kasir Baru (Modal Awal: Rp 150.000)...');
  const shiftRes = await fetch(`${BASE_URL}/api/shifts/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`,
    },
    body: JSON.stringify({ startingCash: 150000, notes: 'Shift pagi pembukaan' }),
  });
  const shiftData = await shiftRes.json();
  if (shiftRes.status !== 201) throw new Error(`Gagal buka shift: ${JSON.stringify(shiftData)}`);
  console.log(`   ✅ Shift Kasir Terbuka: ID ${shiftData.data.id.slice(0, 8)}... | Modal: Rp 150.000`);

  // Ambil produk dari katalog tenant
  const tenantProducts = await prisma.product.findMany({
    where: { tenantId },
    take: 2,
  });

  // 5. Fitur Tahan Pesanan (Hold Order)
  console.log('\n5️⃣ Menguji Fitur Tahan Pesanan (Hold Order F8)...');
  const holdRes = await fetch(`${BASE_URL}/api/orders/hold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`,
    },
    body: JSON.stringify({
      outletId,
      customerName: 'Meja 03 - Kak Sheila',
      note: 'Tahan sebentar, pelanggan sedang keluar ambil dompet',
      items: [
        {
          productId: tenantProducts[0].id,
          name: tenantProducts[0].name,
          quantity: 2,
          unitPrice: Number(tenantProducts[0].basePrice),
        },
      ],
      totalAmount: Number(tenantProducts[0].basePrice) * 2,
    }),
  });
  const holdData = await holdRes.json();
  if (holdRes.status !== 201) throw new Error(`Gagal hold order: ${JSON.stringify(holdData)}`);
  const holdId = holdData.data.id;
  console.log(`   ✅ Pesanan Berhasil Ditahan: ID ${holdId.slice(0, 8)}... | Meja: ${holdData.data.customerName}`);

  // Baca daftar pesanan tertahan
  const getHoldRes = await fetch(`${BASE_URL}/api/orders/hold?outletId=${outletId}`, {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const getHoldData = await getHoldRes.json();
  console.log(`   ✅ Antrean Hold Order Terbaca: ${getHoldData.data.length} antrean`);

  // 6. Transaksi Pembayaran Campuran (Split Payment: Tunai + QRIS)
  const unitPrice = Number(tenantProducts[0].basePrice);
  const totalBill = unitPrice * 2;
  const cashPortion = Math.round(totalBill / 2);
  const qrisPortion = totalBill - cashPortion;

  console.log(`\n6️⃣ Menguji Checkout Split Payment (Total: Rp ${totalBill.toLocaleString('id-ID')} -> Tunai: Rp ${cashPortion.toLocaleString('id-ID')} + QRIS: Rp ${qrisPortion.toLocaleString('id-ID')})...`);
  const checkoutRes = await fetch(`${BASE_URL}/api/orders/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`,
    },
    body: JSON.stringify({
      outletId,
      customerName: 'Kak Sheila',
      customerPhone: '081299881122',
      items: [
        {
          productId: tenantProducts[0].id,
          quantity: 2,
        },
      ],
      payments: [
        { method: PaymentMethod.CASH, amountPaid: cashPortion, changeGiven: 0 },
        { method: PaymentMethod.QRIS, amountPaid: qrisPortion, qrisReference: 'QRIS-SPLIT-9900' },
      ],
    }),
  });
  const checkoutData = await checkoutRes.json();
  if (checkoutRes.status !== 201) throw new Error(`Gagal split payment: ${JSON.stringify(checkoutData)}`);
  console.log(`   ✅ Checkout Sukses: Faktur #${checkoutData.data.invoiceNumber}`);
  console.log(`      * Rincian Pembayaran: ${checkoutData.data.payments.length} metode (CASH: Rp ${cashPortion.toLocaleString('id-ID')}, QRIS: Rp ${qrisPortion.toLocaleString('id-ID')})`);

  // Hapus hold order yang telah ditransaksikan
  const delHold = await fetch(`${BASE_URL}/api/orders/hold/${holdId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const delHoldData = await delHold.json();
  console.log(`   ✅ Hapus / Pulihkan Antrean: ${delHoldData.message}`);

  // 7. Cek X-Report Shift Kasir
  console.log('\n7️⃣ Memeriksa Akumulasi Saldo X-Report Shift Berjalan...');
  const xRepRes = await fetch(`${BASE_URL}/api/shifts/x-report`, {
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  const xRepData = await xRepRes.json();
  console.log(`   ✅ Slip X-Report Dihasilkan:`);
  console.log(`      - Modal Awal      : Rp ${Number(xRepData.data.cashDrawer.startingCash).toLocaleString('id-ID')}`);
  console.log(`      - Total Transaksi : ${xRepData.data.transactionSummary.totalOrders} transaksi`);
  console.log(`      - Penjualan Tunai : Rp ${Number(xRepData.data.paymentSummary.cashSales).toLocaleString('id-ID')}`);
  console.log(`      - Penjualan QRIS  : Rp ${Number(xRepData.data.paymentSummary.qrisSales).toLocaleString('id-ID')}`);
  console.log(`      - Estimasi di Laci: Rp ${Number(xRepData.data.cashDrawer.expectedCashInDrawer).toLocaleString('id-ID')}`);

  // 8. Pembersihan Data Dummy Pengujian
  console.log('\n8️⃣ Membersihkan Data Dummy Pengujian...');
  await prisma.holdOrder.deleteMany({ where: { outletId } });
  await prisma.payment.deleteMany({ where: { order: { tenantId } } });
  await prisma.orderItem.deleteMany({ where: { order: { tenantId } } });
  await prisma.order.deleteMany({ where: { tenantId } });
  await prisma.shift.deleteMany({ where: { outletId } });
  await prisma.stockMovement.deleteMany({ where: { outletId } });
  await prisma.outletProduct.deleteMany({ where: { outletId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.category.deleteMany({ where: { tenantId } });
  await prisma.tenantSubscription.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.outlet.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  console.log('   🧹 Seluruh data uji tenant berhasil dibersihkan rapi.');

  console.log('\n===================================================================');
  console.log('🎉 SELURUH VERIFIKASI FASE 3 E2E SUKSES LENGKAP 100%!');
  console.log('===================================================================\n');
}

verifyPhase3()
  .catch((e) => {
    console.error('❌ Verifikasi Fase 3 Gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
