-- Add persisted “sent to designer” status for stage rules
ALTER TABLE "ProjectStage"
  ADD COLUMN IF NOT EXISTS "rulesSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rulesSentS3Key" TEXT;

