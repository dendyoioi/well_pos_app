import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma';

export interface OrderWhatsAppData {
  invoiceNumber: string;
  queueNumber?: number | null;
  createdAt: string | Date;
  customerName?: string | null;
  customerPhone?: string | null;
  outlet: {
    name: string;
    address?: string | null;
    phone?: string | null;
    receiptConfig?: any;
  };
  cashierName?: string | null;
  orderItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    subtotal: number;
    unit?: string;
  }>;
  subtotal: number;
  discountAmount: number;
  serviceCharge?: number;
  taxAmount: number;
  grandTotal: number;
  pointsEarned?: number;
  pointsRedeemed?: number;
  pointDiscountAmount?: number;
  payments: Array<{
    method: string;
    amountPaid: number;
    changeGiven: number;
    qrisReference?: string | null;
  }>;
}

export interface LaundryNotificationData {
  invoiceNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  outlet: {
    name: string;
    address?: string | null;
    phone?: string | null;
    receiptConfig?: any;
  };
  servicesSummary: string;
  perfume?: string | null;
  rackCode?: string | null;
  grandTotal: number;
  remainingAmount: number;
  status: string;
  estimatedCompletionDate?: string | Date | null;
}

export interface PlatformWhatsAppConfig {
  enabled: boolean;
  provider: 'FONNTE';
  apiKey?: string;
  senderNumber?: string;
  allowTenantFallback: boolean;
  updatedAt?: string;
}

export interface WhatsAppSendResult {
  status: 'success' | 'error';
  success?: boolean;
  message: string;
  targetPhone: string;
  isMock: boolean;
  provider: string;
  externalResponse?: any;
}

const PLATFORM_WA_CONFIG_FILE = path.join(__dirname, '../../data/platform_whatsapp_config.json');

export class WhatsAppService {
  /**
   * Normalisasi nomor telepon ke format internasional standar Indonesia (628...)
   */
  public normalizePhone(phone: string): string {
    let clean = (phone || '').replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  }

