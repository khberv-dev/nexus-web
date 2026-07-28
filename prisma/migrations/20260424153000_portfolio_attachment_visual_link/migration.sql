-- AlterTable
ALTER TABLE "PortfolioCardAttachment" ADD COLUMN "linkedVisualFileId" TEXT;

-- AddForeignKey
ALTER TABLE "PortfolioCardAttachment" ADD CONSTRAINT "PortfolioCardAttachment_linkedVisualFileId_fkey" FOREIGN KEY ("linkedVisualFileId") REFERENCES "UserFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PortfolioCardAttachment_linkedVisualFileId_idx" ON "PortfolioCardAttachment"("linkedVisualFileId");
