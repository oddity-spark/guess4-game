-- ============================================
-- STEP 6: RLS Policies for user_stats
-- ============================================
-- Run this sixth (after setup-5-policies-profiles.sql)

-- Drop existing policies first
DROP POLICY IF EXISTS "stats_select" ON user_stats;
DROP POLICY IF EXISTS "stats_insert" ON user_stats;
DROP POLICY IF EXISTS "stats_update" ON user_stats;

-- Create policies
CREATE POLICY "stats_select" ON user_stats
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "stats_insert" ON user_stats
  FOR INSERT
  WITH CHECK (true);  -- Allow all inserts (trigger needs this)

CREATE POLICY "stats_update" ON user_stats
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
