-- CreateEnum
CREATE TYPE "FileBrowserType" AS ENUM ('PROJECT', 'SYSTEM');

-- AlterTable
ALTER TABLE "filebrowser_instances" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "filebrowser_instances" ADD COLUMN "type" "FileBrowserType" NOT NULL DEFAULT 'PROJECT';
ALTER TABLE "filebrowser_instances" ADD COLUMN "mountPath" TEXT NOT NULL DEFAULT '/var/www/projects';

-- CreateIndex
CREATE INDEX "filebrowser_instances_type_idx" ON "filebrowser_instances"("type");
