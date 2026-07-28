-- CreateEnum
CREATE TYPE "LandingBundleStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "LandingBundle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "LandingBundleStatus" NOT NULL DEFAULT 'DRAFT',
    "portraitFileId" TEXT,
    "workFileId" TEXT,
    "workPos" TEXT DEFAULT 'center center',
    "videoFileId" TEXT,
    "specialty" TEXT,
    "about" TEXT,
    "rejectReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingBundleItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LandingBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingBundle_userId_status_idx" ON "LandingBundle"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LandingBundleItem_bundleId_fileId_key" ON "LandingBundleItem"("bundleId", "fileId");

-- AddForeignKey
ALTER TABLE "LandingBundle" ADD CONSTRAINT "LandingBundle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingBundleItem" ADD CONSTRAINT "LandingBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "LandingBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
