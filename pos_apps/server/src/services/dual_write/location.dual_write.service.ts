import * as crypto from 'crypto';
import { BaseDualWriteService } from './base.dual_write.service';
import {
  CreateOutletDTO,
  DualWriteContext,
  DualWriteResult,
} from './types';

/**
 * LocationDualWriteService
 * Synchronizes Outlet branch creation with target StorageLocation defaults.
 * Enforces single-default invariant per outlet.
 * Adheres to OD-14.1-01 (Strict Fail-Closed for Master Locations)
 * and OD-14.1-02 (Parameterized Raw SQL - Zero prisma generate).
 */
export class LocationDualWriteService extends BaseDualWriteService {
  /**
   * Creates an outlet and automatically provisions its default StorageLocation in the target schema.
   */
  public async createOutlet(
    dto: CreateOutletDTO,
    ctx: DualWriteContext
  ): Promise<DualWriteResult<any>> {
    const { tx, tenantId } = ctx;

    try {
      // 1. LEGACY OUTLET CREATION VIA PARAMETERIZED RAW SQL
      const outletId = crypto.randomUUID();
      const isWarehouse = dto.isWarehouse ?? false;
      const code = `OUT-${outletId.substring(0, 8).toUpperCase()}`;

      await this.executeRaw(
        tx,
        `INSERT INTO "outlets" (
          "id", "tenant_id", "name", "address", "phone", "is_warehouse",
          "fees_config", "is_active", "code", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7::jsonb, true, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );`,
        outletId,
        tenantId,
        dto.name,
        dto.address || null,
        dto.phone || null,
        isWarehouse,
        dto.feesConfig ? JSON.stringify(dto.feesConfig) : null,
        code
      );

      const legacyOutlet = {
        id: outletId,
        tenantId,
        name: dto.name,
        address: dto.address || null,
        phone: dto.phone || null,
        isWarehouse,
        code,
        isActive: true,
      };

      // 2. TARGET STORAGE LOCATION PROVISIONING
      const locationId = this.generateDeterministicUuid(`${outletId}:default_location`);
      const locName = (isWarehouse ? 'Warehouse - ' : 'Storefront - ') + dto.name;
      const locType = isWarehouse ? 'WAREHOUSE' : 'STOREFRONT';

      await this.executeRaw(
        tx,
        `INSERT INTO "storage_locations" (
          "id", "tenant_id", "outlet_id", "name", "type", "is_default", "allow_negative_stock", "is_active", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5::"StorageLocationType", true, null, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "type" = EXCLUDED."type",
          "is_default" = true,
          "is_active" = true,
          "updated_at" = CURRENT_TIMESTAMP;`,
        locationId,
        tenantId,
        outletId,
        locName,
        locType
      );

      return {
        legacyData: legacyOutlet,
        targetSynced: true,
        targetRecordsAffected: 1,
        targetDetails: {
          outletId,
          storageLocationId: locationId,
          storageLocationName: locName,
          type: locType,
        },
      };
    } catch (err: any) {
      if (ctx.strictAtomic !== false) {
        throw err;
      }
      await this.logEmergencyDrift({
        domain: 'LOCATION',
        operation: 'createOutlet',
        tenantId,
        payload: dto,
        errorMessage: err.message,
        errorStack: err.stack,
        occurredAt: new Date(),
      });
      throw err;
    }
  }
}
