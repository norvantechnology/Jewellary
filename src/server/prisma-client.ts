import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaPool?: Pool;
  prismaClient?: PrismaClient;
};

export function createPrismaClient(connectionString?: string): PrismaClient {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient.");
  }

  const pool =
    connectionString || !globalForPrisma.prismaPool
      ? new Pool({
          connectionString: url,
          max: process.env.NODE_ENV === "production" ? 10 : 5,
        })
      : globalForPrisma.prismaPool;

  if (!connectionString && process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db: PrismaClient = globalForPrisma.prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClient = db;
}

export { Prisma };
export type { PrismaClient };
