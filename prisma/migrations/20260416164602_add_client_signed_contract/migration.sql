-- AlterTable
ALTER TABLE "ClientProfile" ADD COLUMN     "signedContractS3Key" TEXT,
ADD COLUMN     "signedContractUploadedAt" TIMESTAMP(3);
