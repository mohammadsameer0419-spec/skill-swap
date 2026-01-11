-- ============================================
-- Add Initial Credit Grant to Onboarding Completion
-- ============================================
-- Grants 5 initial credits when user completes all required onboarding steps

-- ============================================
-- Step 1: Update complete_onboarding_step function
-- ============================================
CREATE OR REPLACE FUNCTION complete_onboarding_step(
  p_user_id UUID,
  p_step_key TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_step_id UUID;
  v_existing_id UUID;
  v_total_required_steps INTEGER;
  v_completed_required_steps INTEGER;
  v_is_complete BOOLEAN;
  v_already_granted BOOLEAN;
  v_current_credits INTEGER;
  v_new_credits INTEGER;
BEGIN
  -- Check if step exists
  IF NOT EXISTS (SELECT 1 FROM onboarding_steps WHERE step_key = p_step_key) THEN
    RAISE EXCEPTION 'Onboarding step not found: %', p_step_key;
  END IF;
  
  -- Check if already completed (idempotent)
  SELECT id INTO v_existing_id
  FROM user_onboarding_progress
  WHERE user_id = p_user_id AND step_key = p_step_key;
  
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;
  
  -- Mark step as completed
  INSERT INTO user_onboarding_progress (user_id, step_key, metadata)
  VALUES (p_user_id, p_step_key, p_metadata)
  RETURNING id INTO v_step_id;
  
  -- Check if onboarding is now complete (all required steps completed)
  SELECT COUNT(*) INTO v_total_required_steps
  FROM onboarding_steps
  WHERE is_required = TRUE;
  
  SELECT COUNT(*) INTO v_completed_required_steps
  FROM user_onboarding_progress uop
  INNER JOIN onboarding_steps os ON uop.step_key = os.step_key
  WHERE uop.user_id = p_user_id AND os.is_required = TRUE;
  
  v_is_complete := (v_completed_required_steps >= v_total_required_steps);
  
  -- If onboarding is complete, grant initial credits (5 credits)
  IF v_is_complete THEN
    -- Check if credits have already been granted (idempotency)
    SELECT EXISTS (
      SELECT 1 FROM credit_transactions
      WHERE user_id = p_user_id
        AND description LIKE 'Initial credit grant%'
        AND status = 'earned'
    ) INTO v_already_granted;
    
    -- Only grant if not already granted
    IF NOT v_already_granted THEN
      -- Get current credits balance
      SELECT COALESCE(credits, 0) INTO v_current_credits
      FROM profiles
      WHERE user_id = p_user_id;
      
      v_new_credits := v_current_credits + 5;
      
      -- Insert credit transaction (earned)
      INSERT INTO credit_transactions (
        user_id,
        type,
        amount,
        balance_after,
        status,
        description
      ) VALUES (
        p_user_id,
        'earned',
        5, -- Positive amount for initial grant
        v_new_credits,
        'earned', -- ENUM status
          'Initial credit grant - Welcome to Skill Swap!'
      );
      
      -- Update profiles.credits balance
      UPDATE profiles
      SET credits = v_new_credits,
          updated_at = NOW()
      WHERE user_id = p_user_id;
    END IF;
  END IF;
  
  RETURN v_step_id;
END;
$$;

-- ============================================
-- Step 2: Grant Permissions (if needed)
-- ============================================
-- Function already has permissions from 017_onboarding_and_resources_functions.sql
-- This migration just updates the function definition

-- ============================================
-- Step 3: Comments
-- ============================================
COMMENT ON FUNCTION complete_onboarding_step IS 
'Completes an onboarding step and grants 5 initial credits when all required steps are complete. Idempotent - will not grant credits twice.';
