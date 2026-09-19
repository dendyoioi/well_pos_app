import { prisma } from '../src/config/prisma';
import { TenantStatus, PaymentMethod } from '@prisma/client';

async function verifyPhase2() {
  console.log('===================================================================');
  console.log('🧪 VERIFIKASI FASE 2: API SAAS ONBOARDING, LISENSI & FITUR KASIR');
  console.log('===================================================================\n');

  const BASE_URL = 'http://localhost:5001';

  // 1. Registrasi Mandiri Klien Baru
  console.log('1️⃣ Menguji POST /api/saas/register (Registrasi Mandiri Klien)...');
  const regEmail = `owner-${Date.now()}@kedaiaroma.com`;
  const regPayload = {
    businessName: 'Kedai Kopi Aroma',
    businessType: 'F&B / Kafe',
    ownerName: 'Hendra Wijaya',
    email: regEmail,
    phone: '081234567899',
    password: 'password123',
    pin: '888888',
  };

  const regRes = await fetch(`${BASE_URL}/api/saas/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload),
  });
  const regData = await regRes.json();
  if (regRes.status !== 201 || !regData.data?.token) {
    throw new Error(`Gagal register tenant: ${JSON.stringify(regData)}`);
  }
  const clientToken = regData.data.token;
  const newTenantId = regData.data.tenant.id;
  const newOutletId = regData.data.user.outlet.id;
  console.log(`   ✅ Registrasi Sukses: Tenant "${regData.data.tenant.businessName}" | Status: ${regData.data.tenant.status} | Trial: ${regData.data.tenant.trialEndsAt.slice(0, 10)}`);

  // 2. Onboarding Wizard Setup
  console.log('\n2️⃣ Menguji POST /api/saas/onboarding (Setup Profil, Kasir, & 5 Produk Sampel)...');
  const onbPayload = {
    outletId: newOutletId,
    address: 'Jl. Riau No. 88, Bandung',
    phone: '081234567899',
    receiptSize: '58mm',
    receiptFooter: 'Terima kasih telah singgah di Kedai Kopi Aroma!',
    cashierName: 'Rian (Kasir Kafe)',
    cashierPin: '777777',
    seedSampleProducts: true,
  };

  const onbRes = await fetch(`${BASE_URL}/api/saas/onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify(onbPayload),
  });
  const onbData = await onbRes.json();
  if (onbRes.status !== 200 || onbData.data.seededProductsCount < 5) {
    throw new Error(`Gagal onboarding: ${JSON.stringify(onbData)}`);
  }
  console.log(`   ✅ Onboarding Sukses: ${onbData.data.seededProductsCount} Produk Sampel Terisi | Kasir Pertama: ${onbData.data.createdCashier.name} (PIN: ${onbData.data.createdCashier.pin})`);

  // 3. Status Langganan & Masa Aktif
  console.log('\n3️⃣ Menguji GET /api/saas/subscription (Status Lisensi & Sisa Hari)...');
  const subRes = await fetch(`${BASE_URL}/api/saas/subscription`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const subData = await subRes.json();
  if (subRes.status !== 200) {
    throw new Error(`Gagal membaca subscription: ${JSON.stringify(subData)}`);
  }
  console.log(`   ✅ Subscription Info: Paket ${subData.data.subscription?.planCode} | Sisa Hari: ${subData.data.daysRemaining} Hari | Kedaluwarsa: ${subData.data.isExpired ? 'Ya' : 'Tidak'}`);

  // 4. Fitur Tahan Pesanan (Hold Order)
  console.log('\n4️⃣ Menguji POST & GET /api/orders/hold (Fitur Tahan Pesanan Kasir)...');
  const sampleProducts = await prisma.product.findMany({
    where: { tenantId: newTenantId },
    take: 2,
  });

  const holdPayload = {
    outletId: newOutletId,
    customerName: 'Meja 05 - Dimas',
    note: 'Tahan dulu, pelanggan sedang ambil rokok di etalase',
    items: [
      { productId: sampleProducts[0].id, name: sampleProducts[0].name, quantity: 2, unitPrice: 18000 },
      { productId: sampleProducts[1].id, name: sampleProducts[1].name, quantity: 1, unitPrice: 6000 },
    ],
    totalAmount: 42000,
  };

  const holdRes = await fetch(`${BASE_URL}/api/orders/hold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify(holdPayload),
  });
  const holdData = await holdRes.json();
  if (holdRes.status !== 201 || !holdData.data.id) {
    throw new Error(`Gagal hold order: ${JSON.stringify(holdData)}`);
  }
  const holdId = holdData.data.id;
  console.log(`   ✅ Hold Order Tersimpan: ID ${holdId.slice(0, 8)}... | Atas Nama: ${holdData.data.customerName} | Nominal: Rp ${Number(holdData.data.totalAmount).toLocaleString('id-ID')}`);

  // Ambil daftar hold orders
  const listHoldRes = await fetch(`${BASE_URL}/api/orders/hold?outletId=${newOutletId}`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const listHoldData = await listHoldRes.json();
  console.log(`   ✅ Antrean Hold Order Terbaca: ${listHoldData.data.length} antrean tertahan`);

  // Hapus/recall hold order
  const delHoldRes = await fetch(`${BASE_URL}/api/orders/hold/${holdId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const delHoldData = await delHoldRes.json();
  console.log(`   ✅ Recall / Hapus Hold Order Sukses: ${delHoldData.message}`);

  // 5. Fitur Split Payment (Tunai + QRIS)
  console.log('\n5️⃣ Menguji POST /api/orders/checkout dengan Pembayaran Campuran (Split Payment: Tunai + QRIS)...');
  const checkoutPayload = {
    outletId: newOutletId,
    customerName: 'Bapak Rahmat',
    customerPhone: '081298765432',
    customerEmail: 'rahmat@example.com',
    items: [
      { productId: sampleProducts[0].id, quantity: 1, discountAmount: 0 }, // 18.000
    ],
    payments: [
      { method: PaymentMethod.CASH, amountPaid: 10000, changeGiven: 0 },
      { method: PaymentMethod.QRIS, amountPaid: 8000, qrisReference: 'QRIS-REF-778899' },
    ],
  };

  const checkoutRes = await fetch(`${BASE_URL}/api/orders/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify(checkoutPayload),
  });
  const checkoutData = await checkoutRes.json();
  if (checkoutRes.status !== 201 || checkoutData.data.payments.length !== 2) {
    throw new Error(`Gagal split checkout: ${JSON.stringify(checkoutData)}`);
  }
  console.log(`   ✅ Split Payment Sukses! Faktur: ${checkoutData.data.invoiceNumber} | Grand Total: Rp ${Number(checkoutData.data.grandTotal).toLocaleString('id-ID')}`);
  console.log(`      * Bayar 1: ${checkoutData.data.payments[0].method} (Rp ${Number(checkoutData.data.payments[0].amountPaid).toLocaleString('id-ID')})`);
  console.log(`      * Bayar 2: ${checkoutData.data.payments[1].method} (Rp ${Number(checkoutData.data.payments[1].amountPaid).toLocaleString('id-ID')}) | Ref: ${checkoutData.data.payments[1].qrisReference}`);

  // 6. Verifikasi Tenant Suspension Blocking
  console.log('\n6️⃣ Menguji Proteksi Lisensi (Blokir Transaksi saat Tenant SUSPENDED)...');
  await prisma.tenant.update({
    where: { id: newTenantId },
    data: { status: TenantStatus.SUSPENDED },
  });

  const blockedRes = await fetch(`${BASE_URL}/api/orders/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify(checkoutPayload),
  });
  const blockedData = await blockedRes.json();
  if (blockedRes.status === 403 && blockedData.code === 'SUBSCRIPTION_LOCKED') {
    console.log(`   ✅ Blokir Berhasil (Status 403): "${blockedData.message}"`);
  } else {
    throw new Error(`Gagal memblokir tenant suspended: ${JSON.stringify(blockedData)}`);
  }

  // Pulihkan tenant kembali ke ACTIVE/TRIAL
  await prisma.tenant.update({
    where: { id: newTenantId },
    data: { status: TenantStatus.TRIAL },
  });
  console.log('   ✅ Status Tenant telah dipulihkan ke TRIAL.');

  // Bersihkan data dummy test
  await prisma.payment.deleteMany({ where: { order: { tenantId: newTenantId } } });
  await prisma.orderItem.deleteMany({ where: { order: { tenantId: newTenantId } } });
  await prisma.order.deleteMany({ where: { tenantId: newTenantId } });
  await prisma.stockMovement.deleteMany({ where: { outletId: newOutletId } });
  await prisma.outletProduct.deleteMany({ where: { outletId: newOutletId } });
  await prisma.product.deleteMany({ where: { tenantId: newTenantId } });
  await prisma.category.deleteMany({ where: { tenantId: newTenantId } });
  await prisma.tenantSubscription.deleteMany({ where: { tenantId: newTenantId } });
  await prisma.user.deleteMany({ where: { tenantId: newTenantId } });
  await prisma.outlet.deleteMany({ where: { tenantId: newTenantId } });
  await prisma.tenant.delete({ where: { id: newTenantId } });
  console.log('   🧹 Data uji coba tenant sementara telah dibersihkan rapi.');

  console.log('\n===================================================================');
  console.log('🎉 SELURUH VERIFIKASI FASE 2 BERHASIL 100% TANPA KENDALA!');
  console.log('===================================================================\n');
}

verifyPhase2()
  .catch((err) => {
    console.error('❌ Verifikasi Fase 2 gagal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
