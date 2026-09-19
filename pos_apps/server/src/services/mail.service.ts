import nodemailer, { type Transporter } from 'nodemailer';

export interface OrderEmailData {
  invoiceNumber: string;
  createdAt: string | Date;
  customerName?: string | null;
  outlet: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  cashierName?: string | null;
  orderItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    subtotal: number;
    unit?: string;
  }>;
  subtotal: number;
  discountAmount: number;
  serviceCharge: number;
  taxAmount: number;
  grandTotal: number;
  payment: {
    method: string;
    amountPaid: number;
    changeGiven: number;
    qrisReference?: string | null;
  };
}

/**
 * Service: Menghasilkan Template Email HTML Struk Faktur Penjualan
 */
export const generateReceiptHtml = (order: OrderEmailData): string => {
  const dateStr = new Date(order.createdAt).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const itemsHtml = order.orderItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px dashed #e2e8f0;">
          <div style="font-weight: bold; color: #0f172a; font-size: 13px;">${item.name}</div>
          <div style="font-size: 11px; color: #64748b;">
            ${item.quantity} x Rp ${item.unitPrice.toLocaleString('id-ID')}
            ${item.discountAmount > 0 ? `<span style="color: #e11d48; margin-left: 4px;">(Disc: -Rp ${(item.discountAmount * item.quantity).toLocaleString('id-ID')})</span>` : ''}
          </div>
        </td>
        <td style="padding: 8px 0; border-bottom: 1px dashed #e2e8f0; text-align: right; font-weight: bold; color: #0f172a; font-size: 13px;">
          Rp ${item.subtotal.toLocaleString('id-ID')}
        </td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Struk Pembayaran - ${order.invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header Banner -->
    <div style="background-color: #1e3a8a; padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">${order.outlet.name}</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">${order.outlet.address || 'Menteng, Jakarta Pusat'}</p>
      <p style="margin: 2px 0 0 0; font-size: 11px; opacity: 0.8;">Telp: ${order.outlet.phone || '-'}</p>
    </div>

    <!-- Content Body -->
    <div style="padding: 24px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="display: inline-block; background-color: #ecfdf5; color: #065f46; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 9999px; border: 1px solid #a7f3d0;">
          LUNAS / BERHASIL DIBAYAR
        </span>
        <h2 style="margin: 8px 0 0 0; font-size: 16px; font-weight: 800; color: #0f172a;">${order.invoiceNumber}</h2>
        <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${dateStr} • Kasir: ${order.cashierName || 'Kasir'}</p>
        ${order.customerName ? `<p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 600; color: #1e3a8a;">Pelanggan: ${order.customerName}</p>` : ''}
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="border-bottom: 2px solid #e2e8f0; font-size: 11px; color: #64748b; text-transform: uppercase;">
            <th style="padding: 6px 0; text-align: left;">Item</th>
            <th style="padding: 6px 0; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Calculations -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 12px; line-height: 1.8;">
        <div style="display: flex; justify-content: space-between; color: #64748b;">
          <span>Subtotal:</span>
          <span style="font-weight: 600; color: #0f172a;">Rp ${order.subtotal.toLocaleString('id-ID')}</span>
        </div>
        ${
          order.discountAmount > 0
            ? `
        <div style="display: flex; justify-content: space-between; color: #e11d48;">
          <span>Diskon Transaksi:</span>
          <span style="font-weight: 600;">- Rp ${order.discountAmount.toLocaleString('id-ID')}</span>
        </div>`
            : ''
        }
        ${
          order.serviceCharge > 0
            ? `
        <div style="display: flex; justify-content: space-between; color: #64748b;">
          <span>Biaya Layanan (Service):</span>
          <span style="font-weight: 600; color: #0f172a;">+ Rp ${order.serviceCharge.toLocaleString('id-ID')}</span>
        </div>`
            : ''
        }
        ${
          order.taxAmount > 0
            ? `
        <div style="display: flex; justify-content: space-between; color: #64748b;">
          <span>PPN (11%):</span>
          <span style="font-weight: 600; color: #0f172a;">+ Rp ${order.taxAmount.toLocaleString('id-ID')}</span>
        </div>`
            : ''
        }
        <div style="border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #1e3a8a;">
          <span>TOTAL BAYAR:</span>
          <span>Rp ${order.grandTotal.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <!-- Payment Details Box -->
      <div style="margin-top: 16px; padding: 12px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b;">Metode Pembayaran:</span>
          <span style="font-weight: bold; color: #0f172a;">${order.payment.method}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <span style="color: #64748b;">Nominal Diterima:</span>
          <span style="font-weight: 600; color: #0f172a;">Rp ${order.payment.amountPaid.toLocaleString('id-ID')}</span>
        </div>
        ${
          order.payment.method === 'CASH'
            ? `
        <div style="display: flex; justify-content: space-between; margin-top: 4px; color: #065f46; font-weight: bold;">
          <span>Uang Kembalian:</span>
          <span>Rp ${order.payment.changeGiven.toLocaleString('id-ID')}</span>
        </div>`
            : ''
        }
        ${
          order.payment.qrisReference
            ? `
        <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px; color: #64748b;">
          <span>Ref QRIS:</span>
          <span>${order.payment.qrisReference}</span>
        </div>`
            : ''
        }
      </div>

      <!-- Footer Note -->
      <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 16px;">
        <p style="margin: 0;">Terima kasih atas kunjungan Anda!</p>
        <p style="margin: 4px 0 0 0;">Struk digital ini adalah bukti pembayaran yang sah.</p>
      </div>

    </div>
  </div>
</body>
</html>
`;
};

/**
 * Service: Mengirimkan Email Struk Penjualan
 */
export const sendOrderReceiptEmail = async (
  recipientEmail: string,
  orderData: OrderEmailData
): Promise<{ success: boolean; message: string; previewUrl?: string }> => {
  try {
    const htmlContent = generateReceiptHtml(orderData);

    // Cek konfigurasi SMTP di environment
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    let transporter: Transporter;
    const isPlaceholder =
      !smtpUser || smtpUser.includes('tokoanda@') || smtpPass === 'password_aplikasi';

    if (smtpHost && smtpUser && smtpPass && !isPlaceholder) {
      try {
        transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
      } catch (err) {
        console.warn('SMTP transporter gagal dibuat, menggunakan fallback Ethereal:', err);
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      }
    } else {
      // Fallback development: Buat test account otomatis menggunakan Ethereal
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await transporter.sendMail({
      from: `"${orderData.outlet.name}" <noreply@pos-system.local>`,
      to: recipientEmail,
      subject: `[STRUK] Pembayaran Faktur ${orderData.invoiceNumber} - ${orderData.outlet.name}`,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      console.log(`✉️ [MailService] Email struk terkirim! Preview URL: ${previewUrl}`);
    }

    return {
      success: true,
      message: `Struk berhasil dikirim ke ${recipientEmail}`,
      previewUrl,
    };
  } catch (error: any) {
    console.error('Error saat mengirim email struk:', error);
    throw new Error(`Gagal mengirim email struk: ${error.message}`);
  }
};
