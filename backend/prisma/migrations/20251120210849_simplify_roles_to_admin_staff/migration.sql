-- AlterEnum: Simplify UserRole to ADMIN and STAFF only
-- Step 1: Add STAFF to existing enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STAFF' AND enumtypid = 'UserRole'::regtype) THEN
        ALTER TYPE "UserRole" ADD VALUE 'STAFF';
    END IF;
END $$;

-- Step 2: Update existing USER records to STAFF
UPDATE "users" SET "role" = 'STAFF' WHERE "role" = 'USER';

-- Step 3: Update default value
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'STAFF'::"UserRole";

-- Step 4: Create new enum without USER and VIEWER
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'STAFF');

-- Step 5: Convert column to use new enum
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE
      WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::"UserRole_new"
      ELSE 'STAFF'::"UserRole_new"
    END
  );

-- Step 6: Set default again for new type
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'STAFF'::"UserRole_new";

-- Step 7: Drop old enum and rename new one
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
