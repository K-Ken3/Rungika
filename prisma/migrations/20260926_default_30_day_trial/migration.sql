-- AlterTable
ALTER TABLE "PlatformSetting"
ALTER COLUMN "trialDays" SET DEFAULT 30;

-- Set the live default setting to a 30 day trial so new workspaces bill after the first month.
UPDATE "PlatformSetting"
SET "trialDays" = 30
WHERE "id" = 'default';
