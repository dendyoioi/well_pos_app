import { prisma } from '../../config/prisma';

/**
 * BaseReadAdapter
 * Abstract foundation for Target Read Adapters querying the target normalized schema.
 * Operates purely on read-only queries with strict tenant isolation.
 */
export abstract class BaseReadAdapter {
  /**
   * Checks if read from target schema is enabled globally via environment variable.
   * Feature flag: READ_FROM_TARGET=true
   */
  public static isReadFromTargetEnabled(): boolean {
    return process.env.READ_FROM_TARGET === 'true';
  }

  /**
   * Executes a parameterized raw SQL read query against the database.
   */
  protected async queryRaw<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    return await prisma.$queryRawUnsafe<T[]>(sql, ...params);
  }

  /**
   * Resolves the default storage location ID for a given outlet under a tenant.
   */
  protected async resolveDefaultStorageLocation(tenantId: string, outletId: string): Promise<string | null> {
    const rows = await this.queryRaw<{ id: string }>(
      `SELECT id FROM "storage_locations"
       WHERE tenant_id = $1 AND outlet_id = $2 AND is_default = true
       LIMIT 1;`,
      tenantId,
      outletId
    );
    return rows[0]?.id || null;
  }

  /**
   * Resolves warehouse storage location for a given tenant.
   */
  protected async resolveWarehouseStorageLocation(tenantId: string): Promise<string | null> {
    const rows = await this.queryRaw<{ id: string }>(
      `SELECT sl.id 
       FROM "storage_locations" sl
       JOIN "outlets" o ON o.id = sl.outlet_id
       WHERE sl.tenant_id = $1 AND o.is_warehouse = true AND sl.is_default = true
       LIMIT 1;`,
      tenantId
    );
    return rows[0]?.id || null;
  }
}
