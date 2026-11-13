import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
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

export function createPrismaClient(connectionString?: string): PrismaClient {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient.");
  }

  const pool =
    connectionString || !globalForPrisma.prismaPool
      ? new Pool({
          connectionString: url,
          max: POOL_MAX,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
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
