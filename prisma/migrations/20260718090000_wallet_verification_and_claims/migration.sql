ALTER TYPE "ClaimStatus" RENAME TO "ClaimStatus_old";
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUBMITTED', 'PAID', 'FAILED', 'REJECTED');
ALTER TABLE "Claim"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ClaimStatus" USING (
    CASE
      WHEN "status"::text = 'APPROVED' THEN 'SUBMITTED'
      ELSE "status"::text
    END
  )::"ClaimStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "ClaimStatus_old";

ALTER TABLE "Claim" RENAME COLUMN "reviewedAt" TO "submittedAt";
ALTER TABLE "Claim" ADD COLUMN "failureReason" TEXT;

CREATE TABLE "WalletChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 56,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WalletChallenge_userId_address_expiresAt_idx" ON "WalletChallenge"("userId", "address", "expiresAt");
CREATE INDEX "WalletChallenge_expiresAt_idx" ON "WalletChallenge"("expiresAt");
CREATE UNIQUE INDEX "Claim_campaignKey_userId_key" ON "Claim"("campaignKey", "userId");

ALTER TABLE "WalletChallenge" ADD CONSTRAINT "WalletChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
