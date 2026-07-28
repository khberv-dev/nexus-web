-- AlterTable
ALTER TABLE "SpecialistProfile" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "featuredOnLanding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "videoUrl" TEXT;
