-- ============================================
-- STEP 12: Add version column for optimistic locking
-- ============================================
-- Run this to add optimistic locking to prevent race conditions

-- Add version column for optimistic locking
ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

-- Create index for version queries
CREATE INDEX IF NOT EXISTS idx_game_rooms_version ON game_rooms(room_code, version);

-- Update existing rows to have version 1
UPDATE game_rooms
SET version = 1
WHERE version IS NULL;

-- Create function to auto-increment version on update
CREATE OR REPLACE FUNCTION increment_game_room_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-increment version
DROP TRIGGER IF EXISTS game_room_version_trigger ON game_rooms;
CREATE TRIGGER game_room_version_trigger
  BEFORE UPDATE ON game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION increment_game_room_version();
