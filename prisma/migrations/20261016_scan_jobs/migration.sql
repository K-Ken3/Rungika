-- CreateEnum
CREATE TYPE "ScanJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'REVIEW', 'IMPORTED', 'FAILED');

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "ScanJobStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "sourceKey" TEXT,
    "sourceName" TEXT,
    "sourceMime" TEXT,
    "hint" TEXT,
    "result" JSONB,
    "warnings" JSONB,
    "error" TEXT,
    "importedTableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "scanJobId" TEXT,
    "tableId" TEXT,
    "mode" TEXT NOT NULL,
    "mapping" JSONB,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanJob_businessId_createdAt_idx" ON "ScanJob"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanJob_businessId_status_createdAt_idx" ON "ScanJob"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_businessId_createdAt_idx" ON "ImportJob"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CustomTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lock down new tables for the public PostgREST roles (anon/authenticated).
ALTER TABLE "ScanJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportJob" ENABLE ROW LEVEL SECURITY;
