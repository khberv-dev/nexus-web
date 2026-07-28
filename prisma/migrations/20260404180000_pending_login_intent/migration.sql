-- CreateTable
CREATE TABLE "PendingLoginIntent" (
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingLoginIntent_pkey" PRIMARY KEY ("email")
);
