-- Editable onboarding regulations text (markdown), managed by admins
CREATE TABLE IF NOT EXISTS "RegulationDocument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulationDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegulationDocument_slug_key" ON "RegulationDocument"("slug");

ALTER TABLE "RegulationDocument"
    DROP CONSTRAINT IF EXISTS "RegulationDocument_updatedById_fkey";

ALTER TABLE "RegulationDocument"
    ADD CONSTRAINT "RegulationDocument_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
