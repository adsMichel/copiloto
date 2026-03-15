import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Prevent multiple instances of Prisma Client in development
// See: https://www.prisma.io/docs/support/help-articles/nextjs-prisma-client-dev-practices

declare global {
  var prisma: PrismaClient | undefined;
}

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';

const sqliteAdapter = new PrismaBetterSqlite3({
  url: databaseUrl,
});

export const prisma =
  global.prisma ?? new PrismaClient({
    // Prisma 7 requires either an `accelerateUrl` (Prisma Accelerate) or an adapter.
    // We use a local SQLite database via the official SQLite adapter.
    adapter: sqliteAdapter,
    ...(process.env.NODE_ENV === 'development' ? { log: ['query', 'info', 'warn', 'error'] } : { log: ['error'] }),
  });

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
