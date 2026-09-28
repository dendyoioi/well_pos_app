import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { BaseDualWriteService } from './base.dual_write.service';
import {
  CreateUserDTO,
  UpdateUserDTO,
  DualWriteContext,
  DualWriteResult,
} from './types';

/**
 * UserDualWriteService
 * Synchronizes user creation and credential updates with Model B specifications.
 * Enforces OD-13.3-03 (PIN-less users retain pin_hash = NULL) and tenant user_code uniqueness.
 * Adheres to OD-14.1-01 (Strict Fail-Closed for IAM) and OD-14.1-02 (Parameterized Raw SQL).
 */
export class UserDualWriteService extends BaseDualWriteService {
  /**
   * Resolves a unique, deterministic userCode for the tenant.
   */
  private async resolveUniqueUserCode(tx: any, tenantId: string, role: string, _seed: string): Promise<string> {
    const existingRows = await this.queryRaw<{ user_code: string }>(
      tx,
      `SELECT user_code FROM "users" WHERE tenant_id = $1 AND user_code IS NOT NULL;`,
      tenantId
    );
    const existingSet = new Set(existingRows.map((r) => r.user_code));

    // Format baru: 5-digit numerik sesuai spesifikasi auth.controller.ts
    // OWNER/ADMIN: range 00001-09999
    // CASHIER     : range 10001-99999
    // Other roles : range 50001-59999
    const roleUpper = role.toUpperCase();
    let start: number;
    let end: number;
    if (roleUpper === 'OWNER' || roleUpper === 'ADMIN') {
      start = 1; end = 9999;
    } else if (roleUpper === 'CASHIER') {
      start = 10001; end = 99999;
    } else {
      start = 50001; end = 59999;
    }

    for (let i = start; i <= end; i++) {
      const candidate = String(i).padStart(5, '0');
      if (!existingSet.has(candidate)) {
        return candidate;
      }
    }

    // Fallback deterministik jika range penuh (sangat tidak mungkin)
    return String(Date.now()).slice(-5);
  }


