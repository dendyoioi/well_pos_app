import { runAllReconciliations } from '../src/migrations/reconciliation/reconcile_all';

if (require.main === module) {
  const args = process.argv.slice(2);
  const tenantArg = args.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : undefined;

  runAllReconciliations(tenantId).then(({ allPassed }) => {
    process.exit(allPassed ? 0 : 1);
  });
}

export { runAllReconciliations };
