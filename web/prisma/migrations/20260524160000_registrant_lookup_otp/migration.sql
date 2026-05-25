-- CreateTable
CREATE TABLE "RegistrantLookupOtp" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "registrationCode" TEXT,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrantLookupOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrantLookupOtp_emailNormalized_createdAt_idx" ON "RegistrantLookupOtp"("emailNormalized", "createdAt");

-- CreateIndex
CREATE INDEX "RegistrantLookupOtp_registrationCode_idx" ON "RegistrantLookupOtp"("registrationCode");

-- CreateIndex
CREATE INDEX "RegistrantLookupOtp_expiresAt_idx" ON "RegistrantLookupOtp"("expiresAt");
