import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Prisma CLI не подгружает .env сам (в отличие от `next dev`). Без этого `migrate deploy` падает, если DATABASE_URL только в .env.
config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required (check your .env)");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
