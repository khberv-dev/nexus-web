-- CreateEnum
CREATE TYPE "SpecialistContractStatus" AS ENUM ('NONE', 'AWAITING_SIGNATURE', 'SIGNED_BY_SPECIALIST', 'SIGNED_BY_ADMIN', 'DECLINED_BY_SPECIALIST');

-- AlterTable
ALTER TABLE "SpecialistProfile" ADD COLUMN     "specialistContractS3Key" TEXT,
ADD COLUMN     "specialistContractStatus" "SpecialistContractStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "specialistContractNumber" TEXT,
ADD COLUMN     "specialistContractUploadedAt" TIMESTAMP(3);
