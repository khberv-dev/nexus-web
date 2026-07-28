-- CreateEnum
CREATE TYPE "RequisiteChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "RequisiteChangeRequest" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "status" "RequisiteChangeStatus" NOT NULL DEFAULT 'PENDING',
    "oldData" JSONB NOT NULL,
    "newData" JSONB NOT NULL,
    "adminComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisiteChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequisiteChangeRequest_specialistId_status_idx" ON "RequisiteChangeRequest"("specialistId", "status");

-- CreateIndex
CREATE INDEX "RequisiteChangeRequest_status_createdAt_idx" ON "RequisiteChangeRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "RequisiteChangeRequest" ADD CONSTRAINT "RequisiteChangeRequest_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
