-- ============================================
-- STEP 7: RLS Policies for game_invites
-- ============================================
-- Run this seventh (after setup-6-policies-stats.sql)

-- Drop existing policies first
DROP POLICY IF EXISTS "invites_select" ON game_invites;
DROP POLICY IF EXISTS "invites_insert" ON game_invites;
DROP POLICY IF EXISTS "invites_update" ON game_invites;

-- Create policies
CREATE POLICY "invites_select" ON game_invites
  FOR SELECT TO authenticated
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

CREATE POLICY "invites_insert" ON game_invites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "invites_update" ON game_invites
  FOR UPDATE TO authenticated
  USING (auth.uid() = to_user_id);
