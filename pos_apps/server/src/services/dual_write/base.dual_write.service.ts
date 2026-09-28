import * as crypto from 'crypto';
import { DualWriteContext, EmergencyDriftEntry } from './types';

/**
 * Standard DNS Namespace UUID (RFC 4122) for Well POS deterministic UUIDv5 generation
 */
export const WELL_POS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * In-memory drift emergency buffer for unhandled target failures during dual-write (OD-14.1-01)
 */
export const emergencyDriftBuffer: EmergencyDriftEntry[] = [];

/**
 * Base abstract class providing common parameterized raw SQL utilities,
 * UUIDv5 generation, ADR-002 policy evaluation, and storage location resolution.
 */
export abstract class BaseDualWriteService {
  /**
   * Evaluates whether write mode is switched strictly to target schema (Phase 16 Cutover State).
   * Feature flag: WRITE_MODE=TARGET_ONLY
   */
  public isTargetOnlyWrite(): boolean {
    return process.env.WRITE_MODE !== 'LEGACY_ONLY';
  }

  /**
   * Generates a deterministic RFC 4122 Version 5 UUID using SHA-1.
   */
  public generateDeterministicUuid(name: string, namespace: string = WELL_POS_NAMESPACE): string {
    const cleanNamespace = namespace.replace(/-/g, '');
    const namespaceBytes = Buffer.from(cleanNamespace, 'hex');

    const hash = crypto.createHash('sha1');
    hash.update(namespaceBytes);
    hash.update(name, 'utf8');
    const buffer = hash.digest();

    // Set Version 5 (0101 in bits 4-7 of time_hi_and_version)
    buffer[6] = (buffer[6] & 0x0f) | 0x50;
    // Set RFC 4122 Variant (10 in bits 6-7 of clock_seq_hi_and_reserved)
    buffer[8] = (buffer[8] & 0x3f) | 0x80;

    const hex = buffer.toString('hex', 0, 16);
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32),
    ].join('-');
  }

  /**
   * Executes a parameterized raw SQL write query on the active transaction.
   */
  protected async executeRaw(tx: any, sql: string, ...params: any[]): Promise<number> {
    return await tx.$executeRawUnsafe(sql, ...params);
  }

  /**
   * Executes a parameterized raw SQL read query on the active transaction.
   */
  protected async queryRaw<T = any>(tx: any, sql: string, ...params: any[]): Promise<T[]> {
    return await tx.$queryRawUnsafe(sql, ...params);
  }

  /**
   * Resolves or provisions the default StorageLocation for a given outlet.
   * Enforces single-default invariant per outlet.
   */
  public async resolveDefaultStorageLocation(tx: any, tenantId: string, outletId: string): Promise<string> {
    const rows = await this.queryRaw<{ id: string }>(
      tx,
      `SELECT id FROM "storage_locations" 
       WHERE tenant_id = $1 AND outlet_id = $2 AND is_default = true 
       LIMIT 1;`,
      tenantId,
      outletId
    );

    if (rows.length > 0 && rows[0].id) {
      return rows[0].id;
    }

    // Fallback: If no default location exists, deterministically provision Storefront location
    const deterministicLocId = this.generateDeterministicUuid(`${outletId}:default_location`);
    
    // Check outlet info
    const outletRows = await this.queryRaw<{ name: string; is_warehouse: boolean }>(
      tx,
      `SELECT name, is_warehouse FROM "outlets" WHERE id = $1 LIMIT 1;`,
      outletId
    );
    const outletName = outletRows[0]?.name || 'Outlet';
    const isWarehouse = outletRows[0]?.is_warehouse ?? false;
    const locName = (isWarehouse ? 'Warehouse - ' : 'Storefront - ') + outletName;
    const locType = isWarehouse ? 'WAREHOUSE' : 'STOREFRONT';

    await this.executeRaw(
      tx,
      `INSERT INTO "storage_locations" (
        "id", "tenant_id", "outlet_id", "name", "type", "is_default", "allow_negative_stock", "is_active", "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, $5::"StorageLocationType", true, null, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO NOTHING;`,
      deterministicLocId,
      tenantId,
      outletId,
      locName,
      locType
    );

    return deterministicLocId;
  }

  /**
   * Evaluates Negative Stock permission using ADR-002 Hierarchy:
   * InventoryItem Override ?? StorageLocation Override ?? Tenant Policy ?? false
   */
  public async checkNegativeStockAllowed(
    tx: any,
    tenantId: string,
    storageLocationId: string,
    inventoryItemId: string
  ): Promise<boolean> {
    const itemRows = await this.queryRaw<{ allow_negative_stock: boolean | null }>(
      tx,
      `SELECT allow_negative_stock FROM "inventory_items" WHERE id = $1;`,
      inventoryItemId
    );
    if (itemRows.length > 0 && itemRows[0].allow_negative_stock !== null) {
      return itemRows[0].allow_negative_stock;
    }

    const locRows = await this.queryRaw<{ allow_negative_stock: boolean | null }>(
      tx,
      `SELECT allow_negative_stock FROM "storage_locations" WHERE id = $1;`,
      storageLocationId
    );
    if (locRows.length > 0 && locRows[0].allow_negative_stock !== null) {
      return locRows[0].allow_negative_stock;
    }

    const tenantRows = await this.queryRaw<{ allow_negative_stock: boolean | null }>(
      tx,
      `SELECT allow_negative_stock FROM "tenants" WHERE id = $1;`,
      tenantId
    );
    if (tenantRows.length > 0 && tenantRows[0].allow_negative_stock !== null) {
      return tenantRows[0].allow_negative_stock;
    }

    return false;
  }

  /**
   * Resolves a valid user ID for legacy stock movements when actorUserId is omitted.
   */
  public async resolveActorUserId(tx: any, tenantId: string, actorUserId?: string | null): Promise<string> {
    if (actorUserId) {
      return actorUserId;
    }
    const rows = await this.queryRaw<{ id: string }>(
      tx,
      `SELECT id FROM "users" WHERE tenant_id = $1 LIMIT 1;`,
      tenantId
    );
    if (rows.length > 0 && rows[0].id) {
      return rows[0].id;
    }
    throw new Error(`Tidak dapat menemukan user aktif pada tenant ${tenantId} untuk mutasi stok.`);
  }

  /**
   * Records unhandled target mutations to the emergency drift logger buffer (OD-14.1-01).
   */
  public async logEmergencyDrift(entry: EmergencyDriftEntry): Promise<void> {
    console.error(
      `[EMERGENCY_DRIFT_LOGGER] Domain=${entry.domain} Op=${entry.operation} Tenant=${entry.tenantId} Error=${entry.errorMessage}`,
      entry.payload
    );
    emergencyDriftBuffer.push(entry);
  }
}
