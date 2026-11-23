import { PrismaClient } from '@prisma/client';

/**
 * Singleton instance PrismaClient untuk koneksi database PostgreSQL.
 * Mencegah multiple instance saat live-reloading dalam mode development.
 */
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    transactionOptions: {
      maxWait: 10000,
      timeout: 15000,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
