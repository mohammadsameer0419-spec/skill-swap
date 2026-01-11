-- ============================================
-- Micro Skill Swap App - Production Schema
-- ============================================
-- This schema implements a production-ready skill exchange platform
-- with proper data integrity, security, and scalability

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE (Enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  
  -- Reputation system
  reputation_score DECIMAL(5,2) DEFAULT 0.0 CHECK (reputation_score >= 0 AND reputation_score <= 5.0),
  total_reviews INTEGER DEFAULT 0,
  completed_sessions INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast user lookups
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
CREATE INDEX idx_profiles_reputation ON profiles(reputation_score DESC);

-- ============================================
-- 2. SKILL CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS skill_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 3. SKILLS TABLE (Enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  category_id UUID REFERENCES skill_categories(id) ON DELETE SET NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  
  credits_required INTEGER NOT NULL CHECK (credits_required > 0 AND credits_required <= 100),
  requests_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_skills_user_id ON skills(user_id);
CREATE INDEX idx_skills_category ON skills(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_skills_status ON skills(status);
CREATE INDEX idx_skills_level ON skills(level);
CREATE INDEX idx_skills_active ON skills(status, level) WHERE status = 'active';

-- ============================================
-- 4. SKILL SESSIONS TABLE (Full Lifecycle)
-- ============================================
CREATE TABLE IF NOT EXISTS skill_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Participants
  learner_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  
  -- Session details
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested',    -- Initial request
    'accepted',     -- Teacher accepted
    'scheduled',    -- Time set
    'in_progress',  -- Session started
    'completed',    -- Both parties confirmed
    'cancelled',    -- Cancelled by either party
    'disputed'      -- Dispute raised
  )),
  
  credits_amount INTEGER NOT NULL CHECK (credits_amount > 0),
  credits_locked BOOLEAN DEFAULT FALSE, -- Credits locked during active session
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Cancellation/Dispute
  cancelled_by UUID REFERENCES profiles(user_id),
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT different_users CHECK (learner_id != teacher_id)
);

CREATE INDEX idx_sessions_learner ON skill_sessions(learner_id, status);
CREATE INDEX idx_sessions_teacher ON skill_sessions(teacher_id, status);
CREATE INDEX idx_sessions_skill ON skill_sessions(skill_id);
CREATE INDEX idx_sessions_status ON skill_sessions(status);
CREATE INDEX idx_sessions_scheduled ON skill_sessions(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- ============================================
-- 5. CREDIT TRANSACTIONS TABLE (Ledger System)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  
  -- Transaction details
  type TEXT NOT NULL CHECK (type IN (
    'earned',      -- Earned from teaching
    'spent',       -- Spent on learning
    'refund',      -- Refund from cancellation
    'adjustment',  -- Admin adjustment
    'locked',      -- Locked for session
    'unlocked'     -- Unlocked from session
  )),
  
  amount INTEGER NOT NULL, -- Positive for earned/refund/unlocked, negative for spent/locked
  balance_after INTEGER NOT NULL, -- Balance after this transaction
  
  -- Related entities
  session_id UUID REFERENCES skill_sessions(id),
  related_transaction_id UUID REFERENCES credit_transactions(id),
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_amount CHECK (amount != 0)
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_transactions_session ON credit_transactions(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type);

-- ============================================
-- 6. REVIEWS TABLE (Bi-directional)
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Review relationship
  reviewer_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  reviewee_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES skill_sessions(id) ON DELETE RESTRICT,
  
  -- Review content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  -- Review type
  role TEXT NOT NULL CHECK (role IN ('learner', 'teacher')), -- Role of reviewer in the session
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT different_users_review CHECK (reviewer_id != reviewee_id),
  CONSTRAINT one_review_per_session_role UNIQUE (session_id, reviewer_id, role)
);

CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id, created_at DESC);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_session ON reviews(session_id);
CREATE INDEX idx_reviews_rating ON reviews(reviewee_id, rating);

-- ============================================
-- 7. CERTIFICATES TABLE (Immutable Records)
-- ============================================
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_number TEXT UNIQUE NOT NULL, -- Human-readable certificate ID
  
  -- Certificate details
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES skill_sessions(id) ON DELETE RESTRICT,
  
  skill_name TEXT NOT NULL, -- Denormalized for immutability
  teacher_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  teacher_name TEXT NOT NULL, -- Denormalized
  
  -- Certificate data
  issued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Storage
  certificate_url TEXT, -- URL to generated certificate image/PDF
  
  -- Metadata (immutable - no updated_at)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_certificates_user ON certificates(user_id, issued_at DESC);
CREATE INDEX idx_certificates_skill ON certificates(skill_id);
CREATE INDEX idx_certificates_number ON certificates(certificate_number);
CREATE INDEX idx_certificates_session ON certificates(session_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON skill_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default skill categories
INSERT INTO skill_categories (name, description, icon) VALUES
  ('Programming', 'Software development and coding', 'code'),
  ('Design', 'UI/UX and graphic design', 'palette'),
  ('Languages', 'Spoken and written languages', 'language'),
  ('Business', 'Business and entrepreneurship skills', 'briefcase'),
  ('Creative', 'Arts, music, and creative skills', 'music'),
  ('Academic', 'Academic subjects and tutoring', 'book'),
  ('Technical', 'Technical and engineering skills', 'wrench'),
  ('Soft Skills', 'Communication and interpersonal skills', 'users')
ON CONFLICT (name) DO NOTHING;
