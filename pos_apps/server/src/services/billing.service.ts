import { prisma } from '../config/prisma';
import { InvoiceStatus, TenantStatus, Prisma, Role } from '@prisma/client';
import { sendWelcomeAndReceiptEmail, sendTokenTopUpInvoiceEmail } from './mail.service';

export interface CreateInvoiceDto {
  tenantId: string;
  planCode: string;
  durationMonths?: number;
}

export interface PaymentWebhookDto {
  invoiceNumber: string;
  amount: number;
  paymentChannel: string;
  transactionStatus: 'settlement' | 'capture' | 'PAID' | 'completed' | 'pending' | 'failed' | 'expire';
  signatureKey?: string;
  paymentProofUrl?: string;
}

export class BillingService {
  /**
   * Membuat SaaS Invoice baru untuk perpanjangan atau upgrade paket langganan
   */
  async createInvoice(dto: CreateInvoiceDto) {
    const { tenantId, planCode, durationMonths = 1 } = dto;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error('Bisnis / Tenant tidak ditemukan');
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { code: planCode },
    });
    if (!plan) {
      throw new Error(`Paket langganan ${planCode} tidak ditemukan`);
    }

    const priceMonthly = Number(plan.price);
    const totalAmount = new Prisma.Decimal(priceMonthly * durationMonths);

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-SAAS/${todayStr}/${randSuffix}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3); // Jatuh tempo 3 hari

    const invoice = await prisma.saaSInvoice.create({
      data: {
        invoiceNumber,
        tenantId,
        planId: plan.id,
        amount: totalAmount,
        status: InvoiceStatus.UNPAID,
        dueDate,
        paymentUrl: `https://checkout.wellpos.id/pay/${invoiceNumber}`,
      },
      include: {
        plan: true,
        tenant: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    });

    return invoice;
  }

  /**
   * Memproses Webhook Callback dari Payment Gateway (Midtrans / Xendit)
   */
  async processPaymentWebhook(dto: PaymentWebhookDto) {
    const { invoiceNumber, amount, paymentChannel, transactionStatus, paymentProofUrl } = dto;

    const invoice = await prisma.saaSInvoice.findUnique({
      where: { invoiceNumber },
      include: {
        plan: true,
        tenant: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice SaaS ${invoiceNumber} tidak ditemukan`);
    }

    // Idempotency: Jika invoice sudah PAID, kembalikan data tanpa modifikasi ulang
    if (invoice.status === InvoiceStatus.PAID) {
      return {
        alreadyProcessed: true,
        invoice,
        message: `Invoice ${invoiceNumber} sudah dibayar sebelumnya`,
      };
    }

    const isSuccess = ['settlement', 'capture', 'PAID', 'completed'].includes(transactionStatus);
    if (!isSuccess) {
      return {
        alreadyProcessed: false,
        invoice,
        message: `Status pembayaran ${transactionStatus} dicatat sebagai pending/tidak berhasil`,
      };
    }

    // Eksekusi aktivasi lisensi dalam transaksi atomik
    const txResult = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Catat SaaS Payment
      const payment = await tx.saaSPayment.create({
        data: {
          invoiceId: invoice.id,
          paymentChannel: paymentChannel || 'QRIS',
          paymentProofUrl: paymentProofUrl || null,
        },
      });

      // 2. Update Invoice menjadi PAID
      const updatedInvoice = await tx.saaSInvoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: now,
        },
        include: { plan: true },
      });

      // 3. Hitung Masa Aktif Langganan
      const existingSub = await tx.tenantSubscription.findFirst({
        where: { tenantId: invoice.tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const extensionDays = 30; // Default paket bulanan 30 hari
      let newExpiresAt: Date;

      if (existingSub && existingSub.expiresAt && existingSub.expiresAt > now) {
        // Jika masih aktif, tambahkan dari tanggal expired sebelumnya
        newExpiresAt = new Date(existingSub.expiresAt);
        newExpiresAt.setDate(newExpiresAt.getDate() + extensionDays);
      } else {
        // Jika sudah expired atau belum pernah aktif, mulai dari hari ini
        newExpiresAt = new Date(now);
        newExpiresAt.setDate(newExpiresAt.getDate() + extensionDays);
      }

      let updatedSubscription;
      if (existingSub) {
        updatedSubscription = await tx.tenantSubscription.update({
          where: { id: existingSub.id },
          data: {
            planId: invoice.planId,
            expiresAt: newExpiresAt,
            isActive: true,
          },
          include: { plan: true },
        });
      } else {
        updatedSubscription = await tx.tenantSubscription.create({
          data: {
            tenantId: invoice.tenantId,
            planId: invoice.planId,
            startedAt: now,
            expiresAt: newExpiresAt,
            isActive: true,
          },
          include: { plan: true },
        });
      }

      // 4. Update Status Tenant menjadi ACTIVE
      const updatedTenant = await tx.tenant.update({
        where: { id: invoice.tenantId },
        data: {
          status: TenantStatus.ACTIVE,
        },
      });

      return {
        alreadyProcessed: false,
        invoice: updatedInvoice,
        payment,
        subscription: updatedSubscription,
        tenant: updatedTenant,
        message: `Pembayaran sukses, lisensi paket ${invoice.plan.name} aktif sampai ${newExpiresAt.toISOString()}`,
      };
    });

    // Kirim email sambutan & bukti bayar secara asinkron jika ini adalah invoice pendaftaran
    if (!txResult.alreadyProcessed && (invoice.invoiceNumber.startsWith('INV-REG-') || invoice.invoiceNumber.startsWith('INV-SETUP-'))) {
      (async () => {
        try {
          const owner = await prisma.user.findFirst({
            where: { tenantId: invoice.tenantId, role: Role.ADMIN },
          });
          if (owner && owner.email) {
            const discAmt = Number(txResult.invoice.discountAmount || 0);
            await sendWelcomeAndReceiptEmail(owner.email, {
              ownerName: owner.name,
              companyName: txResult.tenant.name,
              companyId: txResult.tenant.slug,
              email: owner.email,
              invoiceNumber: txResult.invoice.invoiceNumber,
              amount: Number(txResult.invoice.amount),
              originalAmount: discAmt > 0 ? (Number(txResult.invoice.amount) + discAmt) : undefined,
              discountAmount: discAmt > 0 ? discAmt : undefined,
              promoCode: txResult.invoice.promoCode || undefined,
              bonusTokens: txResult.invoice.tokenAmount || 100,
              paymentMethod: txResult.payment.paymentChannel || 'Non-Tunai (QRIS)',
              paidAt: txResult.invoice.paidAt || new Date(),
            });
          }
        } catch (mailErr) {
          console.error('[Billing] Gagal mengirim email aktivasi pendaftaran berbayar:', mailErr);
        }
      })();
    }

    // Kirim bukti bayar top-up token kuota secara asinkron jika ini adalah invoice top-up token
    if (!txResult.alreadyProcessed && (invoice.invoiceNumber.startsWith('INV-TOKEN-') || (invoice.tokenAmount && invoice.tokenAmount > 0 && !invoice.invoiceNumber.startsWith('INV-REG-')))) {
      (async () => {
        try {
          const owner = await prisma.user.findFirst({
            where: { tenantId: invoice.tenantId, role: Role.ADMIN },
          });
          if (owner && owner.email) {
            const discAmt = Number(txResult.invoice.discountAmount || 0);
            await sendTokenTopUpInvoiceEmail(owner.email, {
              ownerName: owner.name,
              companyName: txResult.tenant.name,
              companyId: txResult.tenant.slug,
              email: owner.email,
              invoiceNumber: txResult.invoice.invoiceNumber,
              packageName: txResult.invoice.notes || 'Top-Up Kuota Pesanan',
              tokenAmount: txResult.invoice.tokenAmount || 0,
              amount: Number(txResult.invoice.amount),
              originalAmount: discAmt > 0 ? (Number(txResult.invoice.amount) + discAmt) : undefined,
              discountAmount: discAmt > 0 ? discAmt : undefined,
              promoCode: txResult.invoice.promoCode || undefined,
              paymentMethod: txResult.payment.paymentChannel || 'Non-Tunai (QRIS)',
              paidAt: txResult.invoice.paidAt || new Date(),
            });
          }
        } catch (mailErr) {
          console.error('[Billing] Gagal mengirim email bukti bayar top-up token:', mailErr);
        }
      })();
    }

    return txResult;
  }

  /**
   * Verifikasi Manual Pembayaran oleh Superadmin Platform
   */
  async verifyManualPayment(invoiceId: string, platformUserId: string, paymentChannel: string = 'BANK_TRANSFER_MANUAL', proofUrl?: string) {
    const invoice = await prisma.saaSInvoice.findUnique({
      where: { id: invoiceId },
      include: { plan: true, tenant: true },
    });

    if (!invoice) {
      throw new Error('Invoice tagihan SaaS tidak ditemukan');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new Error(`Invoice ${invoice.invoiceNumber} sudah berstatus PAID`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Catat payment dengan verified_by_id
      const payment = await tx.saaSPayment.create({
        data: {
          invoiceId: invoice.id,
          paymentChannel,
          paymentProofUrl: proofUrl || null,
          verifiedById: platformUserId,
        },
      });

      // Update invoice
      const updatedInvoice = await tx.saaSInvoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: now,
        },
        include: { plan: true },
      });

      // Hitung perpanjangan durasi
      const existingSub = await tx.tenantSubscription.findFirst({
        where: { tenantId: invoice.tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const extensionDays = 30;
      let newExpiresAt: Date;
      if (existingSub && existingSub.expiresAt && existingSub.expiresAt > now) {
        newExpiresAt = new Date(existingSub.expiresAt);
        newExpiresAt.setDate(newExpiresAt.getDate() + extensionDays);
      } else {
        newExpiresAt = new Date(now);
        newExpiresAt.setDate(newExpiresAt.getDate() + extensionDays);
      }

      let updatedSubscription;
      if (existingSub) {
        updatedSubscription = await tx.tenantSubscription.update({
          where: { id: existingSub.id },
          data: {
            planId: invoice.planId,
            expiresAt: newExpiresAt,
            isActive: true,
          },
          include: { plan: true },
        });
      } else {
        updatedSubscription = await tx.tenantSubscription.create({
          data: {
            tenantId: invoice.tenantId,
            planId: invoice.planId,
            startedAt: now,
            expiresAt: newExpiresAt,
            isActive: true,
          },
          include: { plan: true },
        });
      }

      // Update status tenant
      const updatedTenant = await tx.tenant.update({
        where: { id: invoice.tenantId },
        data: {
          status: TenantStatus.ACTIVE,
        },
      });

      return {
        invoice: updatedInvoice,
        payment,
        subscription: updatedSubscription,
        tenant: updatedTenant,
      };
    });

    // Kirim email sambutan & bukti bayar secara asinkron jika invoice pendaftaran
    if (result.invoice.invoiceNumber.startsWith('INV-REG-') || result.invoice.invoiceNumber.startsWith('INV-SETUP-')) {
      (async () => {
        try {
          const owner = await prisma.user.findFirst({
            where: { tenantId: result.invoice.tenantId, role: Role.ADMIN },
          });
          if (owner && owner.email) {
            const discAmt = Number(result.invoice.discountAmount || 0);
            await sendWelcomeAndReceiptEmail(owner.email, {
              ownerName: owner.name,
              companyName: result.tenant.name,
              companyId: result.tenant.slug,
              email: owner.email,
              invoiceNumber: result.invoice.invoiceNumber,
              amount: Number(result.invoice.amount),
              originalAmount: discAmt > 0 ? (Number(result.invoice.amount) + discAmt) : undefined,
              discountAmount: discAmt > 0 ? discAmt : undefined,
              promoCode: result.invoice.promoCode || undefined,
              bonusTokens: result.invoice.tokenAmount || 100,
              paymentMethod: paymentChannel || 'Non-Tunai (QRIS)',
              paidAt: result.invoice.paidAt || new Date(),
            });
          }
        } catch (mailErr) {
          console.error('[Billing] Gagal mengirim email aktivasi pendaftaran manual:', mailErr);
        }
      })();
    }

    // Kirim bukti bayar top-up token kuota secara asinkron jika invoice top-up token
    if (result.invoice.invoiceNumber.startsWith('INV-TOKEN-') || (result.invoice.tokenAmount && result.invoice.tokenAmount > 0 && !result.invoice.invoiceNumber.startsWith('INV-REG-'))) {
      (async () => {
        try {
          const owner = await prisma.user.findFirst({
            where: { tenantId: result.invoice.tenantId, role: Role.ADMIN },
          });
          if (owner && owner.email) {
            const discAmt = Number(result.invoice.discountAmount || 0);
            await sendTokenTopUpInvoiceEmail(owner.email, {
              ownerName: owner.name,
              companyName: result.tenant.name,
              companyId: result.tenant.slug,
              email: owner.email,
              invoiceNumber: result.invoice.invoiceNumber,
              packageName: result.invoice.notes || 'Top-Up Kuota Pesanan',
              tokenAmount: result.invoice.tokenAmount || 0,
              amount: Number(result.invoice.amount),
              originalAmount: discAmt > 0 ? (Number(result.invoice.amount) + discAmt) : undefined,
              discountAmount: discAmt > 0 ? discAmt : undefined,
              promoCode: result.invoice.promoCode || undefined,
              paymentMethod: paymentChannel || 'Non-Tunai (QRIS)',
              paidAt: result.invoice.paidAt || new Date(),
            });
          }
        } catch (mailErr) {
          console.error('[Billing] Gagal mengirim email bukti bayar top-up token manual:', mailErr);
        }
      })();
    }

    return result;
  }

  /**
   * Mengambil riwayat invoice milik tenant
   */
  async getTenantInvoices(tenantId: string) {
    return await prisma.saaSInvoice.findMany({
      where: { tenantId },
      include: {
        plan: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            phone: true,
            users: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                role: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Mengambil seluruh invoice SaaS untuk dashboard Superadmin
   */
  async getAllPlatformInvoices(filter?: { status?: InvoiceStatus; search?: string }) {
    const where: Prisma.SaaSInvoiceWhereInput = {};

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.search) {
      where.OR = [
        { invoiceNumber: { contains: filter.search, mode: 'insensitive' } },
        { tenant: { name: { contains: filter.search, mode: 'insensitive' } } },
      ];
    }

    return await prisma.saaSInvoice.findMany({
      where,
      include: {
        plan: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            phone: true,
            users: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                role: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        payments: {
          include: {
            verifiedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const billingService = new BillingService();
