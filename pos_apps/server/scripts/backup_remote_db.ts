import { executeDatabaseBackup, BackupResult, BackupOptions } from '../src/services/dbBackup.service';

export { executeDatabaseBackup, BackupResult, BackupOptions };

// Eksekusi langsung jika dipanggil dari command-line (CLI)
if (require.main === module) {
  executeDatabaseBackup()
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal backup error:', err);
      process.exit(1);
    });
}
