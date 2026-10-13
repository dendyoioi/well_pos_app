import { sendTokenTopUpInvoiceEmail } from '../services/mail.service';
import { prisma } from '../config/prisma';
import { BillingService } from '../services/billing.service';
import { InvoiceStatus, Role } from '@prisma/client';

async function runTest() {
  console.log('=== [E2E TEST] PENGUJIAN MODUL 2: FAKTUR TOP-UP TOKEN KUOTA VIA RESEND ===\n');

  // 1. Uji Pengiriman Email Langsung via Resend API
  console.log('1. Mengirim email faktur top-up token simulasi ke dendyoioi@gmail.com via billing@wellpos.id...');
  const directMailResult = await sendTokenTopUpInvoiceEmail('dendyoioi@gmail.com', {
    ownerName: 'Dendy Aditya',
    companyId: 'warung-kopi-nusantara',
    email: 'dendyoioi@gmail.com',
    invoiceNumber: `INV-TOKEN-${Date.now().toString().slice(-6)}`,
    packageName: 'Paket Usaha Menengah (+2.500 Kuota Transaksi)',
    tokenAmount: 2500,
    amount: 150000,
    paymentMethod: 'QRIS (Pakasir Direct Settlement)',
    paidAt: new Date(),
  });

  console.log('Hasil pengiriman email langsung:', directMailResult);
  if (!directMailResult.success) {
    console.error('❌ GAGAL mengirim email faktur top-up token:', directMailResult.message);
    process.exit(1);
  }
  console.log('✅ SUKSES: Email faktur top-up token berhasil terkirim via Resend API!\n');

  // 2. Uji Integrasi Database & Webhook Billing Service
  console.log('2. Menguji integrasi BillingService.processPaymentWebhook untuk invoice token...');
  const billingService = new BillingService();

  // Cari tenant yang sudah ada
  const tenant = await prisma.tenant.findFirst({
    include: {
      users: { where: { role: Role.ADMIN } },
    },
  });

  if (!tenant) {
    console.error('❌ Tidak ada tenant di database lokal.');
    process.exit(1);
  }


  // Cari subscription plan default
  const plan = await prisma.subscriptionPlan.findFirst();
  if (!plan) {
    console.log('Subscription plan tidak ditemukan, lewati pengujian webhook invoice DB.');
    return;
  }

  const testInvoiceNumber = `INV-TOKEN-${Date.now().toString().slice(-6)}`;
  console.log(`Membuat invoice dummy: ${testInvoiceNumber} untuk tenant: ${tenant.name}...`);

  const createdInvoice = await prisma.saaSInvoice.create({
    data: {
      invoiceNumber: testInvoiceNumber,
      tenantId: tenant.id,
      planId: plan.id,
      amount: 50000,
      tokenAmount: 1000,
      notes: 'Top-Up Kuota +1.000 Token Pesanan',
      status: InvoiceStatus.UNPAID,
      dueDate: new Date(Date.now() + 86400000),
    },
  });

  console.log('Mensimulasikan webhook pembayaran sukses dari Pakasir...');
  const webhookResult = await billingService.processPaymentWebhook({
    invoiceNumber: testInvoiceNumber,
    amount: 50000,
    paymentChannel: 'QRIS_PAKASIR',
    transactionStatus: 'completed',
  });

  console.log('Status invoice setelah webhook:', webhookResult.invoice.status);
  if (webhookResult.invoice.status !== InvoiceStatus.PAID) {
    console.error('❌ Status invoice tidak berubah menjadi PAID!');
    process.exit(1);
  }

  // Bersihkan invoice dummy testing
  await prisma.saaSPayment.deleteMany({ where: { invoiceId: createdInvoice.id } });
  await prisma.saaSInvoice.delete({ where: { id: createdInvoice.id } });
  console.log('✅ Pembersihan data invoice testing selesai.');

  console.log('\n=== SELURUH PENGUJIAN MODUL 2 BERHASIL 100% ===');
}

runTest()
  .catch((e) => {
    console.error('Error saat menjalankan test:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
