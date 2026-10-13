import { sendPlatformBroadcastEmail } from '../services/mail.service';
import { prisma } from '../config/prisma';

async function runTest() {
  console.log('=== [E2E TEST] PENGUJIAN MODUL 3: SUPERADMIN PLATFORM BROADCAST VIA RESEND ===\n');

  // 1. Menguji Siaran Email Tipe MAINTENANCE
  console.log('1. Mengirim email broadcast MAINTENANCE ke dendyoioi@gmail.com...');
  const maintenanceResult = await sendPlatformBroadcastEmail('dendyoioi@gmail.com', {
    recipientName: 'Dendy Aditya (Owner)',
    companyName: 'Well POS Partner Store',
    title: 'Pemeliharaan Server Database Terjadwal',
    message: 'Halo Mitra Well POS,\n\nKami menginformasikan bahwa akan dilakukan peningkatan kapasitas infrastruktur server database utama pada:\n\nHari: Minggu, 18 Oktober 2026\nWaktu: Pukul 01:00 - 03:00 WIB\nEstimasi Downtime: Maksimal 15 Menit\n\nSelama rentang waktu tersebut, transaksi kasir di perangkat kasir POS tetap dapat berjalan normal menggunakan mode Offline Sync dan akan otomatis tersinkronisasi kembali saat server selesai ditingkatkan.',
    type: 'MAINTENANCE',
    expiresAt: '2026-10-18T05:00:00.000Z',
    actionUrl: 'https://wellpos.id/#dashboard',
  });

  console.log('Hasil pengiriman broadcast MAINTENANCE:', maintenanceResult);
  if (!maintenanceResult.success) {
    console.error('❌ GAGAL mengirim broadcast email MAINTENANCE:', maintenanceResult.message);
    process.exit(1);
  }
  console.log('✅ SUKSES: Email broadcast MAINTENANCE berhasil terkirim via Resend API!\n');

  // 2. Menguji Siaran Email Tipe UPDATE (Fitur Baru)
  console.log('2. Mengirim email broadcast UPDATE FITUR BARU ke dendyoioi@gmail.com...');
  const updateResult = await sendPlatformBroadcastEmail('dendyoioi@gmail.com', {
    recipientName: 'Dendy Aditya (Owner)',
    companyName: 'Well POS Partner Store',
    title: 'Rilis Pembaruan Sistem: Absensi Staf Mandiri & Cetak Label Rak Vektor',
    message: 'Kabar gembira! Fitur terbaru Well POS kini telah aktif di toko Anda:\n\n1. Absensi Mandiri Staf Kasir & Gudang via POS Terminal dengan PIN rahasia.\n2. Pembuat Stiker Label Barcode & Rak Vektor murni siap cetak ke printer kasir / thermal.\n3. Integrasi notifikasi email transaksional resmi dari domain wellpos.id.\n\nBuka Backoffice toko Anda sekarang untuk mulai memanfaatkan fitur ini!',
    type: 'UPDATE',
    actionUrl: 'https://wellpos.id/#dashboard',
  });

  console.log('Hasil pengiriman broadcast UPDATE:', updateResult);
  if (!updateResult.success) {
    console.error('❌ GAGAL mengirim broadcast email UPDATE:', updateResult.message);
    process.exit(1);
  }
  console.log('✅ SUKSES: Email broadcast UPDATE berhasil terkirim via Resend API!\n');

  console.log('=== SELURUH PENGUJIAN MODUL 3 BERHASIL 100% ===');
}

runTest()
  .catch((e) => {
    console.error('Error saat menjalankan test broadcast:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
