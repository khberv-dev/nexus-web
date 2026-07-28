-- AddEnumValue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'BRIEF_FILE'
      AND enumtypid = '"FileCategory"'::regtype
  ) THEN
    ALTER TYPE "FileCategory" ADD VALUE 'BRIEF_FILE';
  END IF;
END $$;

-- CreateTable
CREATE TABLE "OrderBriefAttachment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderBriefAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderBriefAttachment_orderId_createdAt_idx" ON "OrderBriefAttachment"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderBriefAttachment_fileId_idx" ON "OrderBriefAttachment"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderBriefAttachment_orderId_fileId_key" ON "OrderBriefAttachment"("orderId", "fileId");

-- AddForeignKey
ALTER TABLE "OrderBriefAttachment" ADD CONSTRAINT "OrderBriefAttachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBriefAttachment" ADD CONSTRAINT "OrderBriefAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UserFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

