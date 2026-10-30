-- CreateTable
CREATE TABLE "EphemeralLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deploymentId" TEXT,
    "frontendUrl" TEXT NOT NULL,
    "backendUrl" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "passwordHash" TEXT,
    "state" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destroyedAt" DATETIME,
    "createdBy" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" DATETIME
);

-- CreateIndex
CREATE INDEX "EphemeralLink_state_expiresAt_idx" ON "EphemeralLink"("state", "expiresAt");
