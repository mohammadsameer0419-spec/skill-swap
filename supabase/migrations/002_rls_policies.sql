-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
-- Comprehensive security policies for all tables

-- ============================================
-- PROFILES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- SKILL CATEGORIES
-- ============================================
ALTER TABLE skill_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view categories
CREATE POLICY "Categories are viewable by everyone"
  ON skill_categories FOR SELECT
  USING (true);

-- Only admins can modify (for now, disabled - can be enabled later)
-- CREATE POLICY "Only admins can modify categories"
--   ON skill_categories FOR ALL
--   USING (false); -- Disabled for now

-- ============================================
-- SKILLS
-- ============================================
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

-- Anyone can view active skills
CREATE POLICY "Active skills are viewable by everyone"
  ON skills FOR SELECT
  USING (status = 'active');

-- Users can view their own skills (all statuses)
CREATE POLICY "Users can view their own skills"
  ON skills FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own skills
CREATE POLICY "Users can insert their own skills"
  ON skills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own skills
CREATE POLICY "Users can update their own skills"
  ON skills FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own skills
CREATE POLICY "Users can delete their own skills"
  ON skills FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SKILL SESSIONS
-- ============================================
ALTER TABLE skill_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view sessions they're part of
CREATE POLICY "Users can view their sessions"
  ON skill_sessions FOR SELECT
  USING (auth.uid() = learner_id OR auth.uid() = teacher_id);

-- Learners can create sessions
CREATE POLICY "Learners can create sessions"
  ON skill_sessions FOR INSERT
  WITH CHECK (auth.uid() = learner_id);

-- Both parties can update their sessions
CREATE POLICY "Participants can update their sessions"
  ON skill_sessions FOR UPDATE
  USING (auth.uid() = learner_id OR auth.uid() = teacher_id);

-- Only participants can delete (cancel) sessions
CREATE POLICY "Participants can delete their sessions"
  ON skill_sessions FOR DELETE
  USING (auth.uid() = learner_id OR auth.uid() = teacher_id);

-- ============================================
-- CREDIT TRANSACTIONS
-- ============================================
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own transactions
CREATE POLICY "Users can view their own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Transactions are inserted via RPC functions only (no direct inserts)
CREATE POLICY "No direct inserts to transactions"
  ON credit_transactions FOR INSERT
  USING (false);

-- ============================================
-- REVIEWS
-- ============================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT
  USING (true);

-- Users can insert reviews for sessions they participated in
CREATE POLICY "Users can create reviews for their sessions"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM skill_sessions
      WHERE id = session_id
      AND (learner_id = auth.uid() OR teacher_id = auth.uid())
      AND status = 'completed'
    )
  );

-- Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);

-- ============================================
-- CERTIFICATES
-- ============================================
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Anyone can view certificates (public records)
CREATE POLICY "Certificates are viewable by everyone"
  ON certificates FOR SELECT
  USING (true);

-- Certificates are created via RPC functions only (immutable)
CREATE POLICY "No direct inserts to certificates"
  ON certificates FOR INSERT
  USING (false);

-- Certificates cannot be updated or deleted (immutable)
CREATE POLICY "Certificates cannot be modified"
  ON certificates FOR UPDATE
  USING (false);

CREATE POLICY "Certificates cannot be deleted"
  ON certificates FOR DELETE
  USING (false);
