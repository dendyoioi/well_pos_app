const { execSync } = require('child_process');
const fs = require('fs');

function psql(sql) {
  return execSync('psql -h localhost -U postgres -d pos_test_disposable_prompt12_4 -v ON_ERROR_STOP=1 -q -t -A', {
    input: sql,
    encoding: 'utf8'
  }).trim();
}

function dumpBaselineSchema() {
  let dump = execSync('pg_dump -s -h localhost -U postgres pos_db', { encoding: 'utf8' });
  dump = dump.replace(/DEFAULT 'SUCCESS'::public\."PaymentTxStatus"/g, "DEFAULT 'PENDING'::public.\"PaymentTxStatus\"");
  dump = dump.replace(/CREATE TYPE public\."PlatformRole" AS ENUM \([\s\S]*?\);/, "CREATE TYPE public.\"PlatformRole\" AS ENUM ('SUPER_ADMIN');");
  dump = dump.replace(/CREATE TYPE public\."TenantStatus" AS ENUM \([\s\S]*?\);/, "CREATE TYPE public.\"TenantStatus\" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');");
  dump = dump.replace(/CREATE TYPE public\."Role" AS ENUM \([\s\S]*?\);/, "CREATE TYPE public.\"Role\" AS ENUM ('ADMIN', 'SUPERVISOR', 'CASHIER');");
  dump = dump.replace(/CREATE TYPE public\."InvoiceStatus" AS ENUM \([\s\S]*?\);/, "CREATE TYPE public.\"InvoiceStatus\" AS ENUM ('UNPAID', 'PAID');");
  dump = dump.replace(/CREATE TYPE public\."PaymentStatus" AS ENUM \([\s\S]*?\);/, "CREATE TYPE public.\"PaymentStatus\" AS ENUM ('PAID', 'REFUNDED');");
  dump = dump.replace(/CREATE TYPE public\."PaymentTxStatus" AS ENUM \([\s\S]*?\);/, "CREATE TYPE public.\"PaymentTxStatus\" AS ENUM ('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED');");
  dump = dump.replace(/CREATE TYPE public\."StockMovementType" AS ENUM \([\s\S]*?\);/, "CREATE TYPE public.\"StockMovementType\" AS ENUM ('TRANSFER_IN', 'TRANSFER_OUT');");
  dump = dump.replace(/cost_price numeric\(12,2\) NOT NULL,/g, "cost_price numeric(15,4) NOT NULL,");
  dump = dump.replace(/discount_amount numeric\(12,2\) DEFAULT 0 NOT NULL,/g, "discount_amount numeric(15,2) DEFAULT 0 NOT NULL,");
  return dump;
}

// 1. Rebuild clean migrated DB
execSync('psql -h localhost -U postgres -d postgres -c "DROP DATABASE IF EXISTS pos_test_disposable_prompt12_4;"');
execSync('psql -h localhost -U postgres -d postgres -c "CREATE DATABASE pos_test_disposable_prompt12_4;"');
execSync('psql -h localhost -U postgres -d pos_test_disposable_prompt12_4 -v ON_ERROR_STOP=1', {
  input: dumpBaselineSchema(),
  encoding: 'utf8'
});
execSync('psql -h localhost -U postgres -d pos_test_disposable_prompt12_4 -v ON_ERROR_STOP=1 -f server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql > /dev/null 2>&1');

const targetTables = [
  'inventory_items', 'product_variants', 'storage_locations', 'inventory_batches',
  'inventory_balances', 'inventory_ledgers', 'unit_conversions', 'recipes',
  'recipe_items', 'modifier_groups', 'modifier_items', 'product_modifier_groups',
  'modifier_recipe_effects', 'payment_transactions', 'refunds', 'refund_items',
  'idempotency_records', 'legacy_stock_movements'
];
const tblList = targetTables.map(t => "'" + t + "'").join(', ');

// Extract columns as JSON
const colJson = psql(`
  SELECT json_agg(t) FROM (
    SELECT table_name as "table", column_name as "name", udt_name as "udt",
           character_maximum_length as "max_length",
           numeric_precision as "precision",
           numeric_scale as "scale",
           column_default as "default_value",
           is_nullable as "nullable"
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN (${tblList})
    ORDER BY table_name, ordinal_position
  ) t;
`);

// Extract target FKs as JSON
const fkJson = psql(`
  SELECT json_agg(t) FROM (
    SELECT
      tc.constraint_name as "name",
      tc.table_name as "table",
      array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) as "local_cols",
      ccu.table_name as "foreign_table",
      array_agg(ccu.column_name::text ORDER BY kcu.ordinal_position) as "foreign_cols",
      CASE rc.delete_rule WHEN 'CASCADE' THEN 'c' WHEN 'SET NULL' THEN 'n' ELSE 'r' END as "deltype"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN (${tblList})
    GROUP BY tc.constraint_name, tc.table_name, ccu.table_name, rc.delete_rule
    ORDER BY tc.table_name, tc.constraint_name
  ) t;
`);

// Transition FKs
const transFkJson = psql(`
  SELECT json_agg(t) FROM (
    SELECT
      tc.constraint_name as "name",
      tc.table_name as "table",
      array_agg(kcu.column_name::text) as "local_cols",
      ccu.table_name as "foreign_table",
      array_agg(ccu.column_name::text) as "foreign_cols",
      CASE rc.delete_rule WHEN 'CASCADE' THEN 'c' WHEN 'SET NULL' THEN 'n' ELSE 'r' END as "deltype"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND (
      (tc.table_name = 'categories' AND kcu.column_name = 'parent_id') OR
      (tc.table_name = 'order_items' AND kcu.column_name = 'product_variant_id')
    )
    GROUP BY tc.constraint_name, tc.table_name, ccu.table_name, rc.delete_rule
  ) t;
`);

// Indexes
const idxJson = psql(`
  SELECT json_agg(t) FROM (
    SELECT
      c.relname as name,
      t.relname as "table",
      i.indisunique as is_unique,
      am.amname as method,
      array_agg(a.attname::text ORDER BY k.pos) as cols,
      pg_get_expr(i.indpred, i.indrelid) as pred
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_am am ON am.oid = c.relam
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, pos) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE t.relname IN (${tblList})
    GROUP BY c.relname, t.relname, i.indisunique, am.amname, i.indpred, i.indrelid
    ORDER BY t.relname, c.relname
  ) t;
`);

const out = {
  columns: JSON.parse(colJson),
  fks: JSON.parse(fkJson),
  transitionFks: JSON.parse(transFkJson),
  indexes: JSON.parse(idxJson)
};

fs.writeFileSync('/tmp/extracted_target_schema.json', JSON.stringify(out, null, 2), 'utf8');
console.log('Successfully updated /tmp/extracted_target_schema.json!');
console.log('Total columns:', out.columns.length);
console.log('Target FKs:', out.fks.length);
console.log('Transition FKs:', out.transitionFks.length);
const explicit = out.indexes.filter(i => !i.name.endsWith('_pkey') && i.name !== 'recipes_product_variant_id_key');
console.log('Explicit indexes:', explicit.length);
