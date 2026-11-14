import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaPool?: Pool;
  prismaClient?: PrismaClient;
};

const defaultPoolMax = Number.parseInt(process.env.PG_POOL_MAX ?? "", 10);
const POOL_MAX =
  Number.isFinite(defaultPoolMax) && defaultPoolMax > 0
    ? defaultPoolMax
    : process.env.NODE_ENV === "production"
      ? 20
      : 10;

/**
 * TLS for hosted Postgres. With DATABASE_SSL_CA set (path to the provider's root CA, e.g.
 * certs/supabase-root-2021-ca.crt) the server certificate is fully verified. The sslmode in the
 * URL is removed for node-postgres because it would override this config; Prisma CLI still uses it.
 */
function buildConnection(url: string): Pick<PoolConfig, "connectionString" | "ssl"> {
  const caPath = process.env.DATABASE_SSL_CA;
  if (!caPath) return { connectionString: url };
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return {
    connectionString: parsed.toString(),
    ssl: {
      ca: readFileSync(path.resolve(process.cwd(), caPath), "utf8"),
      rejectUnauthorized: true,
    },
  };
}

export function createPrismaClient(connectionString?: string): PrismaClient {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient.");
  }

  const pool =
    connectionString || !globalForPrisma.prismaPool
      ? new Pool({
          ...buildConnection(url),
          max: POOL_MAX,
          idleTimeoutMillis: 30_000,
          // Hosted Postgres (e.g. Supabase) can take a few seconds for a new TLS connection.
          connectionTimeoutMillis: 15_000,
          maxUses: 7500,
        })
      : globalForPrisma.prismaPool;

  if (!connectionString) {
    globalForPrisma.prismaPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db: PrismaClient = globalForPrisma.prismaClient ?? createPrismaClient();
globalForPrisma.prismaClient = db;

export { Prisma };
export type { PrismaClient };
