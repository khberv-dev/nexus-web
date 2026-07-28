-- CreateEnum
CREATE TYPE "ClientFrameworkContractStatus" AS ENUM ('NONE', 'AWAITING_SIGNATURE', 'SIGNED_BY_CLIENT', 'DECLINED_BY_CLIENT');

-- AlterTable
ALTER TABLE "ClientProfile" ADD COLUMN     "frameworkContractS3Key" TEXT,
ADD COLUMN     "frameworkContractStatus" "ClientFrameworkContractStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "frameworkContractNumber" TEXT,
ADD COLUMN     "frameworkContractUploadedAt" TIMESTAMP(3);
