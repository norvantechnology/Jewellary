import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaPool?: Pool;
  prismaClient?: PrismaClient;
};

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const isBuild =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.argv.some((arg) => arg.includes("build"));

const defaultPoolMax = Number.parseInt(process.env.PG_POOL_MAX ?? "", 10);
const POOL_MAX =
  Number.isFinite(defaultPoolMax) && defaultPoolMax > 0
    ? defaultPoolMax
    : isServerless || isBuild
      ? 1
      : process.env.NODE_ENV === "production"
        ? 10
        : 5;

/**
 * TLS for hosted Postgres. Statically scoped to ./certs/ to avoid Turbopack tracing the whole repo root.
 */
function buildConnection(url: string): Pick<PoolConfig, "connectionString" | "ssl"> {
  const caPath = process.env.DATABASE_SSL_CA;
  if (!caPath) return { connectionString: url };
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");

  const certFile = path.basename(caPath);
  const resolvedPath = path.join(process.cwd(), "certs", certFile);

  return {
    connectionString: parsed.toString(),
    ssl: {
      ca: readFileSync(resolvedPath, "utf8"),
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
          idleTimeoutMillis: isServerless ? 5_000 : 30_000,
          connectionTimeoutMillis: isServerless ? 6_000 : 12_000,
          maxUses: isServerless ? 500 : 7500,
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
