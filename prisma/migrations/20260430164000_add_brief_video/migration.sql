-- Add brief video attachment to Order.
-- Postgres enum values are append-only.
ALTER TYPE "FileCategory" ADD VALUE IF NOT EXISTS 'BRIEF_VIDEO';

ALTER TABLE "Order"
  ADD COLUMN "briefVideoFileId" TEXT;

-- One video per order (optional)
CREATE UNIQUE INDEX "Order_briefVideoFileId_key" ON "Order"("briefVideoFileId");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_briefVideoFileId_fkey"
  FOREIGN KEY ("briefVideoFileId") REFERENCES "UserFile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

