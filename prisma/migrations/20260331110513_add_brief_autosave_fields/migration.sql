-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "briefHelpRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "briefStep" INTEGER NOT NULL DEFAULT 0;
