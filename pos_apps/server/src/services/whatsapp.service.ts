import fs from 'fs';
import path from 'path';

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
    const watermarkText = showWatermark ? '\n\n_Powered by Well POS_' : '';

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
}

export const whatsAppService = new WhatsAppService();
