-- CreateTable
CREATE TABLE "PortfolioProjectAttachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioProjectAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioProjectAttachment_projectId_fileId_key" ON "PortfolioProjectAttachment"("projectId", "fileId");

-- CreateIndex
CREATE INDEX "PortfolioProjectAttachment_projectId_createdAt_idx" ON "PortfolioProjectAttachment"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "PortfolioProjectAttachment" ADD CONSTRAINT "PortfolioProjectAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PortfolioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioProjectAttachment" ADD CONSTRAINT "PortfolioProjectAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UserFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
