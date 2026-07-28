-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FileCategory" ADD VALUE 'PORTRAIT';
ALTER TYPE "FileCategory" ADD VALUE 'LANDING_WORK';

-- AlterTable
ALTER TABLE "SpecialistProfile" ADD COLUMN     "landingWorkPos" TEXT;

-- AlterTable
ALTER TABLE "UserFile" ADD COLUMN     "landingOrder" INTEGER;
