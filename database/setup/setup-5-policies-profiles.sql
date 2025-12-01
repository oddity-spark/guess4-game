-- ============================================
-- STEP 5: RLS Policies for user_profiles
-- ============================================
-- Run this fifth (after setup-4-rls.sql)

-- Drop existing policies first
DROP POLICY IF EXISTS "users_select" ON user_profiles;
DROP POLICY IF EXISTS "users_insert" ON user_profiles;
DROP POLICY IF EXISTS "users_update" ON user_profiles;

-- Create policies
CREATE POLICY "users_select" ON user_profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "users_insert" ON user_profiles
  FOR INSERT
  WITH CHECK (true);  -- Allow all inserts (trigger needs this)

CREATE POLICY "users_update" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);
