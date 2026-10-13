import { validateBusinessEmail, isDisposableEmail } from '../utils/disposableEmailValidator';
import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';

async function runTest() {
  console.log('🧪 [Test E2E] Memulai Pengujian Validasi Anti-Dummy Email & Verifikasi OTP...\n');

  // Test 1: Deteksi Email Dummy / Disposable
  console.log('1. Menguji Validasi Domain Email Disposable (Anti-Dummy):');
  const dummyEmails = [
    'user@mailinator.com',
    'bot@tempmail.com',
    'test@10minutemail.com',
    'spammer@guerrillamail.com',
    'faker@yopmail.com',
    'anon@sharklasers.com',
  ];

  for (const email of dummyEmails) {
    const isDisposable = isDisposableEmail(email);
    const validation = validateBusinessEmail(email);
    if (!isDisposable || validation.isValid) {
      throw new Error(`FAIL: ${email} seharusnya terdeteksi sebagai disposable!`);
    }
    console.log(`   ✓ ${email} -> Berhasil diblokir: "${validation.message}"`);
  }

  // Test 2: Email Resmi yang Valid
  console.log('\n2. Menguji Email Bisnis Sah:');
  const validEmails = [
    'owner@tokomaju.com',
    'dendy@gmail.com',
    'info@kedai-kopi.co.id',
  ];

  for (const email of validEmails) {
    const validation = validateBusinessEmail(email);
    if (!validation.isValid) {
      throw new Error(`FAIL: ${email} seharusnya valid! Error: ${validation.message}`);
    }
    console.log(`   ✓ ${email} -> Diterima (cleanEmail: ${validation.cleanEmail})`);
  }

  // Test 3: Simulasi Siklus OTP Database (Create -> Wrong OTP -> Correct OTP)
  console.log('\n3. Menguji Siklus OTP EmailVerification di Database:');
  const testEmail = `test.owner.${Date.now()}@wellpos-test.com`;
  const rawOtp = '728194';
  const otpHash = await bcrypt.hash(rawOtp, 8);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const verification = await prisma.emailVerification.create({
    data: {
      email: testEmail,
      otpHash,
      expiresAt,
      isVerified: false,
      attempts: 0,
    },
  });
  console.log(`   ✓ Record OTP dibuat di DB: ID=${verification.id}, Email=${verification.email}`);

  // Cek OTP Salah
  const isMatchWrong = await bcrypt.compare('111111', verification.otpHash);
  if (isMatchWrong) throw new Error('FAIL: OTP salah terverifikasi!');
  console.log('   ✓ Percobaan OTP salah (111111) berhasil ditolak.');

  // Cek OTP Benar
  const isMatchRight = await bcrypt.compare(rawOtp, verification.otpHash);
  if (!isMatchRight) throw new Error('FAIL: OTP benar tidak cocok!');
  console.log('   ✓ Percobaan OTP benar (728194) berhasil dicocokkan.');

  // Update Status Verified
  const updated = await prisma.emailVerification.update({
    where: { id: verification.id },
    data: { isVerified: true, verifiedAt: new Date() },
  });
  console.log(`   ✓ Status email berhasil diubah: isVerified=${updated.isVerified}`);

  // Cleanup test record
  await prisma.emailVerification.delete({ where: { id: verification.id } });
  console.log('   ✓ Data pengujian DB berhasil dibersihkan.');

  console.log('\n🎉 SELURUH PENGUJIAN ANTI-DUMMY & OTP EMAIL BERHASIL 100%!');
}

runTest()
  .catch((err) => {
    console.error('❌ Test Gagal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
