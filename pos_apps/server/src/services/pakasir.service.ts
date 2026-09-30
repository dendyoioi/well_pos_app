/**
 * Pakasir Payment Gateway Service (API v2)
 * Dokumentasi resmi: https://app.pakasir.com (Panduan v2)
 */

export interface CreateTransactionParams {
  orderId: string;
  amount: number;
  method?: 'qris' | 'payment_link' | 'bri_va' | 'bni_va' | 'cimb_niaga_va' | 'permata_va' | 'maybank_va' | 'bnc_va' | 'artha_graha_va' | 'sampoerna_va';
}

export interface CreateTransactionResult {
  txnId: string;
  orderId: string;
  amount: number;
  fee?: number;
  totalPayment?: number;
  paymentMethod: string;
  qrString?: string;
  paymentLink?: string;
  vaNumber?: string;
  expiredAt?: string;
  isSandbox: boolean;
}

export interface TransactionStatusResult {
  txnId: string;
  orderId: string;
  amount: number;
  isSandbox: boolean;
  status: 'pending' | 'completed' | 'canceled';
  completedAt?: string;
}

export class PakasirService {
  private slug: string;
  private apiKey: string;
  private webhookSecret: string;
  private baseUrl: string;

  constructor() {
    this.slug = process.env.PAKASIR_SLUG || 'wellposdev';
    this.apiKey = process.env.PAKASIR_API_KEY || 'vDSvureIrzkKGjuzmIwu2GJwutMMzdNj';
    this.webhookSecret = process.env.PAKASIR_WEBHOOK_SECRET || 'a5da553214d1f9e9b072b429f076a0b7';
    this.baseUrl = process.env.PAKASIR_BASE_URL || 'https://app.pakasir.com';
  }

  /**
   * Membuat transaksi baru di Pakasir (Idempotent per orderId)
   */
  async createTransaction(params: CreateTransactionParams): Promise<CreateTransactionResult> {
    const { orderId, amount, method = 'qris' } = params;
    // Sanitasi orderId agar tidak ada forward slash ('/') yang memecah URL path
    const sanitizedOrderId = orderId.replace(/\//g, '-');
    const url = `${this.baseUrl}/api/v2/create-transaction/${this.slug}/${encodeURIComponent(sanitizedOrderId)}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          method,
          amount: Math.round(amount),
        }),
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data) {
        const errorMsg = data?.message || data?.error || `HTTP ${response.status} ${response.statusText}`;
        console.error(`[PakasirService] Gagal membuat transaksi di Pakasir (${url}):`, errorMsg);
        throw new Error(`Pakasir API Error: ${errorMsg}`);
      }

      // Format response untuk method = 'payment_link'
      if (method === 'payment_link') {
        return {
          txnId: data.txn_id,
          orderId,
          amount,
          paymentMethod: 'payment_link',
          paymentLink: data.payment_link,
          isSandbox: Boolean(data.is_sandbox),
        };
      }

      // Format response untuk direct method (qris / VA)
      return {
        txnId: data.txn_id,
        orderId: data.order_id || orderId,
        amount: data.amount ?? amount,
        fee: data.fee,
        totalPayment: data.total_payment ?? amount,
        paymentMethod: data.payment_method || method,
        qrString: data.qr_string || '',
        vaNumber: data.va_number || '',
        expiredAt: data.expired_at,
        isSandbox: Boolean(data.is_sandbox),
      };
    } catch (err: any) {
      console.error('[PakasirService] Error saat memanggil createTransaction:', err.message);
      throw err;
    }
  }

  /**
   * Memeriksa status transaksi terkini dari Pakasir
   */
  async checkTransactionStatus(txnId: string): Promise<TransactionStatusResult> {
    const url = `${this.baseUrl}/api/v2/transaction-status/${this.slug}/${encodeURIComponent(txnId)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
        },
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data) {
        const errorMsg = data?.message || `HTTP ${response.status}`;
        throw new Error(`Gagal cek status transaksi Pakasir: ${errorMsg}`);
      }

      return {
        txnId: data.txn_id,
        orderId: data.order_id,
        amount: data.amount,
        isSandbox: Boolean(data.is_sandbox),
        status: data.status, // 'pending' | 'completed' | 'canceled'
        completedAt: data.completed_at,
      };
    } catch (err: any) {
      console.error('[PakasirService] Error checkTransactionStatus:', err.message);
      throw err;
    }
  }

  /**
   * Membatalkan transaksi di Pakasir
   */
  async cancelTransaction(txnId: string): Promise<boolean> {
    const url = `${this.baseUrl}/api/v2/cancel-transaction/${this.slug}/${encodeURIComponent(txnId)}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Api-Key': this.apiKey,
        },
      });

      const data: any = await response.json().catch(() => null);
      return response.ok;
    } catch (err: any) {
      console.error('[PakasirService] Error cancelTransaction:', err.message);
      return false;
    }
  }

  /**
   * Menghitung estimasi biaya pembayaran dari Pakasir (Endpoint Publik)
   */
  async calculateFee(amount: number): Promise<Record<string, number>> {
    const url = `${this.baseUrl}/api/v2/payment-fee/${Math.round(amount)}`;

    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return {};
      return (await response.json()) as Record<string, number>;
    } catch (err) {
      return {};
    }
  }

  /**
   * Verifikasi keamanan Webhook Signature / Secret
   */
  verifyWebhookSecret(incomingSecret?: string): boolean {
    if (!incomingSecret) return false;
    return incomingSecret.trim() === this.webhookSecret.trim();
  }
}

export const pakasirService = new PakasirService();
