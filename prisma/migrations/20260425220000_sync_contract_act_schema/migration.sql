-- ============================================================
-- Sync Contract and Act schema with Prisma schema
-- ============================================================

-- 1. Replace ContractStatus enum (rename old, create new, migrate, drop old)
ALTER TABLE "Contract" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "ContractStatus" RENAME TO "ContractStatus_old";

CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT_TO_SPECIALIST', 'SPECIALIST_SIGNED', 'SENT_TO_CLIENT', 'CLIENT_SIGNED', 'CONFIRMED', 'CANCELLED');

ALTER TABLE "Contract"
  ALTER COLUMN "status" TYPE "ContractStatus" USING (
    CASE "status"::text
      WHEN 'DRAFT' THEN 'DRAFT'::"ContractStatus"
      WHEN 'SIGNED_CLIENT' THEN 'SPECIALIST_SIGNED'::"ContractStatus"
      WHEN 'SIGNED_BOTH' THEN 'CONFIRMED'::"ContractStatus"
      WHEN 'CANCELLED' THEN 'CANCELLED'::"ContractStatus"
      ELSE 'DRAFT'::"ContractStatus"
    END
  );

ALTER TABLE "Contract" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "ContractStatus_old";

-- 2. Add new columns to Contract
ALTER TABLE "Contract"
  ADD COLUMN "specialistSignedS3Key" TEXT,
  ADD COLUMN "clientSignedS3Key" TEXT,
  ADD COLUMN "sentToSpecialistAt" TIMESTAMP(3),
  ADD COLUMN "specialistSignedAt" TIMESTAMP(3),
  ADD COLUMN "sentToClientAt" TIMESTAMP(3),
  ADD COLUMN "clientSignedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedAt" TIMESTAMP(3);

-- Drop legacy signedAt column
ALTER TABLE "Contract" DROP COLUMN IF EXISTS "signedAt";

-- 3. Create ActStatus enum
CREATE TYPE "ActStatus" AS ENUM ('PENDING', 'SPECIALIST_UPLOADED', 'ADMIN_APPROVED', 'CLIENT_SIGNED', 'CONFIRMED', 'REJECTED');

-- 4. Add new columns to StageAct
ALTER TABLE "StageAct"
  ADD COLUMN "status" "ActStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "specialistActS3Key" TEXT,
  ADD COLUMN "clientActS3Key" TEXT,
  ADD COLUMN "specialistUploadedAt" TIMESTAMP(3),
  ADD COLUMN "adminApprovedAt" TIMESTAMP(3),
  ADD COLUMN "clientSignedAt" TIMESTAMP(3),
  ADD COLUMN "adminConfirmedAt" TIMESTAMP(3);

-- 5. Update StageAct foreign key to CASCADE (was RESTRICT)
ALTER TABLE "StageAct" DROP CONSTRAINT "StageAct_stageId_fkey";
ALTER TABLE "StageAct" ADD CONSTRAINT "StageAct_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "ProjectStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Add index on StageAct.stageId (schema has @@index([stageId]))
CREATE INDEX IF NOT EXISTS "StageAct_stageId_idx" ON "StageAct"("stageId");

-- 7. Add index on OnboardingStep.profileId
CREATE INDEX "OnboardingStep_profileId_idx" ON "OnboardingStep"("profileId");