  /**
   * Baca konfigurasi WhatsApp tingkat platform (Superadmin)
   */
  public readPlatformConfig(): PlatformWhatsAppConfig {
    try {
      if (fs.existsSync(PLATFORM_WA_CONFIG_FILE)) {
        const raw = fs.readFileSync(PLATFORM_WA_CONFIG_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading platform WhatsApp config:', err);
    }
    return {
      enabled: true,
      provider: 'FONNTE',
      apiKey: process.env.FONNTE_API_KEY || '',
      senderNumber: process.env.FONNTE_SENDER_NUMBER || '',
      allowTenantFallback: true,
    };
  }

  /**
   * Simpan konfigurasi WhatsApp tingkat platform (Superadmin)
   */
  public writePlatformConfig(config: Partial<PlatformWhatsAppConfig>): PlatformWhatsAppConfig {
    const current = this.readPlatformConfig();
    const updated: PlatformWhatsAppConfig = {
      ...current,
      ...config,
      provider: 'FONNTE',
      updatedAt: new Date().toISOString(),
    };
    try {
      const dir = path.dirname(PLATFORM_WA_CONFIG_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(PLATFORM_WA_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing platform WhatsApp config:', err);
    }
    return updated;
  }

  /**
   * Resolusi API Key aktif berdasarkan hierarki:
   * 1. Token Custom Toko / Outlet
   * 2. Token Terpusat Platform Superadmin (jika allowTenantFallback aktif)
   */
  public resolveApiKey(outletConfig?: any): { apiKey: string; isPlatformDefault: boolean; enabled: boolean } {
    const outletWa = outletConfig?.whatsappConfig;
    const platformConfig = this.readPlatformConfig();

    // Jika toko punya konfigurasi sendiri
    if (outletWa) {
      if (outletWa.enabled === false) {
        return { apiKey: '', isPlatformDefault: false, enabled: false };
      }
      if (outletWa.apiKey && outletWa.apiKey.trim().length > 0) {
        return { apiKey: outletWa.apiKey.trim(), isPlatformDefault: false, enabled: true };
      }
    }

    // Fallback ke Platform Superadmin
    if (platformConfig.enabled && platformConfig.allowTenantFallback && platformConfig.apiKey) {
      return { apiKey: platformConfig.apiKey.trim(), isPlatformDefault: true, enabled: true };
    }

    return { apiKey: '', isPlatformDefault: false, enabled: platformConfig.enabled !== false };
  }

  /**
   * Membangun teks struk digital WhatsApp yang rapi dan elegan
   */
  public formatReceiptText(order: OrderWhatsAppData): string {
    const outletName = (order.outlet?.name || 'Well POS Toko').toUpperCase();
    const timeStr = new Date(order.createdAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const queueText =
      order.queueNumber !== undefined && order.queueNumber !== null
        ? `*NOMOR ANTRIAN: #${String(order.queueNumber).padStart(2, '0')}*\n`
        : '';

    const itemsText = order.orderItems
      .map((item) => {
        const disc = Number(item.discountAmount) || 0;
        const discStr = disc > 0 ? ` _(Disc: -Rp ${(disc * item.quantity).toLocaleString('id-ID')})_` : '';
        return `• ${item.name} x${item.quantity} = Rp ${Number(item.subtotal).toLocaleString('id-ID')}${discStr}`;
      })
      .join('\n');

    const paymentsText = order.payments
      .map((p) => {
        let str = `• ${p.method}: Rp ${Number(p.amountPaid).toLocaleString('id-ID')}`;
        if (p.method === 'CASH' && Number(p.changeGiven) > 0) {
          str += ` (Kembalian: Rp ${Number(p.changeGiven).toLocaleString('id-ID')})`;
        }
        return str;
      })
      .join('\n');

    const footerText =
      order.outlet?.receiptConfig?.footerText ||
      `Terima kasih telah berbelanja di ${order.outlet?.name || 'kami'}!\nSimpan bukti transaksi ini sebagai bukti pembayaran resmi.`;

    const showWatermark = order.outlet?.receiptConfig?.showWatermark !== false;
    const watermarkText = showWatermark ? '\n\n_Powered by Well POS_\n_wellpos.id_' : '';

    return (
      `*${outletName}*\n` +
      `_Bukti Pembayaran Digital (Well POS)_\n` +
      `================================\n` +
      queueText +
      `No. Faktur : #${order.invoiceNumber}\n` +
      `Waktu      : ${timeStr}\n` +
      `Kasir      : ${order.cashierName || 'Kasir Toko'}\n` +
      (order.customerName ? `Pelanggan  : ${order.customerName}\n` : '') +
      `--------------------------------\n` +
      `*DAFTAR BELANJA:*\n${itemsText}\n` +
      `--------------------------------\n` +
      `Subtotal   : Rp ${Number(order.subtotal).toLocaleString('id-ID')}\n` +
      (order.discountAmount > 0
        ? `Diskon     : -Rp ${Number(order.discountAmount).toLocaleString('id-ID')}\n`
        : '') +
      (Number(order.pointsRedeemed || 0) > 0
        ? `Tukar Poin : -${order.pointsRedeemed} Poin (-Rp ${Number(
            order.pointDiscountAmount || (order.pointsRedeemed || 0) * 100
          ).toLocaleString('id-ID')})\n`
        : '') +
      (Number(order.serviceCharge || 0) > 0
        ? `Layanan    : +Rp ${Number(order.serviceCharge).toLocaleString('id-ID')}\n`
        : '') +
      (order.taxAmount > 0 ? `Pajak / PB1: +Rp ${Number(order.taxAmount).toLocaleString('id-ID')}\n` : '') +
      `--------------------------------\n` +
      `*TOTAL TAGIHAN : Rp ${Number(order.grandTotal).toLocaleString('id-ID')}*\n` +
      (Number(order.pointsEarned || 0) > 0
        ? `Poin Didapat   : +${order.pointsEarned} Poin Loyalitas\n`
        : '') +
      `--------------------------------\n` +
      `*PEMBAYARAN:*\n${paymentsText}\n` +
      `================================\n` +
      `${footerText}` +
      watermarkText
    );
  }

  /**
   * Kirim Struk Pesanan via WhatsApp Gateway (Fonnte API dengan Fallback Simulator)
   */
  public async sendOrderReceipt(
    order: OrderWhatsAppData,
    targetPhoneOverride?: string
  ): Promise<WhatsAppSendResult> {
    const rawPhone = targetPhoneOverride || order.customerPhone;
    if (!rawPhone || !rawPhone.trim()) {
      return {
        status: 'error',
        message: 'Nomor WhatsApp tujuan tidak boleh kosong',
        targetPhone: '',
        isMock: false,
        provider: 'FONNTE',
      };
    }

    const cleanPhone = this.normalizePhone(rawPhone);
    const { apiKey, enabled } = this.resolveApiKey(order.outlet?.receiptConfig);

    if (!enabled) {
      return {
        status: 'error',
        message: 'Layanan WhatsApp Gateway dinonaktifkan untuk toko ini',
        targetPhone: cleanPhone,
        isMock: false,
        provider: 'FONNTE',
      };
    }

    const messageText = this.formatReceiptText(order);

    // Jika belum ada API Key (Belum Dikonfigurasi / Masih Sandbox)
    if (!apiKey) {
      console.log(`[WHATSAPP UNCONFIGURED] Struk ke ${cleanPhone} tidak dikirim via API karena token Fonnte belum dipasang.`);
      return {
        status: 'error',
        message: 'WhatsApp Gateway belum diaktivasi. Masukkan API Token Fonnte di menu Pengaturan Toko atau gunakan Buka wa.me.',
        targetPhone: cleanPhone,
        isMock: true,
        provider: 'FONNTE',
      };
    }

    // Kirim Nyata ke Fonnte API
    try {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: cleanPhone,
          message: messageText,
          countryCode: '62',
        }),
      });

      const resJson: any = await response.json();

      if (response.ok && resJson.status === true) {
        return {
          status: 'success',
          message: `Struk WhatsApp berhasil dikirim ke +${cleanPhone}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      } else {
        const errorMsg = resJson.reason || resJson.message || 'Gagal mengirim pesan melalui Fonnte API';
        console.error('[FONNTE ERROR]', resJson);
        return {
          status: 'error',
          message: `Fonnte: ${errorMsg}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      }
    } catch (err: any) {
      console.error('[WHATSAPP API NETWORK ERROR]', err);
      return {
        status: 'error',
        message: `Koneksi ke gateway WhatsApp terputus: ${err.message}`,
        targetPhone: cleanPhone,
        isMock: false,
        provider: 'FONNTE',
      };
    }
  }

  /**
   * Format pesan WhatsApp notifikasi Cucian Diterima (Drop-off) + Link Tracking
   */
  public formatLaundryDropoffText(data: LaundryNotificationData, trackingUrlOverride?: string): string {
    const outletName = (data.outlet?.name || 'Well Laundry').toUpperCase();
    const customer = data.customerName || 'Pelanggan Setia';
    const remaining = Number(data.remainingAmount) || 0;
    const grandTotal = Number(data.grandTotal) || 0;
    const trackingUrl =
      trackingUrlOverride ||
      (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://wellpos.id').replace(/\/$/, '') +
        '/track/' +
        encodeURIComponent(data.invoiceNumber);

    let paymentStatusLabel = '*BELUM BAYAR* (Tagihan saat ambil)';
    if (remaining <= 0) {
      paymentStatusLabel = '*LUNAS* ✅';
    } else if (remaining < grandTotal) {
      paymentStatusLabel = `*DP / SEBAGIAN* (Sisa Rp ${remaining.toLocaleString('id-ID')})`;
    }

    const estReady = data.estimatedCompletionDate
      ? new Date(data.estimatedCompletionDate).toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

    return (
      `*NOTIFIKASI NOTA CUCIAN DITERIMA*\n` +
      `*${outletName}*\n` +
      `================================\n` +
      `Halo Kak *${customer}*, terima kasih telah mempercayakan pakaian Anda di ${data.outlet.name}! Cucian Anda telah kami terima dengan detail berikut:\n\n` +
      `📋 *DETAIL ORDER:*\n` +
      `• No. Nota     : *#${data.invoiceNumber}*\n` +
      `• Layanan      : ${data.servicesSummary}\n` +
      (data.perfume ? `• Aroma Wangi  : ${data.perfume}\n` : '') +
      `• Estimasi Selesai : *${estReady}*\n\n` +
      `💰 *STATUS PEMBAYARAN:*\n` +
      `• Total Tagihan: Rp ${grandTotal.toLocaleString('id-ID')}\n` +
      `• Status Bayar : ${paymentStatusLabel}\n\n` +
      `🔍 *PANTAU PROGRES CUCIAN REAL-TIME:*\n` +
      `Pelanggan dapat memantau status cuci, kering, setrika, hingga siap ambil tanpa perlu bertanya lewat WA melalui link berikut:\n` +
      `👉 ${trackingUrl}\n\n` +
      `📍 *LOKASI OUTLET:*\n` +
      `${data.outlet.address || data.outlet.name}\n` +
      (data.outlet.phone ? `Telp/WA: ${data.outlet.phone}\n` : '') +
      `================================\n` +
      `_Simpan pesan ini untuk kemudahan pengambilan cucian. Terima kasih!_`
    );
  }

  /**
   * Format pesan WhatsApp notifikasi Cucian Siap Diambil
   */
  public formatLaundryReadyText(data: LaundryNotificationData, trackingUrlOverride?: string): string {
    const outletName = (data.outlet?.name || 'Well Laundry').toUpperCase();
    const customer = data.customerName || 'Pelanggan Setia';
    const remaining = Number(data.remainingAmount) || 0;
    const grandTotal = Number(data.grandTotal) || 0;
    const trackingUrl =
      trackingUrlOverride ||
      (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://wellpos.id').replace(/\/$/, '') +
        '/track/' +
        encodeURIComponent(data.invoiceNumber);

    const paymentNote =
      remaining <= 0
        ? '• Status Bayar : *LUNAS* ✅'
        : `• Total Biaya  : Rp ${grandTotal.toLocaleString('id-ID')}\n• Sisa Tagihan : *Rp ${remaining.toLocaleString('id-ID')}* (Bayar saat ambil)`;

    return (
      `*NOTIFIKASI CUCIAN SIAP AMBIL*\n` +
      `*${outletName}*\n` +
      `================================\n` +
      `Halo Kak *${customer}*, cucian Anda telah selesai kami proses dengan bersih, rapi, dan harum! ✨\n\n` +
      `📋 *DETAIL ORDER:*\n` +
      `• No. Nota     : #${data.invoiceNumber}\n` +
      `• Layanan      : ${data.servicesSummary}\n` +
      (data.perfume ? `• Aroma Wangi  : ${data.perfume}\n` : '') +
      `• Lokasi Rak   : *${data.rackCode || 'Area Rak Siap Ambil'}*\n\n` +
      `🔍 Pantau progres cucian Anda: ${trackingUrl}\n\n` +
      `💰 *STATUS PEMBAYARAN:*\n` +
      `${paymentNote}\n\n` +
      `📍 *LOKASI OUTLET:*\n` +
      `${data.outlet.address || data.outlet.name}\n` +
      (data.outlet.phone ? `Telp/WA: ${data.outlet.phone}\n` : '') +
      `================================\n` +
      `_Silakan tunjukkan pesan ini atau sebutkan No. Nota saat pengambilan cucian._\n` +
      `_Terima kasih telah mempercayakan pakaian Anda di ${data.outlet.name}!_`
    );
  }

  /**
   * Format pesan WhatsApp notifikasi Cucian Selesai Diambil (Handover) + Rating CTA
   */
  public formatLaundryCompletedText(data: LaundryNotificationData, trackingUrlOverride?: string): string {
    const outletName = (data.outlet?.name || 'Well Laundry').toUpperCase();
    const customer = data.customerName || 'Pelanggan Setia';
    const trackingUrl =
      trackingUrlOverride ||
      (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://wellpos.id').replace(/\/$/, '') +
        '/track/' +
        encodeURIComponent(data.invoiceNumber);

    return (
      `*NOTIFIKASI PENGAMBILAN CUCIAN*\n` +
      `*${outletName}*\n` +
      `================================\n` +
      `Halo Kak *${customer}*, terima kasih banyak!\n` +
      `Cucian Anda dengan No. Nota *#${data.invoiceNumber}* telah berhasil diserahkan/diambil.\n\n` +
      `• Status       : *SELESAI & DIAMBIL* ✅\n` +
      `• Pembayaran   : *LUNAS*\n` +
      (data.servicesSummary ? `• Layanan      : ${data.servicesSummary}\n` : '') +
      `\n🔍 Pantau riwayat & beri rating layanan cucian Anda:\n` +
      `👉 ${trackingUrl}\n\n` +
      `⭐ *BAGAIMANA PENGALAMAN ANDA?*\n` +
      `Kami sangat menghargai ulasan Anda! Mohon luangkan waktu 30 detik untuk memberikan rating kepuasan pada link di atas agar kami dapat terus meningkatkan layanan. ✨\n` +
      `================================\n` +
      `_${data.outlet.name}_`
    );
  }

  /**
   * Format pesan WhatsApp sapaan Win-Back pelanggan pasif
   */
  public formatLaundryWinbackText(params: {
    customerName: string;
    outletName: string;
    outletPhone?: string | null;
    promoCode?: string | null;
    promoDescription?: string | null;
    customMessage?: string | null;
  }): string {
    const customer = params.customerName || 'Pelanggan Setia';
    const outlet = params.outletName || 'Well Laundry';

    let promoSection = '';
    if (params.promoCode) {
      promoSection =
        `\n🎁 *PROMO SPESIAL UNTUK ANDA:*\n` +
        `Gunakan kode voucher: *${params.promoCode}*\n` +
        (params.promoDescription ? `${params.promoDescription}\n` : '');
    }

    const defaultGreeting =
      `Halo Kak *${customer}*, apa kabar? Kami kangen melihat pakaian Anda di *${outlet}*! 😊\n\n` +
      `Pakaian kotor atau selimut/sprei di rumah sudah mulai menumpuk? Yuk, percayakan kembali cucian Anda kepada kami untuk hasil yang bersih maksimal, higienis, dan wangi tahan lama.`;

    const bodyText = params.customMessage?.trim() || defaultGreeting;

    return (
      `*SAPAAN SPESIAL DARI ${outlet.toUpperCase()}*\n` +
      `================================\n` +
      `${bodyText}\n` +
      promoSection +
      `\n📍 Hubungi / kunjungi kami di:\n` +
      `${outlet}` +
      (params.outletPhone ? ` | WA: ${params.outletPhone}` : '') +
      `\n================================\n` +
      `_Semoga hari Anda menyenangkan dan kami nantikan kehadiran cucian Anda berikutnya!_`
    );
  }

  /**
   * Kirim Notifikasi Sapaan Win-Back Pelanggan Pasif via WhatsApp Gateway (Fonnte API)
   */
  public async sendLaundryWinbackNotification(
    targetPhone: string,
    params: {
      customerName: string;
      outletName: string;
      outletPhone?: string | null;
      promoCode?: string | null;
      promoDescription?: string | null;
      customMessage?: string | null;
      receiptConfig?: any;
    }
  ): Promise<WhatsAppSendResult> {
    if (!targetPhone || !targetPhone.trim()) {
      return {
        status: 'error',
        message: 'Nomor WhatsApp pelanggan tidak tersedia',
        targetPhone: '',
        isMock: false,
        provider: 'FONNTE',
      };
    }

    const cleanPhone = this.normalizePhone(targetPhone);
    const { apiKey, enabled } = this.resolveApiKey(params.receiptConfig);
    const messageText = this.formatLaundryWinbackText(params);

    if (!enabled) {
      return {
        status: 'error',
        message: 'Layanan WhatsApp Gateway dinonaktifkan untuk toko ini',
        targetPhone: cleanPhone,
        isMock: false,
        provider: 'FONNTE',
      };
    }

    if (!apiKey) {
      return {
        status: 'error',
        message: 'WhatsApp Gateway belum diaktivasi di outlet ini. Silakan atur token Fonnte di Pengaturan Toko.',
        targetPhone: cleanPhone,
        isMock: true,
        provider: 'FONNTE',
      };
    }

    try {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: cleanPhone,
          message: messageText,
          countryCode: '62',
        }),
      });

      const resJson: any = await response.json();

      if (response.ok && resJson.status === true) {
        return {
          status: 'success',
          message: `Sapaan Win-Back WhatsApp berhasil dikirim ke +${cleanPhone}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      } else {
        const errorMsg = resJson.reason || resJson.message || 'Gagal mengirim pesan win-back via Fonnte API';
        return {
          status: 'error',
          message: `Fonnte: ${errorMsg}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      }
    } catch (err: any) {
      console.error('[WHATSAPP API ERROR]', err);
      return {
        status: 'error',
        message: `Koneksi gateway WhatsApp terputus: ${err.message}`,
        targetPhone: cleanPhone,
        isMock: false,
        provider: 'FONNTE',
      };
    }
  }

  /**
   * Kirim Notifikasi Laundry Otomatis via WhatsApp Gateway (Fonnte API)
   */
  public async sendLaundryNotification(
    data: LaundryNotificationData,
    type: 'DROPOFF' | 'READY' | 'COMPLETED',
    targetPhoneOverride?: string
  ): Promise<WhatsAppSendResult> {
    const rawPhone = targetPhoneOverride || data.customerPhone;
    if (!rawPhone || !rawPhone.trim()) {
      return {
        status: 'error',
        message: 'Nomor WhatsApp pelanggan tidak tersedia',
        targetPhone: '',
        isMock: false,
        provider: 'FONNTE',
      };
    }

    const cleanPhone = this.normalizePhone(rawPhone);
    const { apiKey, enabled } = this.resolveApiKey(data.outlet?.receiptConfig);

    if (!enabled) {
      return {
        status: 'error',
        message: 'Layanan WhatsApp Gateway dinonaktifkan untuk toko ini',
        targetPhone: cleanPhone,
        isMock: false,
        provider: 'FONNTE',
      };
    }

    const trackingUrl =
      (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://wellpos.id').replace(/\/$/, '') +
      '/track/' +
      encodeURIComponent(data.invoiceNumber);

    const messageText =
      type === 'DROPOFF'
        ? this.formatLaundryDropoffText(data, trackingUrl)
        : type === 'READY'
        ? this.formatLaundryReadyText(data, trackingUrl)
        : this.formatLaundryCompletedText(data, trackingUrl);

    // Fallback jika belum terpasang token Fonnte
    if (!apiKey) {
      console.log(`[WHATSAPP UNCONFIGURED] Notifikasi laundry (${type}) ke ${cleanPhone} tidak dikirim via API karena token Fonnte belum dipasang.`);
      return {
        status: 'error',
        message: 'WhatsApp Gateway belum diaktivasi di outlet ini. Silakan atur token Fonnte di Pengaturan Toko.',
        targetPhone: cleanPhone,
        isMock: true,
        provider: 'FONNTE',
      };
    }

    try {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: cleanPhone,
          message: messageText,
          countryCode: '62',
        }),
      });

      const resJson: any = await response.json();

      if (response.ok && resJson.status === true) {
        return {
          status: 'success',
          message: `Notifikasi WhatsApp (${type}) berhasil dikirim ke +${cleanPhone}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      } else {
        const errorMsg = resJson.reason || resJson.message || 'Gagal mengirim notifikasi via Fonnte API';
        return {
          status: 'error',
          message: `Fonnte: ${errorMsg}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      }
    } catch (err: any) {
      console.error('[WHATSAPP API ERROR]', err);
      return {
        status: 'error',
        message: `Koneksi gateway WhatsApp terputus: ${err.message}`,
        targetPhone: cleanPhone,
        isMock: false,
        provider: 'FONNTE',
      };
    }
  }