  /**
   * Creates a user in legacy schema while simultaneously populating Model B credentials (user_code & pin_hash).
   */
  public async createUser(
    dto: CreateUserDTO,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      // 1. Model B Credential Preparation
      let userCode = dto.userCode?.trim();
      if (!userCode) {
        userCode = await this.resolveUniqueUserCode(tx, tenantId, dto.role, dto.name || dto.email);
      }

      let pinHash: string | null = null;
      if (dto.pin && dto.pin.trim() !== '') {
        pinHash = await bcrypt.hash(dto.pin.trim(), 10);
      } else {
        // OD-13.3-03 Invariant: PIN-less user retains pin_hash = NULL
        pinHash = null;
      }

      // 2. MUTATION VIA PARAMETERIZED RAW SQL (OD-14.1-02)
      const userId = crypto.randomUUID();
      const isActive = dto.isActive !== undefined ? dto.isActive : true;
      const canCashOut = dto.canCashOut !== undefined ? dto.canCashOut : false;

      await this.executeRaw(
        tx,
        `INSERT INTO "users" (
          "id", "outlet_id", "name", "email", "password_hash",
          "role", "is_active", "created_at", "updated_at", "tenant_id", "user_code", "pin_hash", "can_cash_out"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6::"Role", $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8, $9, $10, $11
        );`,
        userId,
        dto.outletId || null,
        dto.name,
        dto.email,
        dto.passwordHash,
        dto.role,
        isActive,
        tenantId,
        userCode,
        pinHash,
        canCashOut
      );

      const userRecord = {
        id: userId,
        tenantId,
        name: dto.name,
        email: dto.email,
        role: dto.role,
        outletId: dto.outletId || null,
        userCode,
        hasPin: pinHash !== null,
        canCashOut,
        isActive,
      };

      return {
        legacyData: userRecord,
        targetSynced: true,
        targetRecordsAffected: 1,
        targetDetails: {
          userId,
          userCode,
          hasPinHash: pinHash !== null,
        },
      };
    } catch (err: any) {
      if (ctx.strictAtomic !== false) {
        throw err;
      }
      await this.logEmergencyDrift({
        domain: 'USER_IAM',
        operation: 'createUser',
        tenantId,
        payload: { email: dto.email, role: dto.role },
        errorMessage: err.message,
        errorStack: err.stack,
        occurredAt: new Date(),
      });
      throw err;
    }
  }

  /**
   * Updates user and synchronizes pin_hash when PIN is modified.
   */
  public async updateUser(
    userId: string,
    dto: UpdateUserDTO,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      let pinHashUpdate: string | null | undefined = undefined;

      if (dto.pin !== undefined) {
        if (dto.pin && dto.pin.trim() !== '') {
          pinHashUpdate = await bcrypt.hash(dto.pin.trim(), 10);
        } else {
          pinHashUpdate = null; // Cleared / PIN-less per OD-13.3-03
        }
      }

      // Fetch existing user
      const existing = await this.queryRaw<any>(
        tx,
        `SELECT id, name, email, password_hash, role, outlet_id, is_active, can_cash_out 
         FROM "users" 
         WHERE "id" = $1 AND "tenant_id" = $2;`,
        userId,
        tenantId
      );

      if (!existing || existing.length === 0) {
        throw new Error(`Pengguna dengan ID ${userId} tidak ditemukan pada tenant ini.`);
      }

      const current = existing[0];
      const name = dto.name !== undefined ? dto.name : current.name;
      const email = dto.email !== undefined ? dto.email : current.email;
      const passwordHash = dto.passwordHash !== undefined ? dto.passwordHash : current.password_hash;
      const role = dto.role !== undefined ? dto.role : current.role;
      const outletId = dto.outletId !== undefined ? (dto.outletId || null) : current.outlet_id;
      const isActive = dto.isActive !== undefined ? dto.isActive : current.is_active;
      const canCashOut = dto.canCashOut !== undefined ? dto.canCashOut : (current.can_cash_out ?? false);

      // Update user with Parameterized Raw SQL
      let targetAffected = 0;
      if (pinHashUpdate !== undefined) {
        await this.executeRaw(
          tx,
          `UPDATE "users" 
           SET "name" = $1, "email" = $2, "password_hash" = $3,
               "role" = $4::"Role", "outlet_id" = $5, "is_active" = $6, "pin_hash" = $7,
               "can_cash_out" = $8,
               "updated_at" = CURRENT_TIMESTAMP
           WHERE "id" = $9 AND "tenant_id" = $10;`,
          name,
          email,
          passwordHash,
          role,
          outletId,
          isActive,
          pinHashUpdate,
          canCashOut,
          userId,
          tenantId
        );
        targetAffected = 1;
      } else {
        await this.executeRaw(
          tx,
          `UPDATE "users" 
           SET "name" = $1, "email" = $2, "password_hash" = $3,
               "role" = $4::"Role", "outlet_id" = $5, "is_active" = $6,
               "can_cash_out" = $7,
               "updated_at" = CURRENT_TIMESTAMP
           WHERE "id" = $8 AND "tenant_id" = $9;`,
          name,
          email,
          passwordHash,
          role,
          outletId,
          isActive,
          canCashOut,
          userId,
          tenantId
        );
      }

      return {
        legacyData: { id: userId, name, email, role, outletId, isActive, canCashOut },
        targetSynced: true,
        targetRecordsAffected: targetAffected,
        targetDetails: { userId, pinHashUpdated: pinHashUpdate !== undefined },
      };
    } catch (err: any) {
      if (ctx.strictAtomic !== false) {
        throw err;
      }
      await this.logEmergencyDrift({
        domain: 'USER_IAM',
        operation: 'updateUser',
        tenantId,
        entityId: userId,
        payload: dto,
        errorMessage: err.message,
        errorStack: err.stack,
        occurredAt: new Date(),
      });
      throw err;
    }
  }
}
