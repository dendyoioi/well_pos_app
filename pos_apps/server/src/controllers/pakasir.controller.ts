import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { InvoiceStatus, TenantStatus } from '@prisma/client';
import { billingService } from '../services/billing.service';
import { pakasirService } from '../services/pakasir.service';

/**
 * Handler Webhook Notifikasi Resmi dari Pakasir (API v2)
 * @route POST /api/saas/pakasir/webhook
 */
export const handlePakasirWebhook = async (req: Request, res: Response) => {
  try {
    const incomingSecret = (req.headers['x-secret'] || req.headers['X-Secret']) as string | undefined;

    // Verifikasi Webhook Secret Pakasir
    const isValidSecret = pakasirService.verifyWebhookSecret(incomingSecret);
    if (!isValidSecret) {
      console.warn('[Pakasir Webhook] Ditolak: X-Secret tidak valid atau tidak cocok:', incomingSecret);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid Webhook Secret',
      });
    }

    const { txn_id, order_id, amount, status, is_sandbox, completed_at } = req.body;

    console.log(`[Pakasir Webhook] Diterima notifikasi pembayaran:`, {
      txn_id,
      order_id,
      amount,
      status,
      is_sandbox,
      completed_at,
    });

    if (!order_id) {
      return res.status(400).json({ status: 'error', message: 'Missing order_id' });
    }

    // Cari invoice terkait berdasarkan nomor invoice (order_id)
    const invoice = await prisma.saaSInvoice.findFirst({
      where: {
        OR: [
          { invoiceNumber: order_id },
          { invoiceNumber: order_id.replace(/\//g, '-') },
        ],
      },
      include: { tenant: true },
    });

    if (!invoice) {
      console.warn(`[Pakasir Webhook] Invoice tidak ditemukan untuk order_id: ${order_id}`);
      return res.status(404).json({ status: 'error', message: `Invoice ${order_id} not found` });
    }

    // Jika transaksi sukses (completed) di Pakasir
    if (status === 'completed') {
      // Simpan txn_id dari Pakasir jika belum tersimpan
      if (txn_id && !invoice.externalTxnId) {
        await prisma.saaSInvoice.update({
          where: { id: invoice.id },
          data: { externalTxnId: String(txn_id) },
        }).catch(() => {});
      }

      // Proses pelunasan invoice & aktivasi tenant/token
      const result = await billingService.processPaymentWebhook({
        invoiceNumber: order_id,
        amount: Number(amount) || Number(invoice.amount),
        paymentChannel: 'QRIS_PAKASIR',
        transactionStatus: 'completed',
        paymentProofUrl: txn_id ? `https://app.pakasir.com (Txn: ${txn_id})` : undefined,
      });

      console.log(`[Pakasir Webhook] Sukses memproses pembayaran invoice ${order_id}:`, result.message);

      return res.status(200).json({
        status: 'success',
        message: 'Webhook processed successfully',
        data: result,
      });
    }

    // Status lainnya (misal: pending / canceled)
    return res.status(200).json({
      status: 'success',
      message: `Status ${status} dicatat`,
    });
  } catch (error: any) {
    console.error('[Pakasir Webhook] Error saat memproses webhook:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error while processing webhook',
    });
  }
};

/**
 * Cek Status Invoice Pembayaran Pakasir (Real-Time Polling oleh Frontend)
 * @route GET /api/saas/pakasir/status/:invoiceNumber
 */
export const checkPakasirInvoiceStatus = async (req: Request, res: Response) => {
  try {
    const { invoiceNumber } = req.params;

    const invoice = await prisma.saaSInvoice.findUnique({
      where: { invoiceNumber },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({
        status: 'error',
        message: `Invoice ${invoiceNumber} tidak ditemukan`,
      });
    }

    // Jika invoice sudah PAID di database, langsung kembalikan status sukses
    if (invoice.status === InvoiceStatus.PAID) {
      return res.status(200).json({
        status: 'success',
        data: {
          invoiceNumber: invoice.invoiceNumber,
          status: 'PAID',
          paidAt: invoice.paidAt,
          tenantStatus: invoice.tenant.status,
          tokenAmount: invoice.tokenAmount,
        },
      });
    }

    // Jika masih UNPAID dan memiliki externalTxnId, sinkronisasikan status langsung ke Pakasir API
    if (invoice.externalTxnId) {
      try {
        const liveStatus = await pakasirService.checkTransactionStatus(invoice.externalTxnId);
        if (liveStatus.status === 'completed') {
          // Sinkronisasi pelunasan ke billing service
          const payResult = await billingService.processPaymentWebhook({
            invoiceNumber: invoice.invoiceNumber,
            amount: Number(invoice.amount),
            paymentChannel: 'QRIS_PAKASIR',
            transactionStatus: 'completed',
            paymentProofUrl: `https://app.pakasir.com (Txn: ${invoice.externalTxnId})`,
          });

          return res.status(200).json({
            status: 'success',
            data: {
              invoiceNumber: invoice.invoiceNumber,
              status: 'PAID',
              paidAt: payResult.invoice.paidAt,
              tenantStatus: TenantStatus.ACTIVE,
              tokenAmount: invoice.tokenAmount,
            },
          });
        }
      } catch (err) {
        // Fallback jika rate limit atau gagal menghubungi Pakasir
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        amount: Number(invoice.amount),
        tokenAmount: invoice.tokenAmount,
        qrString: invoice.qrString,
        paymentUrl: invoice.paymentUrl,
        tenantStatus: invoice.tenant.status,
      },
    });
  } catch (error: any) {
    console.error('Error saat cek status invoice Pakasir:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memeriksa status pembayaran',
    });
  }
};

/**
 * Simulasi Pembayaran Sandbox Instan (Untuk Pengujian Cepat Lokal / Sandbox Mode)
 * @route POST /api/saas/pakasir/simulate-sandbox-pay
 */
export const simulateSandboxPayment = async (req: Request, res: Response) => {
  try {
    const { invoiceNumber } = req.body;
    if (!invoiceNumber) {
      return res.status(400).json({ status: 'error', message: 'Nomor invoice wajib disertakan' });
    }

    const invoice = await prisma.saaSInvoice.findUnique({
      where: { invoiceNumber },
      include: { tenant: true },
    });

    if (!invoice) {
      return res.status(404).json({ status: 'error', message: `Invoice ${invoiceNumber} tidak ditemukan` });
    }

    if (invoice.status === InvoiceStatus.PAID) {
      return res.status(200).json({
        status: 'success',
        message: 'Invoice sudah lunas sebelumnya',
        data: { invoiceNumber, status: 'PAID' },
      });
    }

    // Eksekusi pelunasan otomatis via billingService
    const result = await billingService.processPaymentWebhook({
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      paymentChannel: 'QRIS_PAKASIR_SANDBOX',
      transactionStatus: 'completed',
      paymentProofUrl: 'https://app.pakasir.com/sandbox-simulator',
    });

    return res.status(200).json({
      status: 'success',
      message: `Simulasi pembayaran sandbox sukses! Invoice ${invoiceNumber} kini berstatus PAID dan tenant aktif.`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error simulasi sandbox payment:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menjalankan simulasi pembayaran sandbox',
    });
  }
};
