export interface BackfillContext {
  isDryRun: boolean;
  tenantId?: string;
  batchSize: number;
  failureInjectionWorker?: string;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string, err?: any) => void;
  };
}

export interface BackfillResult {
  workerName: string;
  processedCount: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  exceptions: Array<{ recordId: string; reason: string }>;
  plannedIds?: string[];
}
