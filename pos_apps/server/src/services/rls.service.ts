import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export const TENANT_SCOPED_TABLES = [
  'products',
  'product_variants',
  'categories',
  'orders',
  'order_items',
  'inventory_items',
  'inventory_balances',
  'inventory_batches',
  'inventory_ledgers',
  'storage_locations',
  'shifts',
  'customers',
  'customer_point_ledgers',
  'promotions',
  'promotion_usages',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'stock_transfers',
  'stock_transfer_items',
  'recipes',
  'recipe_items',
  'modifier_groups',
  'modifier_items',
  'product_modifier_groups',
  'modifier_recipe_effects',
  'outlets',
  'users',
  'saas_invoices',
  'tenant_subscriptions',
  'payment_transactions',
  'refunds',
  'refund_items',
  'hold_orders',
  'idempotency_records',
];

export class RlsService {
  /**
   * Mengaktifkan Row-Level Security (RLS) dan kebijakan isolasi tenant
   * pada tabel-tabel target PostgreSQL
   */
  async enableTenantRLS(tables: string[] = TENANT_SCOPED_TABLES) {
    const results: Array<{ table: string; success: boolean; error?: string }> = [];

    // Pastikan role non-superuser pos_app tersedia dan memiliki izin
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pos_app') THEN
            CREATE ROLE pos_app LOGIN PASSWORD 'pos_app_password' NOSUPERUSER NOBYPASSRLS;
          END IF;
        END $$;
      `);
      await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO pos_app;`);
      await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pos_app;`);
      await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pos_app;`);
      await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO pos_app;`);
      await prisma.$executeRawUnsafe(`GRANT pos_app TO postgres;`);
    } catch {
      // Abaikan jika role/izin sudah terkonfigurasi
    }

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);

        // Drop policy eksisting jika ada untuk mencegah duplikasi
        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS tenant_isolation_policy ON "${table}";`);

        // Buat policy isolasi tenant dengan bypass SuperAdmin & migration mode
        const policySql = `
          CREATE POLICY tenant_isolation_policy ON "${table}"
          FOR ALL
          USING (
            current_setting('app.is_super_admin', true) = 'true'
            OR current_setting('app.bypass_rls', true) = 'on'
            OR (
              NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
              AND tenant_id = current_setting('app.current_tenant_id', true)
            )
          )
          WITH CHECK (
            current_setting('app.is_super_admin', true) = 'true'
            OR current_setting('app.bypass_rls', true) = 'on'
            OR (
              NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
              AND tenant_id = current_setting('app.current_tenant_id', true)
            )
          );
        `;
        await prisma.$executeRawUnsafe(policySql);

        results.push({ table, success: true });
      } catch (err: any) {
        results.push({ table, success: false, error: err?.message || String(err) });
      }
    }

    return results;
  }

  /**
   * Menjalankan kueri dalam transaksi dengan session variable tenant context
   */
  async withTenantContext<T>(tenantId: string, callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE pos_app;`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true);`, tenantId);
      return await callback(tx);
    });
  }

  /**
   * Menjalankan kueri dalam transaksi dengan bypass SuperAdmin platform
   */
  async withSuperAdminContext<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE pos_app;`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.is_super_admin', 'true', true);`);
      return await callback(tx);
    });
  }

  /**
   * Menjalankan kueri dengan bypass RLS (untuk migrasi/seed)
   */
  async withBypassRLS<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true);`);
      return await callback(tx);
    });
  }

  /**
   * Memeriksa status RLS pada katalog PostgreSQL
   */
  async getRLSStatus() {
    const tableStatus = await prisma.$queryRawUnsafe<Array<{ tablename: string; rowsecurity: boolean }>>(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename = ANY($1::text[])
      ORDER BY tablename;
    `, TENANT_SCOPED_TABLES);

    const policies = await prisma.$queryRawUnsafe<Array<{ tablename: string; policyname: string }>>(`
      SELECT tablename, policyname 
      FROM pg_policies 
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
      ORDER BY tablename;
    `, TENANT_SCOPED_TABLES);

    return {
      totalMonitoredTables: TENANT_SCOPED_TABLES.length,
      tablesWithRLS: tableStatus.filter((t) => t.rowsecurity).length,
      activePolicies: policies.length,
      tableStatus,
      policies,
    };
  }
}

export const rlsService = new RlsService();
