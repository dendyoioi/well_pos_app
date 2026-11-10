import { syncRemoteToLocalDatabase } from './dbSyncLocal.service';

// Eksekusi langsung jika dipanggil via CLI
if (require.main === module) {
  syncRemoteToLocalDatabase()
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal sync error:', err);
      process.exit(1);
    });
}

