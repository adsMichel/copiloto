import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Prevent multiple instances of Prisma Client in development
// See: https://www.prisma.io/docs/support/help-articles/nextjs-prisma-client-dev-practices

declare global {
  var prisma: PrismaClient | undefined;
}

function normalizeSqliteUrlForBetterSqlite3(url: string): string {
  if (url === ':memory:') return url;

  // Prisma's SQLite connection string is usually `file:./dev.db`.
  // better-sqlite3 expects a filesystem path (e.g. `dev.db`), and on Windows a literal
  // `file:...` filename is invalid (due to `:`), causing runtime failures (500s).
  if (url.startsWith('file:')) {
    let rest = url.slice('file:'.length);

    // Handle file:// URLs as well, just in case.
    if (rest.startsWith('//')) rest = rest.slice(2);

    // Convert file:/C:/path (or /C:/path) to C:/path on Windows-style paths.
    if (rest.startsWith('/') && /^[A-Za-z]:/.test(rest.slice(1))) rest = rest.slice(1);

    return decodeURIComponent(rest);
  }

  return url;
}

const databaseUrl = normalizeSqliteUrlForBetterSqlite3(process.env.DATABASE_URL ?? 'file:./dev.db');

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
