// Database client and types export
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export all types from Prisma client
export * from '@prisma/client';

// Export JSON field types for type-safe JSON handling
export * from './types';

// Export the client type for dependency injection
export type { PrismaClient };
