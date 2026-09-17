-- CreateTable
CREATE TABLE "OrderBriefAiPreview" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderBriefAiPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderBriefAiPreview_orderId_createdAt_idx" ON "OrderBriefAiPreview"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderBriefAiPreview_fileId_idx" ON "OrderBriefAiPreview"("fileId");

-- AddForeignKey
ALTER TABLE "OrderBriefAiPreview" ADD CONSTRAINT "OrderBriefAiPreview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBriefAiPreview" ADD CONSTRAINT "OrderBriefAiPreview_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UserFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
