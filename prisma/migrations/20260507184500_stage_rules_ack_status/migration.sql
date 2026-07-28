-- Persisted “designer acknowledged rules” status
ALTER TABLE "ProjectStage"
  ADD COLUMN IF NOT EXISTS "rulesAckAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rulesAckS3Key" TEXT;

