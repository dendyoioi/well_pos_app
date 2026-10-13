import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { sendVerificationOtpEmail, sendWelcomeAndReceiptEmail } from '../services/mail.service';

async function main() {
  const targetEmail = process.argv[2] || 'dendyoioi@gmail.com';
  console.log(`🚀 [TEST LIVE RESEND] Mengirim email uji coba ke: ${targetEmail}`);
  console.log(`   API Key terpasang: ${process.env.RESEND_API_KEY ? '✅ Terpasang' : '❌ Kosong'}`);

  console.log('\n--- 1. Testing OTP Verification Email (From: noreply@wellpos.id) ---');
  const otpResult = await sendVerificationOtpEmail(targetEmail, '839210', 'Dendy Aditya');
  console.log('Hasil OTP:', otpResult);

  console.log('\n--- 2. Testing Welcome & Receipt Email (From: billing@wellpos.id) ---');
  const welcomeResult = await sendWelcomeAndReceiptEmail(targetEmail, {
    ownerName: 'Dendy Aditya',
    companyId: 'dendyoioi',
    email: targetEmail,
    invoiceNumber: 'INV-WP-TEST-001',
    amount: 0,
    bonusTokens: 50,
    paymentMethod: 'FREE_TIER',
    paidAt: new Date(),
  });
  console.log('Hasil Welcome & Receipt:', welcomeResult);

  console.log('\n🎉 Selesai! Silakan periksa inbox / spam folder dari email:', targetEmail);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