  /**
   * Kirim Pengingat Cucian Mengendap di Rak (>= 3 / 7 Hari)
   */
  public async sendStaleRackReminder(data: {
    phone: string;
    customerName: string;
    invoiceNumber: string;
    rackCode?: string | null;
    daysAging: number;
    remainingAmount: number;
    outletName: string;
    outletAddress?: string | null;
    outletPhone?: string | null;
    trackingUrl?: string | null;
    receiptConfig?: any;
  }): Promise<WhatsAppSendResult> {
    if (!data.phone || !data.phone.trim()) {
      return {
        status: 'error',
        message: 'Nomor WhatsApp pelanggan tidak tersedia',
        targetPhone: '',
        isMock: false,
        provider: 'FONNTE',
      };
    }

    const cleanPhone = this.normalizePhone(data.phone);
    const { apiKey, enabled } = this.resolveApiKey(data.receiptConfig);

    const trackingUrl =
      data.trackingUrl ||
      (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://wellpos.id').replace(/\/$/, '') +
        '/track/' +
        encodeURIComponent(data.invoiceNumber);

    const messageText =
      `*PEMBERITAHUAN PENYIMPANAN CUCIAN — ${data.outletName.toUpperCase()}*\n\n` +
      `Halo Kak *${data.customerName || 'Pelanggan Setia'}*,\n` +
      `Pakaian bersih Anda dengan nomor nota *${data.invoiceNumber}* telah selesai diproses dan saat ini tersimpan aman di *Rak ${data.rackCode || 'Kasir'}* selama *${data.daysAging} hari*.\n\n` +
      `📍 *Lokasi Pengambilan:* ${data.outletName}${data.outletAddress ? ` (${data.outletAddress})` : ''}\n` +
      `💰 *Status Tagihan:* ${
        data.remainingAmount > 0
          ? `Sisa tagihan Rp ${Number(data.remainingAmount).toLocaleString('id-ID')} (dapat dilunasi saat pengambilan)`
          : 'LUNAS (tinggal serah terima)'
      }\n` +
      `🔍 Pantau nota: ${trackingUrl}\n\n` +
      `Agar pakaian tetap terjaga kesegaran dan keharumannya, mohon berkenan mengambil pakaian Anda pada jam operasional kami. Terima kasih atas kepercayaan Anda! ✨\n\n` +
      `_${data.outletName}_`;

    if (!apiKey) {
      console.log(`[WHATSAPP MOCK/UNCONFIGURED] Stale rack reminder ke ${cleanPhone}:\n${messageText}`);
      return {
        status: 'success',
        message: `(Mock) Reminder cucian mengendap tercatat untuk +${cleanPhone}`,
        targetPhone: cleanPhone,
        isMock: true,
        provider: 'FONNTE',
      };
    }

    try {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: cleanPhone,
          message: messageText,
          countryCode: '62',
        }),
      });

      const resJson: any = await response.json();
      if (response.ok && resJson.status === true) {
        return {
          status: 'success',
          message: `Reminder cucian mengendap berhasil dikirim ke +${cleanPhone}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      } else {
        const errorMsg = resJson.reason || resJson.message || 'Gagal mengirim notifikasi via Fonnte API';
        return {
          status: 'error',
          message: `Fonnte: ${errorMsg}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      }
    } catch (err: any) {
      console.error('[WHATSAPP API ERROR]', err);
      return {
        status: 'error',
        message: `Koneksi gateway WhatsApp terputus: ${err.message}`,
        targetPhone: cleanPhone,
        isMock: false,
        provider: 'FONNTE',
      };
    }
  }

  /**
   * Kirim Pengingat Masa Aktif Kuota Laundry Kiloan (H-1 Expired)
   */
  public async sendQuotaExpiryReminder(data: {
    phone: string;
    customerName: string;
    remainingQuotaKg: number;
    expiryDateStr: string;
    outletName: string;
    receiptConfig?: any;
  }): Promise<WhatsAppSendResult> {
    if (!data.phone || !data.phone.trim()) {
      return {
        status: 'error',
        message: 'Nomor WhatsApp pelanggan tidak tersedia',
        targetPhone: '',
        isMock: false,
        provider: 'FONNTE',
      };
    }

    const cleanPhone = this.normalizePhone(data.phone);
    const { apiKey, enabled } = this.resolveApiKey(data.receiptConfig);

    const messageText =
      `*PENGINGAT MASA AKTIF KUOTA LAUNDRY — ${data.outletName.toUpperCase()}*\n\n` +
      `Halo Kak *${data.customerName || 'Pelanggan Setia'}*,\n` +
      `Kami menginformasikan bahwa sisa kuota cuci kiloan Anda sebesar *${data.remainingQuotaKg} Kg* akan kedaluwarsa pada besok hari (*${data.expiryDateStr}*).\n\n` +
      `Yuk manfaatkan kuota kiloan Anda untuk mencuci pakaian kotor Anda sebelum hangus! Cukup bawa pakaian kotor Anda ke *${data.outletName}* hari ini.\n\n` +
      `Terima kasih atas kesetiaan Anda menggunakan layanan kami! 🙏\n\n` +
      `_${data.outletName}_`;

    if (!apiKey) {
      console.log(`[WHATSAPP MOCK/UNCONFIGURED] Quota expiry reminder ke ${cleanPhone}:\n${messageText}`);
      return {
        status: 'success',
        message: `(Mock) Reminder kuota expired tercatat untuk +${cleanPhone}`,
        targetPhone: cleanPhone,
        isMock: true,
        provider: 'FONNTE',
      };
    }

    try {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: cleanPhone,
          message: messageText,
          countryCode: '62',
        }),
      });

      const resJson: any = await response.json();
      if (response.ok && resJson.status === true) {
        return {
          status: 'success',
          message: `Reminder kuota expired berhasil dikirim ke +${cleanPhone}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      } else {
        const errorMsg = resJson.reason || resJson.message || 'Gagal mengirim notifikasi via Fonnte API';
        return {
          status: 'error',
          message: `Fonnte: ${errorMsg}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      }
    } catch (err: any) {
      console.error('[WHATSAPP API ERROR]', err);
      return {
        status: 'error',
        message: `Koneksi gateway WhatsApp terputus: ${err.message}`,
        targetPhone: cleanPhone,
        isMock: false,
        provider: 'FONNTE',
      };
    }
  }

  /**
   * Tes Koneksi / Cek Status Akun Fonnte API
   */
  public async testDeviceConnection(apiKey: string, testTarget?: string): Promise<any> {
    if (!apiKey || !apiKey.trim()) {
      return { status: 'error', message: 'API Token Fonnte tidak boleh kosong' };
    }

    try {
      // 1. Cek status device Fonnte
      const deviceRes = await fetch('https://api.fonnte.com/device', {
        method: 'POST',
        headers: {
          Authorization: apiKey.trim(),
        },
      });

      const deviceData: any = await deviceRes.json();

      // 2. Jika ada nomor target pengujian, kirimkan pesan sapaan uji coba
      let testSendRes = null;
      if (testTarget && testTarget.trim()) {
        const cleanPhone = this.normalizePhone(testTarget);
        const sendRes = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: {
            Authorization: apiKey.trim(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target: cleanPhone,
            message:
              `*Tes Koneksi WhatsApp Gateway Well POS*\n\n` +
              `Selamat! Integrasi WhatsApp Gateway Fonnte dengan sistem kasir Well POS telah terhubung dengan sukses.\n` +
              `Waktu: ${new Date().toLocaleString('id-ID')}`,
            countryCode: '62',
          }),
        });
        testSendRes = await sendRes.json();
      }

      return {
        status: 'success',
        device: deviceData,
        testSend: testSendRes,
      };
    } catch (err: any) {
      return {
        status: 'error',
        message: `Gagal menguji koneksi Fonnte: ${err.message}`,
      };
    }
  }

  /**
   * Kirim Notifikasi Peringatan Dini Kritis ke WhatsApp Owner (Laundry Performance Intelligence)
   */
  public async sendOwnerAlertNotification(data: {
    tenantId: string;
    outletId?: string;
    ownerPhone: string;
    outletName: string;
    severity: string;
    title: string;
    message: string;
    metricValue: number;
    thresholdValue: number;
  }): Promise<WhatsAppSendResult> {
    try {
      if (!data.ownerPhone || !data.ownerPhone.trim()) {
        return {
          status: 'error',
          success: false,
          message: 'Nomor WhatsApp Owner tidak tersedia',
          targetPhone: '',
          isMock: false,
          provider: 'FONNTE',
        };
      }

      const cleanPhone = this.normalizePhone(data.ownerPhone);

      // Ambil konfigurasi receiptConfig outlet / tenant untuk resolusi token WA
      let receiptConfig: any = null;
      try {
        if (data.outletId) {
          const outlet = await prisma.outlet.findUnique({
            where: { id: data.outletId },
            select: { receiptConfig: true },
          });
          receiptConfig = outlet?.receiptConfig;
        }
        if (!receiptConfig && data.tenantId) {
          const outletFallback = await prisma.outlet.findFirst({
            where: { tenantId: data.tenantId },
            select: { receiptConfig: true },
          });
          receiptConfig = outletFallback?.receiptConfig;
        }
      } catch (dbErr) {
        console.warn('[WHATSAPP OWNER ALERT] Gagal membaca receiptConfig outlet:', dbErr);
      }

      const { apiKey, enabled } = this.resolveApiKey(receiptConfig);

      if (!enabled) {
        return {
          status: 'error',
          success: false,
          message: 'Layanan WhatsApp Gateway dinonaktifkan untuk toko ini',
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
        };
      }

      const sevBadge = (data.severity || 'CRITICAL').toUpperCase() === 'CRITICAL' ? '🚨 [PERINGATAN KRITIS]' : '⚠️ [PERINGATAN OUTLET]';
      const formattedMetric = typeof data.metricValue === 'number' ? Number(data.metricValue).toLocaleString('id-ID') : data.metricValue;
      const formattedThreshold = typeof data.thresholdValue === 'number' ? Number(data.thresholdValue).toLocaleString('id-ID') : data.thresholdValue;

      const messageText =
        `${sevBadge} — ${data.outletName.toUpperCase()}\n` +
        `*${data.title}*\n\n` +
        `${data.message}\n\n` +
        `• Nilai Terdeteksi : *${formattedMetric}*\n` +
        `• Batas Ambang     : *${formattedThreshold}*\n\n` +
        `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
        `_Pesan otomatis dikirim oleh Laundry Performance Intelligence (Well POS)_`;

      if (!apiKey) {
        console.log(`[WHATSAPP MOCK/UNCONFIGURED] Owner alert ke ${cleanPhone}:\n${messageText}`);
        return {
          status: 'success',
          success: true,
          message: `(Mock) Notifikasi WhatsApp Owner tercatat untuk +${cleanPhone}`,
          targetPhone: cleanPhone,
          isMock: true,
          provider: 'FONNTE',
        };
      }

      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: cleanPhone,
          message: messageText,
          countryCode: '62',
        }),
      });

      const resJson: any = await response.json();
      if (response.ok && resJson.status === true) {
        return {
          status: 'success',
          success: true,
          message: `Peringatan WhatsApp Owner berhasil dikirim ke +${cleanPhone}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      } else {
        const errorMsg = resJson.reason || resJson.message || 'Gagal mengirim pesan via Fonnte API';
        return {
          status: 'error',
          success: false,
          message: `Fonnte: ${errorMsg}`,
          targetPhone: cleanPhone,
          isMock: false,
          provider: 'FONNTE',
          externalResponse: resJson,
        };
      }
    } catch (err: any) {
      console.error('[WHATSAPP OWNER ALERT ERROR]', err);
      return {
        status: 'error',
        success: false,
        message: `Koneksi gateway WhatsApp terputus: ${err.message}`,
        targetPhone: data.ownerPhone || '',
        isMock: false,
        provider: 'FONNTE',
      };
    }
  }
}

export const whatsAppService = new WhatsAppService();
