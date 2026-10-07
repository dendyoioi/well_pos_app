import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5001';

async function testOfflineIdempotency() {
  console.log('🧪 Menguji Idempotensi Endpoint Checkout Transaksi Offline...');

  // 1. Ambil outlet & produk aktif dari seeder
  const outlet = await prisma.outlet.findFirst({
    where: { name: { contains: 'Kemang' } },
    include: { tenant: true },
  });

  if (!outlet) {
    console.error('❌ Outlet Kemang tidak ditemukan');
    process.exit(1);
  }

  const product = await prisma.product.findFirst({
    where: { tenantId: outlet.tenantId, isActive: true },
  });

  if (!product) {
    console.error('❌ Produk aktif tidak ditemukan');
    process.exit(1);
  }

  // 2. Login Kasir
  const loginRes = await fetch(`${API_BASE}/api/auth/pin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      outletId: outlet.id,
      pin: '123456',
    }),
  });

  const loginData = await loginRes.json();
  const token = loginData.data?.token;
  if (!token) {
    console.error('❌ Login kasir gagal:', loginData);
    process.exit(1);
  }
  console.log('✅ Kasir berhasil login, token didapatkan');

  // 3. Checkout dengan offlineReferenceId
  const offlineRefId = `TEST-OFFLINE-${Date.now()}`;
  const checkoutPayload = {
    items: [{ productId: product.id, quantity: 1 }],
    channel: 'DINE_IN',
    outletId: outlet.id,
    payment: {
      method: 'CASH',
      amountPaid: 50000,
    },
    offlineReferenceId: offlineRefId,
  };

  const firstRes = await fetch(`${API_BASE}/api/orders/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(checkoutPayload),
  });

  const firstData = await firstRes.json();
  console.log('✅ Transaksi Offline Pertama Sukses:', {
    invoice: firstData.data?.invoiceNumber,
    notes: firstData.data?.notes,
  });

  if (!firstData.data?.notes?.includes(`[OFFLINE_REF:${offlineRefId}]`)) {
    throw new Error('Penanda OFFLINE_REF tidak ditemukan di notes order');
  }

  // 4. Kirim ulang payload yang sama (Simulasi sinkronisasi ulang saat jaringan fluktuatif)
  const retryRes = await fetch(`${API_BASE}/api/orders/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(checkoutPayload),
  });

  const retryData = await retryRes.json();
  console.log('✅ Transaksi Offline Kedua (Idempotent Retry) Sukses:', {
    invoice: retryData.data?.invoiceNumber,
    message: retryData.message,
  });

  if (firstData.data?.id !== retryData.data?.id) {
    throw new Error('ID Order tidak cocok! Terjadi duplikasi order.');
  }

  console.log('🎉 UJI IDEMPOTENSI OFFLINE BERHASIL: Order tidak terduplikasi!');
  await prisma.$disconnect();
}

testOfflineIdempotency().catch((err) => {
  console.error('❌ Uji Idempotensi Gagal:', err);
  process.exit(1);
});
