import { sendWelcomeAndReceiptEmail, sendTokenTopUpInvoiceEmail } from '../services/mail.service';
import { prisma } from '../config/prisma';

async function runTest() {
  console.log('=== [LIVE TEST] PENGUJIAN EMAIL REVISI SESUAI FEEDBACK USER ===\n');

  const targetEmail = 'dendyoioi@gmail.com';
  const ownerName = 'Dendy Aditya';
  const companyName = 'Warung Kopi Nusantara'; // Nama Bisnis Resmi (tanpa strip)
  const companyId = 'DND-4829001';             // Format Alphanumeric Baku Well POS

  // 1. Uji Template 1: Pendaftaran & Pembayaran Akun Pemilik Berhasil
  console.log('1. Mengirim Template 1 (Welcome & Pendaftaran Berhasil) ke:', targetEmail);
  const welcomeResult = await sendWelcomeAndReceiptEmail(targetEmail, {
    ownerName,
    companyName,
    companyId,
    email: targetEmail,
    invoiceNumber: `INV-REG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-8891`,
    amount: 99000,
    bonusTokens: 100,
    paymentMethod: 'QRIS', // Akan dinormalisasi otomatis ke 'Non-Tunai (QRIS)'
    paidAt: new Date(),
  });
  console.log('Hasil pengiriman Template 1:', welcomeResult);

  if (!welcomeResult.success) {
    console.error('❌ GAGAL mengirim Template 1:', welcomeResult.message);
    process.exit(1);
  }
  console.log('✅ SUKSES: Template 1 terkirim dengan Company Name & Company ID Alphanumeric!\n');

  // Beri jeda 2 detik agar rate-limit Resend aman
  await new Promise((r) => setTimeout(r, 2000));

  // 2. Uji Template 2: Bukti Pembayaran Top-Up Token Kuota Pesanan
  console.log('2. Mengirim Template 2 (Top-Up Token Kuota Berhasil) ke:', targetEmail);
  const topUpResult = await sendTokenTopUpInvoiceEmail(targetEmail, {
    ownerName,
    companyName,
    companyId,
    email: targetEmail,
    invoiceNumber: `INV-TOKEN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-4412`,
    packageName: 'Pro 1.500 (+1.500 Token Pesanan)', // Nama Paket Resmi dari Katalog Platform
    tokenAmount: 1500,
    amount: 90000,
    paymentMethod: 'QRIS_PAKASIR', // Akan dinormalisasi otomatis ke 'Non-Tunai (QRIS)'
    paidAt: new Date(),
  });
  console.log('Hasil pengiriman Template 2:', topUpResult);

  if (!topUpResult.success) {
    console.error('❌ GAGAL mengirim Template 2:', topUpResult.message);
    process.exit(1);
  }
  console.log('✅ SUKSES: Template 2 terkirim dengan Nama Bisnis, Company ID Alphanumeric, Paket Resmi & Non-Tunai (QRIS)!\n');

  console.log('=== SELURUH PENGUJIAN EMAIL REVISI BERHASIL 100% ===');
}

runTest()
  .catch((e) => {
    console.error('Error pengujian:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
