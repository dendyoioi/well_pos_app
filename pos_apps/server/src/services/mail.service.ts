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
 * Helper internal untuk menentukan alamat pengirim resmi Well POS (3 Email Kanonikal)
 * 1. noreply@wellpos.id  -> Keamanan, OTP, Reset Password, Sistem Broadcast
 * 2. billing@wellpos.id  -> Bukti Pembayaran, Faktur Aktivasi & Top-Up Token
 * 3. helpcare@wellpos.id -> Dukungan Pelanggan, Helpdesk, Kontak Dua Arah
 */
export const getSenderAddress = (subSystem: 'Security' | 'Billing' | 'HelpCare' | 'System' = 'Security'): string => {
  if (process.env.SMTP_FROM && process.env.SMTP_FROM.trim() !== '') {
    return process.env.SMTP_FROM;
  }
  const smtpUser = process.env.SMTP_USER;
  if (smtpUser && smtpUser !== 'resend' && !smtpUser.includes('tokoanda@') && smtpUser.includes('@')) {
    return `"Well POS ${subSystem}" <${smtpUser}>`;
  }
  if (subSystem === 'Billing') {
    return `"Well POS Billing" <billing@wellpos.id>`;
  }
  if (subSystem === 'HelpCare') {
    return `"Well POS HelpCare" <helpcare@wellpos.id>`;
  }
  return `"Well POS Security" <noreply@wellpos.id>`;
};

/**
 * Helper internal untuk inisialisasi transporter Nodemailer
 */
const getMailTransporter = async (): Promise<Transporter> => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  const isPlaceholder =
    !smtpUser || smtpUser.includes('tokoanda@') || smtpPass === 'password_aplikasi';

  if (smtpHost && smtpUser && smtpPass && !isPlaceholder) {
    try {
      return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    } catch (err) {
      console.warn('[MailService] SMTP kustom gagal dibuat, menggunakan fallback Ethereal:', err);
    }
  }

  // Fallback Ethereal untuk environment dev/testing
  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch (err) {
    console.warn('[MailService] Ethereal fallback gagal, menggunakan transporter stream kosong:', err);
    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }
};

interface InternalMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Pengirim email universal: Menggunakan Resend REST API (HTTPS) dengan fallback otomatis ke Nodemailer SMTP
 */
export const sendMailInternal = async (
  options: InternalMailOptions
): Promise<{ success: boolean; message: string; previewUrl?: string }> => {
  const resendApiKey =
    process.env.RESEND_API_KEY || (process.env.SMTP_PASS?.startsWith('re_') ? process.env.SMTP_PASS : undefined);

  // 1. Prioritas: Resend REST API (HTTPS port 443 - zero firewall issue, reliable)
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          ...(options.replyTo ? { reply_to: options.replyTo } : {}),
        }),
      });

      const resData = (await response.json()) as any;
      if (response.ok && resData.id) {
        console.log(`✉️ [MailService] Resend REST API sukses terkirim ke ${options.to}! (ID: ${resData.id})`);
        return {
          success: true,
          message: `Email berhasil dikirim ke ${options.to}`,
        };
      } else {
        console.warn(`[MailService] Resend REST API mengembalikan peringatan:`, resData);
      }
    } catch (apiErr: any) {
      console.warn(`[MailService] Gagal memanggil Resend REST API (${apiErr.message}), mencoba fallback SMTP...`);
    }
  }

  // 2. Fallback: Nodemailer SMTP / Ethereal
  const transporter = await getMailTransporter();
  const info = await transporter.sendMail({
    from: options.from,
    replyTo: options.replyTo,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
  if (previewUrl) {
    console.log(`✉️ [MailService] Email terkirim via Nodemailer! Preview: ${previewUrl}`);
  }

  return {
    success: true,
    message: `Email berhasil dikirim ke ${options.to}`,
    previewUrl,
  };
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
    return await sendMailInternal({
      from: `"${orderData.outlet.name}" <noreply@wellpos.id>`,
      replyTo: 'helpcare@wellpos.id',
      to: recipientEmail,
      subject: `[STRUK] Pembayaran Faktur ${orderData.invoiceNumber} - ${orderData.outlet.name}`,
      html: htmlContent,
    });
  } catch (error: any) {
    console.error('Error saat mengirim email struk:', error);
    throw new Error(`Gagal mengirim email struk: ${error.message}`);
  }
};

