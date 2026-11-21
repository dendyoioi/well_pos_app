import { Request } from 'express';
import { prisma } from '../config/prisma';

export class IdempotencyService {
  /**
   * Ekstrak kunci idempotensi dari header HTTP atau body JSON payload
   */
  public getIdempotencyKey(req: Request): string | null {
    const rawHeader =
      (req.headers?.['x-idempotency-key'] as string) ||
      (req.headers?.['idempotency-key'] as string);

    if (rawHeader && typeof rawHeader === 'string' && rawHeader.trim()) {
      return rawHeader.trim();
    }

    const bodyKey =
      req.body?.clientRequestId ||
      req.body?.offlineReferenceId ||
      req.body?.idempotencyKey;

    if (bodyKey && typeof bodyKey === 'string' && bodyKey.trim()) {
      return bodyKey.trim();
    }

    return null;
  }

  /**
   * Ambil respons tersimpan sebelumnya jika request dengan kunci yang sama pernah sukses diproses
   */
  public async getExistingIdempotentResponse(
    tenantId: string,
    operationType: string,
    idempotencyKey: string
  ): Promise<{ statusCode: number; responseBody: any } | null> {
    try {
      const record = await prisma.idempotencyRecord.findUnique({
        where: {
          tenantId_operationType_idempotencyKey: {
            tenantId,
            operationType,
            idempotencyKey,
          },
        },
      });

      if (!record) return null;

      // Cek masa berlaku (expiresAt)
      if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
        return null;
      }

      return {
        statusCode: record.statusCode || 200,
        responseBody: record.responseBody,
      };
    } catch (err: any) {
      console.warn('[IdempotencyService] Gagal memeriksa IdempotencyRecord:', err.message);
      return null;
    }
  }

  /**
   * Simpan respons transaksi sukses ke tabel idempotency_records
   */
  public async saveIdempotentResponse(
    tenantId: string,
    operationType: string,
    idempotencyKey: string,
    statusCode: number,
    responseBody: any,
    ttlDays: number = 7
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 3600 * 1000);

      await prisma.idempotencyRecord.upsert({
        where: {
          tenantId_operationType_idempotencyKey: {
            tenantId,
            operationType,
            idempotencyKey,
          },
        },
        create: {
          tenantId,
          operationType,
          idempotencyKey,
          statusCode,
          responseBody,
          expiresAt,
        },
        update: {
          statusCode,
          responseBody,
          expiresAt,
        },
      });
    } catch (err: any) {
      console.warn('[IdempotencyService] Gagal menyimpan IdempotencyRecord:', err.message);
    }
  }
}

export const idempotencyService = new IdempotencyService();
