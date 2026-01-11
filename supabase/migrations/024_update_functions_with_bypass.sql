-- ============================================
-- Update SECURITY DEFINER Functions to Set Bypass Flag
-- ============================================
-- Ensures functions that need to update restricted profile columns
-- set a session variable to bypass the trigger check

-- ============================================
-- Step 1: Update complete_skill_swap to set bypass flag
-- ============================================
-- This function updates profiles.credits, so it needs to bypass the trigger

-- We'll update the function to set the bypass flag before updating profiles
-- Note: This requires modifying the function to include the session variable setting

-- Actually, a better approach is to modify the trigger to check if we're
-- in a SECURITY DEFINER function context. Since SECURITY DEFINER functions
-- run with elevated privileges, we can check the current role.

-- Let's use a simpler approach: Check if the function is SECURITY DEFINER
-- by checking if we can access pg_proc and see the function's security setting

-- Actually, the simplest and most secure approach is to just rely on RLS
-- and let SECURITY DEFINER functions bypass it naturally. The trigger
-- will still fire, but we can check the calling context differently.

-- Revised approach: Remove the bypass check from trigger, and instead
-- rely on RLS policy WITH CHECK clause to prevent updates to restricted columns.
-- SECURITY DEFINER functions will bypass RLS entirely.

-- However, triggers still run even for SECURITY DEFINER functions.
-- So we need a way to distinguish.

-- Best approach: Use a session variable that SECURITY DEFINER functions set.
-- But we need to update all the functions. Let's document this instead
-- and provide a helper function.

-- ============================================
-- Step 2: Create helper function for SECURITY DEFINER functions
-- ============================================
CREATE OR REPLACE FUNCTION set_profile_update_bypass()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set session variable to allow profile updates
  PERFORM set_config('app.bypass_profile_restrictions', 'true', false);
END;
$$;

-- ============================================
-- Step 3: Update complete_skill_swap to use bypass
-- ============================================
-- Note: This requires modifying the existing function
-- We'll create a wrapper or update the function directly

-- Actually, let's take a different approach: Modify the trigger to be smarter
-- about detecting SECURITY DEFINER context. We can check if the current
-- function being executed is SECURITY DEFINER.

-- Final approach: Use pg_backend_pid() and check the current function context
-- But this is complex. Let's use a simpler method:

-- Check if we're the postgres superuser or service_role
-- SECURITY DEFINER functions run as the function owner (usually postgres)
-- So we can check current_user

-- Create trigger function to prevent direct updates to restricted columns
-- SECURITY DEFINER functions will bypass RLS, but this trigger provides an additional safety check
CREATE OR REPLACE FUNCTION check_profile_update_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_user TEXT;
  v_is_security_definer BOOLEAN := FALSE;
BEGIN
  -- Get current database user
  -- SECURITY DEFINER functions run as the function owner (typically 'postgres' or 'supabase_admin')
  -- Regular users run as 'authenticated' or 'anon'
  v_current_user := current_user;
  
  -- Check if we're running as a privileged user (function owner)
  -- In Supabase, SECURITY DEFINER functions are owned by 'postgres' or 'supabase_admin'
  -- This means when a SECURITY DEFINER function executes, current_user will be the function owner
  IF v_current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    -- This is a SECURITY DEFINER function context, allow the update
    RETURN NEW;
  END IF;
  
  -- If not in SECURITY DEFINER context, check if restricted columns are being changed
  IF (
    OLD.credits IS DISTINCT FROM NEW.credits OR
    OLD.level IS DISTINCT FROM NEW.level OR
    OLD.reputation_score IS DISTINCT FROM NEW.reputation_score OR
    OLD.completed_sessions IS DISTINCT FROM NEW.completed_sessions OR
    OLD.total_reviews IS DISTINCT FROM NEW.total_reviews OR
    (OLD.experience_points IS DISTINCT FROM NEW.experience_points AND NEW.experience_points IS NOT NULL) OR
    OLD.level_progress IS DISTINCT FROM NEW.level_progress OR
    OLD.level_unlocked_at IS DISTINCT FROM NEW.level_unlocked_at
  ) THEN
    RAISE EXCEPTION 'Direct updates to credits, level, reputation_score, completed_sessions, total_reviews, experience_points, level_progress, or level_unlocked_at are not allowed. These can only be updated through RPC functions with SECURITY DEFINER.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger with the updated function
DROP TRIGGER IF EXISTS trg_check_profile_update_allowed ON profiles;
CREATE TRIGGER trg_check_profile_update_allowed
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_profile_update_allowed();
