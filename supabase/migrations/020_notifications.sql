-- ============================================
-- Notifications System
-- ============================================
-- Real-time notifications for user events

-- ============================================
-- Step 1: Create Notifications Table
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Notification content
  type TEXT NOT NULL CHECK (type IN (
    'class_starting_soon',
    'new_skill_match',
    'level_up',
    'credit_transaction',
    'session_request',
    'session_accepted',
    'session_completed',
    'review_received'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Related entities (optional)
  related_id UUID, -- Can reference class_id, skill_id, session_id, etc.
  related_type TEXT, -- 'live_class', 'skill', 'session', etc.
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  read_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB, -- Additional data (e.g., credit amount, level name)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_type, related_id) WHERE related_id IS NOT NULL;

-- ============================================
-- Step 2: Row Level Security Policies
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- System can insert notifications (via RPC functions)
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- RPC functions will validate user_id

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- ============================================
-- Step 3: Helper Functions
-- ============================================

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- Validate notification type
  IF p_type NOT IN (
    'class_starting_soon',
    'new_skill_match',
    'level_up',
    'credit_transaction',
    'session_request',
    'session_accepted',
    'session_completed',
    'review_received'
  ) THEN
    RAISE EXCEPTION 'Invalid notification type: %', p_type;
  END IF;

  -- Insert notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    related_id,
    related_type,
    metadata
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_related_id,
    p_related_type,
    p_metadata
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify user owns this notification
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE id = p_notification_id
    AND user_id = (SELECT user_id FROM profiles WHERE user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Notification not found or access denied';
  END IF;

  -- Mark as read
  UPDATE notifications
  SET 
    is_read = TRUE,
    read_at = NOW()
  WHERE id = p_notification_id;

  RETURN TRUE;
END;
$$;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_user_id UUID
)
RETURNS INTEGER -- Returns count of notifications marked as read
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify user is updating their own notifications
  IF p_user_id != (SELECT user_id FROM profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Can only mark your own notifications as read';
  END IF;

  -- Mark all unread notifications as read
  UPDATE notifications
  SET 
    is_read = TRUE,
    read_at = NOW()
  WHERE user_id = p_user_id
  AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to get unread count
CREATE OR REPLACE FUNCTION get_unread_notification_count(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = p_user_id
  AND is_read = FALSE;

  RETURN v_count;
END;
$$;

-- ============================================
-- Step 4: Grant Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count(UUID) TO authenticated;

-- ============================================
-- Step 5: Triggers for Automatic Notifications
-- ============================================

-- Trigger: Level Up Notification
CREATE OR REPLACE FUNCTION trigger_level_up_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_level TEXT;
  v_new_level TEXT;
  v_level_names JSONB := '{"beginner": "Beginner", "learner": "Learner", "skilled": "Skilled", "advanced": "Advanced", "expert": "Expert"}'::JSONB;
BEGIN
  -- Only trigger if level actually increased
  IF NEW.level != OLD.level AND NEW.level::TEXT > OLD.level::TEXT THEN
    v_old_level := OLD.level::TEXT;
    v_new_level := NEW.level::TEXT;
    
    -- Create level up notification
    PERFORM create_notification(
      NEW.user_id,
      'level_up',
      '🎉 Level Up!',
      'Congratulations! You''ve reached ' || (v_level_names->>v_new_level) || ' level!',
      NULL,
      NULL,
      jsonb_build_object(
        'old_level', v_old_level,
        'new_level', v_new_level,
        'level_name', v_level_names->>v_new_level
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_level_up_notification
  AFTER UPDATE OF level ON profiles
  FOR EACH ROW
  WHEN (NEW.level != OLD.level)
  EXECUTE FUNCTION trigger_level_up_notification();

-- Trigger: Credit Transaction Notification (for earned/spent)
CREATE OR REPLACE FUNCTION trigger_credit_transaction_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_transaction_type TEXT;
BEGIN
  -- Check both status (ENUM) and type (TEXT) columns
  -- Status is the primary indicator (ENUM: 'earned', 'spent', 'reserved', 'cancelled')
  -- Type is legacy (TEXT: 'earned', 'spent', 'refund', 'adjustment', 'locked', 'unlocked')
  
  -- Determine transaction type from status or type column
  IF NEW.status IN ('earned', 'spent') THEN
    v_transaction_type := NEW.status::TEXT;
  ELSIF NEW.type IN ('earned', 'spent') THEN
    v_transaction_type := NEW.type;
  ELSE
    -- Not a transaction we want to notify about
    RETURN NEW;
  END IF;

  -- Only notify for earned and spent transactions
  IF v_transaction_type = 'earned' THEN
    v_title := '💰 Credits Earned';
    v_message := 'You earned ' || ABS(NEW.amount) || ' credits!';
  ELSIF v_transaction_type = 'spent' THEN
    v_title := '💳 Credits Spent';
    v_message := 'You spent ' || ABS(NEW.amount) || ' credits.';
  ELSE
    RETURN NEW;
  END IF;

  -- Create notification
  PERFORM create_notification(
    NEW.user_id,
    'credit_transaction',
    v_title,
    v_message,
    NEW.id,
    'credit_transaction',
    jsonb_build_object(
      'amount', NEW.amount,
      'type', v_transaction_type,
      'balance_after', NEW.balance_after
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_transaction_notification
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  WHEN (
    NEW.status IN ('earned', 'spent') OR 
    NEW.type IN ('earned', 'spent')
  )
  EXECUTE FUNCTION trigger_credit_transaction_notification();

-- Note: Class starting soon and skill match notifications
-- will be created via RPC functions or scheduled jobs
-- (not via triggers, as they require more complex logic)
