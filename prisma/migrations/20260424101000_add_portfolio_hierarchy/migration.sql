-- CreateTable
CREATE TABLE "PortfolioProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioCard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mainFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioCardAttachment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioCardAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioProject_userId_createdAt_idx" ON "PortfolioProject"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PortfolioCard_projectId_createdAt_idx" ON "PortfolioCard"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioCard_mainFileId_key" ON "PortfolioCard"("mainFileId");

-- CreateIndex
CREATE INDEX "PortfolioCardAttachment_cardId_createdAt_idx" ON "PortfolioCardAttachment"("cardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioCardAttachment_cardId_fileId_key" ON "PortfolioCardAttachment"("cardId", "fileId");

-- AddForeignKey
ALTER TABLE "PortfolioProject" ADD CONSTRAINT "PortfolioProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCard" ADD CONSTRAINT "PortfolioCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PortfolioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCard" ADD CONSTRAINT "PortfolioCard_mainFileId_fkey" FOREIGN KEY ("mainFileId") REFERENCES "UserFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCardAttachment" ADD CONSTRAINT "PortfolioCardAttachment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "PortfolioCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCardAttachment" ADD CONSTRAINT "PortfolioCardAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UserFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
