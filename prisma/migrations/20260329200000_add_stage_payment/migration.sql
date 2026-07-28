-- AlterEnum
ALTER TYPE "StageStatus" ADD VALUE 'AWAITING_PAYMENT';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "stageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stageId_key" ON "Payment"("stageId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProjectStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
