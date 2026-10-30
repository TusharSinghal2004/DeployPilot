-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "url" TEXT,
    "isHealthy" BOOLEAN NOT NULL DEFAULT false,
    "healthFailureStreak" INTEGER NOT NULL DEFAULT 0,
    "rollbackOf" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoUrl" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "factsJson" TEXT NOT NULL,
    "blueprintJson" TEXT NOT NULL,
    "planJson" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT,
    "deploymentId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "status" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'none',
    "approvalStatus" TEXT NOT NULL DEFAULT 'n/a',
    "detailsJson" TEXT
);

-- CreateIndex
CREATE INDEX "Deployment_analysisId_idx" ON "Deployment"("analysisId");

-- CreateIndex
CREATE INDEX "Deployment_repoUrl_idx" ON "Deployment"("repoUrl");

-- CreateIndex
CREATE INDEX "Analysis_repoUrl_idx" ON "Analysis"("repoUrl");

-- CreateIndex
CREATE INDEX "ActionLog_analysisId_idx" ON "ActionLog"("analysisId");

-- CreateIndex
CREATE INDEX "ActionLog_deploymentId_idx" ON "ActionLog"("deploymentId");

-- CreateIndex
CREATE INDEX "ActionLog_timestamp_idx" ON "ActionLog"("timestamp");
