-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'IMPORTED', 'EXPORTED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "backup_uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/zip',
    "status" "BackupStatus" NOT NULL DEFAULT 'UPLOADED',
    "projectId" TEXT,
    "projectPath" TEXT,
    "driveFileId" TEXT,
    "driveExportedAt" TIMESTAMP(3),
    "notes" TEXT,
    "errorMessage" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "backup_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_uploads_userId_status_idx" ON "backup_uploads"("userId", "status");

-- CreateIndex
CREATE INDEX "backup_uploads_expiresAt_idx" ON "backup_uploads"("expiresAt");

-- CreateIndex
CREATE INDEX "backup_uploads_status_idx" ON "backup_uploads"("status");

-- AddForeignKey
ALTER TABLE "backup_uploads" ADD CONSTRAINT "backup_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_uploads" ADD CONSTRAINT "backup_uploads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
