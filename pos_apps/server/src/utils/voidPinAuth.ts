import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';

export type VoidPinVerifyResult =
  | {
      ok: true;
      approver: {
        id: string;
        name: string;
        role: Role;
      };
    }
  | {
      ok: false;
      status: 403;
      code: 'VOID_PIN_NOT_CONFIGURED' | 'VOID_PIN_REQUIRED' | 'INVALID_VOID_PIN';
      message: string;
    };

/**
 * Memverifikasi 6-digit PIN Khusus Otorisasi Void pada tenant.
 * Hanya mencocokkan terhadap `voidPinHash` milik user aktif ber-role OWNER, ADMIN, atau SUPERVISOR.
 * Dilarang mencocokkan terhadap PIN Akses login (`pinHash`) atau kata sandi akun (`passwordHash`).
 */
export async function verifyVoidPin(tenantId: string | undefined | null, rawVoidPin?: string): Promise<VoidPinVerifyResult> {
  const candidates = await prisma.user.findMany({
    where: {
      tenantId: tenantId || undefined,
      role: { in: [Role.OWNER, Role.ADMIN, Role.SUPERVISOR] },
      isActive: true,
      voidPinHash: { not: null },
    },
    select: {
      id: true,
      name: true,
      role: true,
      voidPinHash: true,
    },
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      status: 403,
      code: 'VOID_PIN_NOT_CONFIGURED',
      message:
        'PIN Khusus Void belum diatur. Silakan atur PIN Khusus Void (terpisah dari PIN Akses) di menu Pengguna & Staf untuk akun Owner, Admin, atau Supervisor.',
    };
  }

  const trimmedPin = typeof rawVoidPin === 'string' ? rawVoidPin.trim() : '';
  if (!trimmedPin) {
    return {
      ok: false,
      status: 403,
      code: 'VOID_PIN_REQUIRED',
      message: 'PIN Khusus Void wajib dimasukkan untuk membatalkan transaksi.',
    };
  }

  for (const cand of candidates) {
    if (cand.voidPinHash && (await bcrypt.compare(trimmedPin, cand.voidPinHash))) {
      return {
        ok: true,
        approver: {
          id: cand.id,
          name: cand.name,
          role: cand.role,
        },
      };
    }
  }

  return {
    ok: false,
    status: 403,
    code: 'INVALID_VOID_PIN',
    message: 'PIN Khusus Void tidak valid. Pastikan Anda memasukkan PIN Khusus Void, bukan PIN Akses login.',
  };
}
