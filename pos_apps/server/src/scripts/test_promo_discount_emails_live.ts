import 'dotenv/config';
import { sendWelcomeAndReceiptEmail, sendTokenTopUpInvoiceEmail } from '../services/mail.service';

/**
 * Script Uji Coba Pengiriman Email Bukti Bayar dengan Potongan Diskon Promo:
 * 1. Email Pendaftaran dengan Diskon Promo (Diskon Parsial)
 * 2. Email Top-Up Token Kuota dengan Diskon Promo (Diskon Parsial)
 * 3. Email Pendaftaran dengan Promo Bebas Biaya (Diskon 100% / Rp 0)
 */
async function main() {
  const targetEmail = 'dendyoioi@gmail.com';
  console.log(`[TestPromoDiscount] Memulai pengujian pengiriman email promo ke ${targetEmail}...`);

  // 1. Email Pendaftaran dengan Diskon Promo Parsial (misal promo diskon Rp 50.000)
  console.log('\n--- 1. Mengirimkan Email Registrasi dengan Potongan Diskon Promo ---');
  const regDiscountResult = await sendWelcomeAndReceiptEmail(targetEmail, {
    ownerName: 'Dendy Aditya',
    companyName: 'Kopi Sejahtera Nusantara',
    companyId: 'DND-4829001',
    email: targetEmail,
    invoiceNumber: 'INV-REG-20261013-DISC',
    amount: 49000,
    originalAmount: 99000,
    discountAmount: 50000,
    promoCode: 'WELLPROMO50',
    bonusTokens: 250,
    paymentMethod: 'QRIS',
    paidAt: new Date(),
  });
  console.log('Hasil Kirim Email Registrasi Promo:', regDiscountResult);

  // 2. Email Top-Up Token dengan Diskon Promo Parsial (Paket Pro 1.500 - Diskon Rp 30.000)
  console.log('\n--- 2. Mengirimkan Email Top-Up Token dengan Potongan Diskon Promo ---');
  const topUpDiscountResult = await sendTokenTopUpInvoiceEmail(targetEmail, {
    ownerName: 'Dendy Aditya',
    companyName: 'Kopi Sejahtera Nusantara',
    companyId: 'DND-4829001',
    email: targetEmail,
    invoiceNumber: 'INV-TOKEN-20261013-DISC',
    packageName: 'Pro 1.500 (+1.500 Token Pesanan)',
    tokenAmount: 1500,
    amount: 60000,
    originalAmount: 90000,
    discountAmount: 30000,
    promoCode: 'HEMAT30K',
    paymentMethod: 'QRIS',
    paidAt: new Date(),
  });
  console.log('Hasil Kirim Email Top-Up Promo:', topUpDiscountResult);

  // 3. Email Pendaftaran dengan Promo 100% (Rp 0 / Bebas Biaya Promo)
  console.log('\n--- 3. Mengirimkan Email Registrasi dengan Promo 100% Bebas Biaya ---');
  const regFreeResult = await sendWelcomeAndReceiptEmail(targetEmail, {
    ownerName: 'Dendy Aditya',
    companyName: 'Kopi Sejahtera Nusantara',
    companyId: 'DND-4829001',
    email: targetEmail,
    invoiceNumber: 'INV-REG-20261013-FREE',
    amount: 0,
    originalAmount: 99000,
    discountAmount: 99000,
    promoCode: 'GRATIS100',
    bonusTokens: 100,
    paymentMethod: 'QRIS',
    paidAt: new Date(),
  });
  console.log('Hasil Kirim Email Registrasi 100% Free Promo:', regFreeResult);

  console.log('\n[TestPromoDiscount] Selesai! Seluruh email promo telah diproses via Resend API.');
}

main().catch((err) => {
  console.error('[TestPromoDiscount] Error:', err);
  process.exit(1);
});
