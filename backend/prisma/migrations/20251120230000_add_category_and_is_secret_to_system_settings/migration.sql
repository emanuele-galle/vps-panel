-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "system_settings" ADD COLUMN "isSecret" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");
