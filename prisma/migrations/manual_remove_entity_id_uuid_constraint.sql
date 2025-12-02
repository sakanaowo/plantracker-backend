-- Manual migration: Remove UUID constraint from activity_logs.entity_id
-- Reason: entity_id needs to support both UUID (for most entities) and Firebase UID string (for MEMBERSHIP logs)
-- Date: 2025-12-02

-- Step 1: Change column type from UUID to TEXT (preserving existing UUID values)
ALTER TABLE activity_logs 
  ALTER COLUMN entity_id TYPE TEXT USING entity_id::TEXT;

-- Step 2: Update Prisma schema to reflect this change
-- In schema.prisma, change:
--   entity_id String? @db.Uuid
-- To:
--   entity_id String?

-- Verification query (check if any UUIDs were corrupted):
-- SELECT entity_id, entity_type, COUNT(*) 
-- FROM activity_logs 
-- WHERE entity_id IS NOT NULL 
-- GROUP BY entity_id, entity_type 
-- ORDER BY COUNT(*) DESC 
-- LIMIT 10;
