-- Staff password reset via email OTP (login screen).
CREATE TABLE "PasswordResetOtp" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordResetOtp_emailNormalized_createdAt_idx" ON "PasswordResetOtp"("emailNormalized", "createdAt");
CREATE INDEX "PasswordResetOtp_expiresAt_idx" ON "PasswordResetOtp"("expiresAt");
