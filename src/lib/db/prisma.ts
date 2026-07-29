import { PrismaClient } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require("@prisma/adapter-pg");

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
    // Password hash is never included by default — routes that serialize a full
    // User record (findMany/include without an explicit select) would otherwise
    // leak it to the client. Override per-query with `omit: { password: false }`
    // where the hash is actually needed (see credentials-provider.ts).
    omit: { user: { password: true } },
  });
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = global as unknown as { prisma: AppPrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
