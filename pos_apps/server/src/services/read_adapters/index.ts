/**
 * Target Read Adapters Module (PROMPT 15.2)
 * Provides normalized target-schema read capabilities with 100% legacy API compatibility.
 */

export * from './types';
export * from './base.read_adapter';
export * from './catalog.read_adapter';
export * from './inventory.read_adapter';
export * from './sales.read_adapter';
export * from './report.read_adapter';

export const isReadFromTargetEnabled = (): boolean => {
  return process.env.READ_FROM_TARGET === 'true';
};
