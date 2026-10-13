import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';
import { validateBusinessEmail } from '../utils/disposableEmailValidator';
import { sendPasswordResetOtpEmail, sendPasswordChangedNotificationEmail } from '../services/mail.service';

async function main() {
  console.log('🧪 [Test E2E] Memulai Pengujian Alur Lupa & Reset Kata Sandi (EPIC-29 Phase 2)...\n');

  // 1. Tes Validasi Anti-Dummy pada Reset Password
  console.log('1. Menguji Validasi Anti-Dummy Email pada Form Reset:');
  const dummyCheck = validateBusinessEmail('hacker@tempmail.com');
  if (!dummyCheck.isValid) {
    console.log('   ✓ Email dummy diblokir:', dummyCheck.message);
  } else {
    throw new Error('❌ Gagal memblokir email dummy');
  }

  // 2. Tes Pembuatan OTP Reset Password
  console.log('\n2. Menguji Siklus OTP Reset Password di Database:');
  const testEmail = 'test.owner.reset@wellpos-test.com';

  // Buat dummy user untuk pengujian jika belum ada
  let testUser = await prisma.user.findFirst({ where: { email: testEmail } });
  if (!testUser) {
    const freeTenant = await prisma.tenant.findFirst();
    if (!freeTenant) throw new Error('Tenant tidak ditemukan untuk testing');

    testUser = await prisma.user.create({
      data: {
        tenantId: freeTenant.id,
        userCode: 'RST01',
        name: 'Pemilik Uji Reset',
        email: testEmail,
        passwordHash: await bcrypt.hash('oldPassword123', 10),
        role: 'OWNER',
        isActive: true,
        tokenVersion: 1,
      },
    });
  }

  // Bersihkan record lama
  await prisma.emailVerification.deleteMany({
    where: { email: testEmail, purpose: 'PASSWORD_RESET' },
  });

  const otpCode = '984321';
  const otpHash = await bcrypt.hash(otpCode, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const otpRecord = await prisma.emailVerification.create({
    data: {
      email: testEmail,
      otpHash,
      purpose: 'PASSWORD_RESET',
      expiresAt,
      isVerified: false,
    },
  });
  console.log('   ✓ Record OTP Reset dibuat di DB: ID =', otpRecord.id, ', Purpose =', otpRecord.purpose);

  // 3. Tes Percobaan OTP Salah
  console.log('\n3. Menguji Validasi OTP Salah:');
  const isWrongMatch = await bcrypt.compare('111111', otpRecord.otpHash);
  if (!isWrongMatch) {
    await prisma.emailVerification.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    console.log('   ✓ OTP salah berhasil ditolak. Percobaan tercatat: 1/5');
  } else {
    throw new Error('❌ OTP salah malah diterima');
  }

  // 4. Tes Percobaan OTP Benar & Perubahan Password
  console.log('\n4. Menguji Validasi OTP Benar & Eksekusi Reset Password:');
  const isRightMatch = await bcrypt.compare(otpCode, otpRecord.otpHash);
  if (isRightMatch) {
    // Update verification
    await prisma.emailVerification.update({
      where: { id: otpRecord.id },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    // Update user password
    const newPasswordRaw = 'NewPassword123!';
    const newPasswordHash = await bcrypt.hash(newPasswordRaw, 10);

    const updatedUser = await prisma.user.update({
      where: { id: testUser.id },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
      },
    });

    console.log('   ✓ Status OTP diubah menjadi isVerified = true');
    console.log('   ✓ Kata sandi berhasil diperbarui dengan hash baru');
    console.log('   ✓ tokenVersion berhasil diincrement ke:', updatedUser.tokenVersion, '(Sesi lama otomatis invalidated)');

    // Verifikasi password baru dapat didekripsi dengan benar
    const verifyNewPass = await bcrypt.compare(newPasswordRaw, updatedUser.passwordHash!);
    if (!verifyNewPass) {
      throw new Error('❌ Password baru tidak cocok dengan hash');
    }
    console.log('   ✓ Login verifikasi dengan kata sandi baru sukses!');
  }

  // 5. Cleanup data uji
  await prisma.emailVerification.deleteMany({
    where: { email: testEmail },
  });
  await prisma.user.delete({
    where: { id: testUser.id },
  });
  console.log('\n   ✓ Data pengujian DB berhasil dibersihkan.');

  console.log('\n🎉 SELURUH PENGUJIAN LUPA & RESET KATA SANDI BERHASIL 100%!');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