/**
 * Service: Mengirimkan Kode OTP Verifikasi Email Pendaftaran
 */
export const sendVerificationOtpEmail = async (
  recipientEmail: string,
  otpCode: string,
  recipientName?: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> => {
  // Selalu catat di konsol untuk mempermudah testing developer / QA
  console.log(`\n======================================================`);
  console.log(`🔑 [OTP REGISTRASI WELL POS]`);
  console.log(`   Penerima : ${recipientEmail} ${recipientName ? `(${recipientName})` : ''}`);
  console.log(`   Kode OTP : >>> ${otpCode} <<<`);
  console.log(`   Berlaku  : 10 Menit`);
  console.log(`======================================================\n`);

  try {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kode Verifikasi Pendaftaran - Well POS</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="background-color: #1e3a8a; padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">WELL POS</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Verifikasi Email Pendaftaran Akun Pemilik</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Halo ${recipientName ? `<strong>${recipientName}</strong>` : 'Calon Pemilik Toko'},
      </p>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Terima kasih telah mendaftar di <strong>Well POS</strong>. Untuk memastikan keabsahan akun dan keamanan data Anda, silakan masukkan kode verifikasi berikut pada form pendaftaran:
      </p>

      <!-- OTP Box -->
      <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #1e40af; display: block; margin-bottom: 8px;">KODE OTP ANDA</span>
        <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; font-family: monospace;">
          ${otpCode}
        </div>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Kode berlaku selama <strong>10 menit</strong>.</p>
      </div>

      <div style="background: #f8fafc; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 12px; color: #78350f; line-height: 1.5;">
          <strong>Peringatan Keamanan:</strong> Jangan bagikan kode ini kepada siapa pun, termasuk staf Well POS. Jika Anda tidak merasa melakukan pendaftaran, abaikan email ini.
        </p>
      </div>

      <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        Salam hangat,<br>
        <strong>Tim Well POS Indonesia</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      © ${new Date().getFullYear()} Well POS. Sistem Kasir Cloud Modern & Handal.
    </div>
  </div>
</body>
</html>
`;

    return await sendMailInternal({
      from: getSenderAddress('Security'),
      replyTo: 'helpcare@wellpos.id',
      to: recipientEmail,
      subject: `[Well POS] ${otpCode} adalah Kode Verifikasi Pendaftaran Anda`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.warn(`[MailService] Pengiriman email OTP gagal dikirim (${err.message}), tetapi kode OTP tetap dicatat di konsol.`);
    return {
      success: true,
      message: `Kode OTP terbit (cek konsol server)`,
    };
  }
};

/**
 * Normalisasi label metode pembayaran agar ramah pelanggan dan seragam:
 * Seluruh transaksi online / pendaftaran / gateway dinormalisasi ke 'Non-Tunai (QRIS)'
 */
export const normalizePaymentMethodLabel = (method?: string | null): string => {
  if (!method) return 'Non-Tunai (QRIS)';
  const upper = method.toUpperCase().trim();
  if (
    upper.includes('QRIS') ||
    upper === 'FREE_TIER' ||
    upper === 'PROMO_FREE' ||
    upper === 'PROMO_GRATIS' ||
    upper === 'PAKASIR' ||
    upper === 'SETTLEMENT'
  ) {
    return 'Non-Tunai (QRIS)';
  }
  if (upper.includes('TRANSFER') || upper.includes('BANK')) {
    return 'Transfer Bank';
  }
  if (upper.includes('CASH') || upper.includes('TUNAI')) {
    return 'Tunai (Cash)';
  }
  return 'Non-Tunai (QRIS)';
};

export interface WelcomeEmailData {
  ownerName: string;
  companyName?: string;
  companyId: string;
  email: string;
  invoiceNumber: string;
  originalAmount?: number;
  discountAmount?: number;
  promoCode?: string;
  amount: number;
  bonusTokens: number;
  paymentMethod: string;
  paidAt: string | Date;
}

/**
 * Service: Mengirimkan Email Sambutan & Bukti Pembayaran Resmi Registrasi Akun
 */
export const sendWelcomeAndReceiptEmail = async (
  recipientEmail: string,
  data: WelcomeEmailData
): Promise<{ success: boolean; message: string; previewUrl?: string }> => {
  try {
    const dateStr = new Date(data.paidAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const businessName = data.companyName || 'Bisnis Anda';
    const displayPaymentMethod = normalizePaymentMethodLabel(data.paymentMethod);
    const hasDiscount = Boolean(data.discountAmount && data.discountAmount > 0);
    const subtotal = data.originalAmount || (data.amount + (data.discountAmount || 0));

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Selamat Datang di Well POS - ${data.invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="background-color: #1e3a8a; padding: 28px; text-align: center; color: #ffffff;">
      <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
        AKUN RESMI AKTIF
      </span>
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Selamat Datang di Well POS!</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Pendaftaran & Pembayaran Akun Pemilik Berhasil</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Halo <strong>${data.ownerName}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Akun bisnis Anda untuk <strong>${businessName}</strong> telah berhasil diaktifkan. Berikut adalah rincian kredensial bisnis dan bukti pembayaran faktur pendaftaran awal Anda:
      </p>

      <!-- Account Summary Card -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">Informasi Bisnis Anda</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Nama Bisnis:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${businessName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Company ID:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; font-family: monospace; color: #1e3a8a; font-size: 14px;">${data.companyId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Email Login:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a;">${data.email}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Bonus Kuota Token:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #059669;">+${data.bonusTokens.toLocaleString('id-ID')} Token</td>
          </tr>
        </table>
      </div>

      <!-- Payment Receipt Card -->
      <div style="border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 16px 0; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Nomor Faktur:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a;">${data.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Waktu Pembayaran:</td>
            <td style="padding: 4px 0; text-align: right; color: #0f172a;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Metode Pembayaran:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a;">${displayPaymentMethod}</td>
          </tr>
          ${hasDiscount ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Biaya Pendaftaran:</td>
            <td style="padding: 4px 0; text-align: right; color: #64748b; text-decoration: line-through;">
              Rp ${subtotal.toLocaleString('id-ID')}
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #059669; font-weight: 600;">
              Diskon Kupon Promo (${data.promoCode || 'VOUCHER'}):
            </td>
            <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #059669;">
              -Rp ${Number(data.discountAmount).toLocaleString('id-ID')}
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0 0 0; font-weight: 700; font-size: 15px; color: #0f172a;">Total Terbayar:</td>
            <td style="padding: 8px 0 0 0; text-align: right; font-weight: 800; font-size: 16px; color: #1e3a8a;">
              ${data.amount === 0 ? '<span style="color: #059669;">Rp 0 <span style="font-size: 12px; font-weight: 600; color: #166534;">(Bebas Biaya Promo)</span></span>' : `Rp ${data.amount.toLocaleString('id-ID')}`}
            </td>
          </tr>
        </table>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://wellpos.id/#login" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
          Buka Backoffice & Buat Toko Pertama
        </a>
      </div>

      <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
        Simpan email ini sebagai bukti pembayaran dan rincian Company ID akun Anda.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      © ${new Date().getFullYear()} Well POS. Sistem Kasir Cloud Modern & Handal.
    </div>
  </div>
</body>
</html>
`;
    return await sendMailInternal({
      from: getSenderAddress('Billing'),
      replyTo: 'billing@wellpos.id',
      to: recipientEmail,
      subject: `[Well POS] Selamat Datang! Akun ${businessName} Telah Aktif (#${data.invoiceNumber})`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error('Error saat mengirim email sambutan:', err);
    return {
      success: false,
      message: `Gagal mengirim email sambutan: ${err.message}`,
    };
  }
};

/**
 * Service: Mengirimkan Kode OTP Reset Kata Sandi Akun
 */
export const sendPasswordResetOtpEmail = async (
  recipientEmail: string,
  otpCode: string,
  recipientName?: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> => {
  console.log(`\n======================================================`);
  console.log(`🔐 [RESET PASSWORD OTP WELL POS]`);
  console.log(`   Penerima : ${recipientEmail} ${recipientName ? `(${recipientName})` : ''}`);
  console.log(`   Kode OTP : >>> ${otpCode} <<<`);
  console.log(`   Berlaku  : 10 Menit`);
  console.log(`======================================================\n`);

  try {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Kata Sandi Akun - Well POS</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">WELL POS</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; color: #94a3b8;">Permintaan Pemulihan Kata Sandi</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Halo ${recipientName ? `<strong>${recipientName}</strong>` : 'Pengguna Well POS'},
      </p>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda di <strong>Well POS</strong>. Masukkan kode verifikasi 6-digit berikut untuk melanjutkan proses reset kata sandi:
      </p>

      <!-- OTP Box -->
      <div style="background: #f1f5f9; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #0369a1; display: block; margin-bottom: 8px;">KODE VERIFIKASI RESET</span>
        <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace;">
          ${otpCode}
        </div>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Kode berlaku selama <strong>10 menit</strong>.</p>
      </div>

      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 12px; color: #78350f; line-height: 1.5;">
          <strong>Penting:</strong> Jangan berikan kode ini kepada siapapun demi keamanan toko Anda. Jika Anda tidak merasa meminta reset kata sandi, abaikan email ini dan kata sandi Anda tetap aman.
        </p>
      </div>

      <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        Salam hangat,<br>
        <strong>Tim Keamanan Well POS</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      © ${new Date().getFullYear()} Well POS. Sistem Kasir Cloud Modern & Handal.
    </div>
  </div>
</body>
</html>
`;

    return await sendMailInternal({
      from: getSenderAddress('Security'),
      replyTo: 'helpcare@wellpos.id',
      to: recipientEmail,
      subject: `[Well POS] ${otpCode} adalah Kode Reset Kata Sandi Anda`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.warn(`[MailService] Pengiriman email OTP reset password gagal (${err.message}), tetapi tercatat di konsol.`);
    return {
      success: true,
      message: `Kode OTP terbit (cek konsol server)`,
    };
  }
};

/**
 * Service: Mengirimkan Notifikasi Konfirmasi Perubahan Kata Sandi Berhasil
 */
export const sendPasswordChangedNotificationEmail = async (
  recipientEmail: string,
  recipientName?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const timeStr = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kata Sandi Diperbarui - Well POS</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="background-color: #065f46; padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">WELL POS</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Pemberitahuan Keamanan Akun</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Halo ${recipientName ? `<strong>${recipientName}</strong>` : 'Pengguna Well POS'},
      </p>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Kata sandi untuk akun Well POS Anda baru saja <strong>berhasil diperbarui</strong> pada <strong>${timeStr} WIB</strong>.
      </p>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #166534;">
        ✓ Seluruh sesi aktif di perangkat atau tablet lain telah dicabut otomatis demi melindungi data toko Anda.
      </div>

      <div style="background: #fff1f2; border-left: 4px solid #f43f5e; padding: 12px; border-radius: 4px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 12px; color: #881337; line-height: 1.5;">
          <strong>Bukan Anda yang melakukan perubahan ini?</strong> Segera hubungi Pusat Bantuan kami di <a href="mailto:helpcare@wellpos.id" style="color: #e11d48; font-weight: 700;">helpcare@wellpos.id</a> agar akun Anda segera diamankan.
        </p>
      </div>

      <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        Salam hangat,<br>
        <strong>Tim Keamanan Well POS</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      © ${new Date().getFullYear()} Well POS. Sistem Kasir Cloud Modern & Handal.
    </div>
  </div>
</body>
</html>
`;

    return await sendMailInternal({
      from: getSenderAddress('Security'),
      replyTo: 'helpcare@wellpos.id',
      to: recipientEmail,
      subject: `[Well POS] Kata Sandi Akun Anda Berhasil Diperbarui`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.warn(`[MailService] Notifikasi perubahan kata sandi gagal terkirim:`, err.message);
    return {
      success: false,
      message: err.message,
    };
  }
};

export interface TokenTopUpEmailData {
  ownerName: string;
  companyName?: string;
  companyId: string;
  email: string;
  invoiceNumber: string;
  packageName?: string;
  tokenAmount: number;
  amount: number;
  originalAmount?: number;
  discountAmount?: number;
  promoCode?: string;
  paymentMethod: string;
  paidAt: Date | string;
}

/**
 * Service: Mengirimkan Bukti Pembayaran Resmi & Faktur Top-Up Token Kuota Pesanan
 * Sender: billing@wellpos.id
 */
export const sendTokenTopUpInvoiceEmail = async (
  recipientEmail: string,
  data: TokenTopUpEmailData
): Promise<{ success: boolean; message: string; previewUrl?: string }> => {
  try {
    const dateStr = new Date(data.paidAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const businessName = data.companyName || 'Bisnis Anda';
    const displayPaymentMethod = normalizePaymentMethodLabel(data.paymentMethod);
    const hasDiscount = Boolean(data.discountAmount && data.discountAmount > 0);
    const subtotal = data.originalAmount || (data.amount + (data.discountAmount || 0));

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bukti Pembayaran Top-Up Token - ${data.invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="background-color: #1e3a8a; padding: 28px; text-align: center; color: #ffffff;">
      <span style="display: inline-block; background-color: #059669; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
        PEMBAYARAN DITERIMA & TOKEN AKTIF
      </span>
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Top-Up Token Berhasil</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Bukti Pembayaran Faktur #${data.invoiceNumber}</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Halo <strong>${data.ownerName}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Pembayaran untuk transaksi top-up token pesanan bisnis <strong>${businessName}</strong> (${data.companyId}) telah berhasil kami verifikasi. Tambahan kuota telah langsung ditambahkan ke saldo akun Anda.
      </p>

      <!-- Token Quota Summary Card -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Rincian Kuota Tambahan</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #166534;">Nama Bisnis:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #14532d;">${businessName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #166534;">Company ID:</td>
            <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: 700; color: #14532d; font-size: 14px;">${data.companyId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #166534;">Paket Kuota:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #14532d;">${data.packageName || 'Top-Up Kuota Pesanan'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #166534;">Jumlah Token:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; font-size: 16px; color: #059669;">+${data.tokenAmount.toLocaleString('id-ID')} Token</td>
          </tr>
        </table>
      </div>

      <!-- Payment Receipt Card -->
      <div style="border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 16px 0; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Nomor Faktur:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a;">${data.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Waktu Pembayaran:</td>
            <td style="padding: 4px 0; text-align: right; color: #0f172a;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Metode Pembayaran:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a;">${displayPaymentMethod}</td>
          </tr>
          ${hasDiscount ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Subtotal Paket:</td>
            <td style="padding: 4px 0; text-align: right; color: #64748b; text-decoration: line-through;">
              Rp ${subtotal.toLocaleString('id-ID')}
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #059669; font-weight: 600;">
              Diskon Kupon Promo (${data.promoCode || 'PROMO'}):
            </td>
            <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #059669;">
              -Rp ${Number(data.discountAmount).toLocaleString('id-ID')}
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0 0 0; font-weight: 700; font-size: 15px; color: #0f172a;">Total Terbayar:</td>
            <td style="padding: 8px 0 0 0; text-align: right; font-weight: 800; font-size: 16px; color: #1e3a8a;">
              ${data.amount === 0 ? '<span style="color: #059669;">Rp 0 <span style="font-size: 12px; font-weight: 600; color: #166534;">(Bebas Biaya Promo)</span></span>' : `Rp ${data.amount.toLocaleString('id-ID')}`}
            </td>
          </tr>
        </table>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://wellpos.id/#subscription" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
          Buka Backoffice & Cek Saldo Kuota
        </a>
      </div>

      <div style="background: #f8fafc; border-left: 3px solid #64748b; padding: 12px; border-radius: 4px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
          Ada pertanyaan seputar faktur ini? Balas langsung email ini ke <a href="mailto:billing@wellpos.id" style="color: #2563eb; font-weight: 600;">billing@wellpos.id</a> atau hubungi Tim Dukungan Pelanggan di <a href="mailto:helpcare@wellpos.id" style="color: #2563eb; font-weight: 600;">helpcare@wellpos.id</a>.
        </p>
      </div>

      <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        Salam hangat,<br>
        <strong>Tim Billing & Finansial Well POS</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      © ${new Date().getFullYear()} Well POS. Sistem Kasir Cloud Modern & Handal.
    </div>
  </div>
</body>
</html>
`;

    return await sendMailInternal({
      from: getSenderAddress('Billing'),
      replyTo: 'billing@wellpos.id',
      to: recipientEmail,
      subject: `[Well POS] Bukti Pembayaran Top-Up +${data.tokenAmount.toLocaleString('id-ID')} Token (#${data.invoiceNumber})`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error('[MailService] Error saat mengirim faktur top-up token:', err);
    return {
      success: false,
      message: `Gagal mengirim email faktur top-up token: ${err.message}`,
    };
  }
};

export interface PlatformBroadcastEmailData {
  recipientName: string;
  companyName?: string;
  title: string;
  message: string;
  type: 'MAINTENANCE' | 'INFO' | 'WARNING' | 'UPDATE';
  expiresAt?: string | null;
  actionUrl?: string;
}

/**
 * Service: Mengirimkan Surat Pemberitahuan Resmi / Broadcast Notifikasi Platform ke Pemilik Toko
 * Sender: noreply@wellpos.id (System)
 * Reply-To: helpcare@wellpos.id
 */
export const sendPlatformBroadcastEmail = async (
  recipientEmail: string,
  data: PlatformBroadcastEmailData
): Promise<{ success: boolean; message: string; previewUrl?: string }> => {
  try {
    const typeConfigs = {
      MAINTENANCE: {
        badgeText: 'PEMELIHARAAN SISTEM TERJADWAL',
        badgeBg: '#fef3c7',
        badgeColor: '#92400e',
        headerBg: '#78350f',
        accentBorder: '#f59e0b',
        subjectPrefix: '[Well POS Penting] Pemeliharaan Sistem:',
      },
      WARNING: {
        badgeText: 'PERINGATAN KEAMANAN & OPERASIONAL',
        badgeBg: '#ffe4e6',
        badgeColor: '#9f1239',
        headerBg: '#881337',
        accentBorder: '#f43f5e',
        subjectPrefix: '[Well POS Perhatian] Peringatan Sistem:',
      },
      UPDATE: {
        badgeText: 'FITUR & PEMBARUAN SISTEM BARU',
        badgeBg: '#dcfce7',
        badgeColor: '#166534',
        headerBg: '#064e3b',
        accentBorder: '#10b981',
        subjectPrefix: '[Well POS Rilis] Pembaruan Aplikasi:',
      },
      INFO: {
        badgeText: 'PENGUMUMAN RESMI MANAJEMEN',
        badgeBg: '#e0f2fe',
        badgeColor: '#075985',
        headerBg: '#1e3a8a',
        accentBorder: '#3b82f6',
        subjectPrefix: '[Well POS Pengumuman]',
      },
    };

    const cfg = typeConfigs[data.type] || typeConfigs.INFO;

    // Format pesan multiline ke paragraf HTML
    const formattedParagraphs = data.message
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((p) => `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #334155;">${p}</p>`)
      .join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${data.title}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="background-color: ${cfg.headerBg}; padding: 28px; text-align: center; color: #ffffff;">
      <span style="display: inline-block; background-color: ${cfg.badgeBg}; color: ${cfg.badgeColor}; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
        ${cfg.badgeText}
      </span>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.3;">${data.title}</h1>
      ${data.companyName ? `<p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Pemberitahuan Khusus untuk: <strong>${data.companyName}</strong></p>` : `<p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Pemberitahuan Resmi Tim Operasional Platform</p>`}
    </div>

    <!-- Body -->
    <div style="padding: 28px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
        Halo <strong>${data.recipientName}</strong>,
      </p>

      <!-- Message Content Box -->
      <div style="background: #f8fafc; border-left: 4px solid ${cfg.accentBorder}; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
        ${formattedParagraphs}
      </div>

      ${data.expiresAt ? `
      <div style="background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #64748b;">
        ⏳ <strong>Masa Berlaku Pengumuman:</strong> Hingga ${new Date(data.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
      ` : ''}

      <!-- Call to Action -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${data.actionUrl || 'https://wellpos.id/#dashboard'}" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(30, 58, 138, 0.2);">
          Buka Backoffice Toko
        </a>
      </div>

      <div style="background: #ffffff; border-top: 1px dashed #cbd5e1; padding-top: 18px; margin-bottom: 16px;">
        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
          Butuh klarifikasi atau memiliki kendala operasional terkait pengumuman ini? Hubungi Tim Pusat Bantuan kami di <a href="mailto:helpcare@wellpos.id" style="color: #2563eb; font-weight: 600;">helpcare@wellpos.id</a>.
        </p>
      </div>

      <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        Salam hormat,<br>
        <strong>Tim Manajemen & Infrastruktur Well POS</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
      © ${new Date().getFullYear()} Well POS Platform. Email resmi pembaruan & keamanan sistem toko.
    </div>
  </div>
</body>
</html>
`;

    return await sendMailInternal({
      from: getSenderAddress('System'),
      replyTo: 'helpcare@wellpos.id',
      to: recipientEmail,
      subject: `${cfg.subjectPrefix} ${data.title}`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error('[MailService] Error saat mengirim broadcast notifikasi:', err);
    return {
      success: false,
      message: `Gagal mengirim email broadcast notifikasi: ${err.message}`,
    };
  }
};



