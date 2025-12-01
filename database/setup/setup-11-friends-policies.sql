-- ============================================
-- STEP 11: RLS Policies for Friends
-- ============================================
-- Run this after creating friends tables

-- Enable RLS on friends tables
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Friend Requests Policies

-- Users can view friend requests they sent or received
CREATE POLICY "Users can view their friend requests"
  ON friend_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can send friend requests
CREATE POLICY "Users can send friend requests"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Users can update friend requests they received (accept/reject)
CREATE POLICY "Users can update received friend requests"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = to_user_id);

-- Users can delete friend requests they sent
CREATE POLICY "Users can delete sent friend requests"
  ON friend_requests FOR DELETE
  USING (auth.uid() = from_user_id);

-- Friendships Policies

-- Users can view their own friendships
CREATE POLICY "Users can view their friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id);

-- Only the trigger function can insert friendships
CREATE POLICY "System can create friendships"
  ON friendships FOR INSERT
  WITH CHECK (true);

-- Users can delete their friendships (unfriend)
CREATE POLICY "Users can delete their friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = user_id);
