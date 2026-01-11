-- ============================================
-- Live Classes Feature
-- ============================================
-- Enables Advanced/Expert users to host live classes
-- with credit-based attendance and video room integration

-- ============================================
-- Step 1: Create Live Classes Table
-- ============================================
CREATE TABLE IF NOT EXISTS live_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES skill_categories(id) ON DELETE SET NULL, -- Optional: can link to skill category
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60 CHECK (duration_minutes > 0),
  credit_cost INT DEFAULT 2 CHECK (credit_cost > 0),
  max_attendees INT DEFAULT 20 CHECK (max_attendees > 0),
  meeting_id TEXT UNIQUE, -- The ID for the Video Room (e.g., Daily.co, Zoom, etc.)
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_live_classes_host ON live_classes(host_id);
CREATE INDEX IF NOT EXISTS idx_live_classes_status ON live_classes(status);
CREATE INDEX IF NOT EXISTS idx_live_classes_scheduled ON live_classes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_live_classes_subject ON live_classes(subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_classes_upcoming ON live_classes(scheduled_at) WHERE status IN ('scheduled', 'live');

-- ============================================
-- Step 2: Create Live Class Attendance Table
-- ============================================
CREATE TABLE IF NOT EXISTS live_class_attendance (
  class_id UUID NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paid_status TEXT DEFAULT 'reserved' CHECK (paid_status IN ('reserved', 'paid', 'refunded', 'cancelled')),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  attendance_duration_minutes INT DEFAULT 0,
  credit_transaction_id UUID REFERENCES credit_transactions(id) ON DELETE SET NULL, -- Link to credit ledger
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (class_id, user_id)
);

-- Indexes for attendance queries
CREATE INDEX IF NOT EXISTS idx_live_class_attendance_user ON live_class_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_live_class_attendance_class ON live_class_attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_live_class_attendance_status ON live_class_attendance(paid_status);

-- ============================================
-- Step 3: Row Level Security Policies
-- ============================================

-- Live Classes: Public read for scheduled/live, hosts can manage their own
ALTER TABLE live_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scheduled and live classes"
  ON live_classes FOR SELECT
  USING (status IN ('scheduled', 'live') OR host_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Hosts can create their own classes"
  ON live_classes FOR INSERT
  WITH CHECK (
    host_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND level IN ('advanced', 'expert') -- Only Advanced/Expert can host
    )
  );

CREATE POLICY "Hosts can update their own classes"
  ON live_classes FOR UPDATE
  USING (host_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (host_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Hosts can delete their own classes (if not started)"
  ON live_classes FOR DELETE
  USING (
    host_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status IN ('scheduled', 'cancelled')
  );

-- Live Class Attendance: Users can view their own attendance, hosts can view class attendance
ALTER TABLE live_class_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attendance"
  ON live_class_attendance FOR SELECT
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Hosts can view attendance for their classes"
  ON live_class_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM live_classes lc
      JOIN profiles p ON lc.host_id = p.id
      WHERE lc.id = live_class_attendance.class_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join classes (insert attendance)"
  ON live_class_attendance FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own attendance"
  ON live_class_attendance FOR UPDATE
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================
-- Step 4: Helper Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_live_class_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for live_classes updated_at
CREATE TRIGGER trg_update_live_class_updated_at
  BEFORE UPDATE ON live_classes
  FOR EACH ROW
  EXECUTE FUNCTION update_live_class_updated_at();

-- ============================================
-- Step 5: RPC Functions for Live Classes
-- ============================================

-- Function to join a live class (reserves credits)
CREATE OR REPLACE FUNCTION join_live_class(
  p_class_id UUID,
  p_user_id UUID
)
RETURNS UUID -- Returns credit_transaction_id
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_class_record RECORD;
  v_credit_transaction_id UUID;
  v_current_attendees INT;
  v_available_credits INT;
BEGIN
  -- Get class details
  SELECT * INTO v_class_record
  FROM live_classes
  WHERE id = p_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  -- Check if class is joinable
  IF v_class_record.status NOT IN ('scheduled', 'live') THEN
    RAISE EXCEPTION 'Class is not available for joining';
  END IF;

  -- Check if class is full
  SELECT COUNT(*) INTO v_current_attendees
  FROM live_class_attendance
  WHERE class_id = p_class_id AND paid_status IN ('reserved', 'paid');

  IF v_current_attendees >= v_class_record.max_attendees THEN
    RAISE EXCEPTION 'Class is full';
  END IF;

  -- Check if user already joined
  IF EXISTS (SELECT 1 FROM live_class_attendance WHERE class_id = p_class_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'User has already joined this class';
  END IF;

  -- Check available credits using ledger system
  SELECT available INTO v_available_credits
  FROM get_user_credit_balance_detailed(p_user_id);

  IF v_available_credits < v_class_record.credit_cost THEN
    RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', v_class_record.credit_cost, v_available_credits;
  END IF;

  -- Reserve credits via ledger (creates 'reserved' transaction)
  SELECT id INTO v_credit_transaction_id
  FROM lock_credits_for_session(
    p_user_id,
    v_class_record.credit_cost,
    NULL -- No session_id for live classes, can be NULL or use a special identifier
  );

  -- Create attendance record
  INSERT INTO live_class_attendance (class_id, user_id, paid_status, credit_transaction_id)
  VALUES (p_class_id, p_user_id, 'reserved', v_credit_transaction_id)
  ON CONFLICT (class_id, user_id) DO UPDATE
  SET paid_status = 'reserved',
      credit_transaction_id = v_credit_transaction_id,
      created_at = NOW();

  RETURN v_credit_transaction_id;
END;
$$;

-- Function to leave a live class (unlocks credits if before class starts)
-- Note: p_user_id should be the profiles.id (not profiles.user_id)
CREATE OR REPLACE FUNCTION leave_live_class(
  p_class_id UUID,
  p_user_id UUID -- This is profiles.id
)
RETURNS UUID -- Returns unlock transaction_id
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_class_record RECORD;
  v_attendance_record RECORD;
  v_unlock_transaction_id UUID;
  v_user_profile_id UUID; -- profiles.user_id for credit functions
BEGIN
  -- Get user's auth user_id from profiles
  SELECT user_id INTO v_user_profile_id
  FROM profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Get class details
  SELECT * INTO v_class_record
  FROM live_classes
  WHERE id = p_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  -- Get attendance record
  SELECT * INTO v_attendance_record
  FROM live_class_attendance
  WHERE class_id = p_class_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User has not joined this class';
  END IF;

  -- Only allow leaving if class hasn't started yet
  IF v_class_record.status = 'live' THEN
    RAISE EXCEPTION 'Cannot leave a class that is already in progress';
  END IF;

  -- Unlock credits if they were reserved
  IF v_attendance_record.paid_status = 'reserved' AND v_attendance_record.credit_transaction_id IS NOT NULL THEN
    SELECT id INTO v_unlock_transaction_id
    FROM unlock_credits_from_session(
      v_user_profile_id, -- Use auth.users user_id
      v_class_record.credit_cost,
      NULL
    );
  END IF;

  -- Update attendance status
  UPDATE live_class_attendance
  SET paid_status = 'cancelled',
      left_at = NOW()
  WHERE class_id = p_class_id AND user_id = p_user_id;

  RETURN v_unlock_transaction_id;
END;
$$;

-- Function to complete a live class (transfer credits from attendees to host)
CREATE OR REPLACE FUNCTION complete_live_class(
  p_class_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_class_record RECORD;
  v_attendee_record RECORD;
  v_transfer_result JSON;
  v_completed_count INT := 0;
  v_host_user_id UUID; -- auth.users user_id for host
  v_host_user_id UUID; -- auth.users user_id for host
  v_attendee_user_id UUID; -- auth.users user_id for attendee
BEGIN
  -- Get class details
  SELECT * INTO v_class_record
  FROM live_classes
  WHERE id = p_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  -- Get host's auth user_id
  SELECT user_id INTO v_host_user_id
  FROM profiles
  WHERE id = v_class_record.host_id;

  -- Only host can complete
  IF v_host_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the host can complete a class';
  END IF;

  -- Process each attendee: convert reserved to spent, and transfer to host
  FOR v_attendee_record IN
    SELECT lca.*, p.user_id as attendee_auth_user_id
    FROM live_class_attendance lca
    JOIN profiles p ON lca.user_id = p.id
    WHERE lca.class_id = p_class_id
    AND lca.paid_status = 'reserved'
  LOOP
    -- Transfer credits from attendee to host (using auth.users user_id)
    PERFORM transfer_credits(
      v_attendee_record.attendee_auth_user_id, -- learner_id (auth.users user_id)
      v_host_user_id,                          -- teacher_id (auth.users user_id)
      v_class_record.credit_cost,
      NULL, -- No session_id for live classes
      'Live class: ' || v_class_record.title
    );

    -- Update attendance status to paid
    UPDATE live_class_attendance
    SET paid_status = 'paid',
        joined_at = COALESCE(joined_at, NOW())
    WHERE class_id = p_class_id AND user_id = v_attendee_record.user_id;

    v_completed_count := v_completed_count + 1;
  END LOOP;

  -- Update class status
  UPDATE live_classes
  SET status = 'completed',
      updated_at = NOW()
  WHERE id = p_class_id;

  RETURN json_build_object(
    'class_id', p_class_id,
    'completed_attendees', v_completed_count,
    'total_credits_transferred', v_completed_count * v_class_record.credit_cost
  );
END;
$$;

-- ============================================
-- Step 6: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION join_live_class(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_live_class(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_live_class(UUID) TO authenticated;
