-- CreateIndex
CREATE UNIQUE INDEX "Deployment_analysisId_provider_serviceType_key" ON "Deployment"("analysisId", "provider", "serviceType");
