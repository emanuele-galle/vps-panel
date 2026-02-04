-- CreateTable
CREATE TABLE "filebrowser_instances" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "containerId" TEXT,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL DEFAULT 'admin',
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'stopped',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "lastStoppedAt" TIMESTAMP(3),

    CONSTRAINT "filebrowser_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "filebrowser_instances_projectId_key" ON "filebrowser_instances"("projectId");

-- CreateIndex
CREATE INDEX "filebrowser_instances_projectId_idx" ON "filebrowser_instances"("projectId");

-- CreateIndex
CREATE INDEX "filebrowser_instances_status_idx" ON "filebrowser_instances"("status");

-- AddForeignKey
ALTER TABLE "filebrowser_instances" ADD CONSTRAINT "filebrowser_instances_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
