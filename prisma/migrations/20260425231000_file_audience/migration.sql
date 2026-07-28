-- CreateEnum
CREATE TYPE "FileAudience" AS ENUM ('DESIGNER', 'CLIENT', 'SHARED');

-- AlterTable
ALTER TABLE "StageFile" ADD COLUMN "audience" "FileAudience" NOT NULL DEFAULT 'SHARED';
