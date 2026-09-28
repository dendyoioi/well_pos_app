import { executeReverseReconciliation } from '../src/migrations/dual_write/reverse_reconcile';

if (require.main === module) {
  const args = process.argv.slice(2);
  const tenantArg = args.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : undefined;

  executeReverseReconciliation(tenantId)
    .then((stats) => {
      console.log(JSON.stringify(stats, null, 2));
      process.exit(stats.success ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { executeReverseReconciliation };
