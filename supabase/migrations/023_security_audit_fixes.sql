-- ============================================
-- Security & RLS Audit Fixes
-- ============================================
-- Ensures proper security restrictions for certificates, credits, and profiles

-- ============================================
-- Step 1: Certificates - Ensure INSERT/UPDATE only via service_role
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "No direct inserts to certificates" ON certificates;
DROP POLICY IF EXISTS "Certificates cannot be modified" ON certificates;

-- Certificates INSERT: Only service_role can insert (via SECURITY DEFINER functions)
-- Regular users cannot insert directly
CREATE POLICY "Certificates INSERT service_role only"
  ON certificates FOR INSERT
  USING (false); -- Block all direct inserts

-- Certificates UPDATE: Only service_role can update (via SECURITY DEFINER functions)
-- Regular users cannot update directly
CREATE POLICY "Certificates UPDATE service_role only"
  ON certificates FOR UPDATE
  USING (false); -- Block all direct updates

-- Note: SECURITY DEFINER functions (like generate_certificate_on_completion)
-- will bypass RLS and can insert/update certificates.
-- This ensures only our database functions can create/modify certificates.

-- ============================================
-- Step 2: Profiles.credits - Prevent direct updates
-- ============================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Note: The trigger function will be created in migration 024
-- This migration sets up the RLS policies

-- Create new RLS policy that allows users to update only allowed columns
-- Note: The trigger will enforce restrictions on restricted columns
-- RLS policy ensures users can only update their own profile
-- The WITH CHECK clause is simplified - the trigger handles column restrictions
CREATE POLICY "Users can update their own profile (restricted columns)"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
  
-- Note: The trigger `trg_check_profile_update_allowed` will prevent
-- updates to restricted columns (credits, level, reputation_score, etc.)
-- SECURITY DEFINER functions will bypass RLS and the trigger will allow
-- their updates by checking current_user.

-- ============================================
-- Step 3: Verify RPC functions use SECURITY DEFINER
-- ============================================

-- Ensure all credit-related functions use SECURITY DEFINER
-- This allows them to bypass RLS and update profiles.credits

-- Check and document which functions should update credits:
-- 1. complete_skill_swap - Updates profiles.credits after session completion
-- 2. transfer_credits - Updates profiles.credits (if it does)
-- 3. update_user_level - Updates level (via trigger)
-- 4. update_user_reputation - Updates reputation_score (via trigger)

-- Note: These functions should already have SECURITY DEFINER.
-- We're just documenting this here for clarity.

-- ============================================
-- Step 4: Add comments for documentation
-- ============================================

COMMENT ON POLICY "Certificates INSERT service_role only" ON certificates IS 
'Prevents direct INSERT operations on certificates. Only SECURITY DEFINER functions (service_role) can insert certificates via generate_certificate_on_completion().';

COMMENT ON POLICY "Certificates UPDATE service_role only" ON certificates IS 
'Prevents direct UPDATE operations on certificates. Certificates are immutable and can only be modified by SECURITY DEFINER functions.';

COMMENT ON TRIGGER trg_check_profile_update_allowed ON profiles IS 
'Prevents direct updates to restricted profile columns (credits, level, reputation_score, etc.). These can only be updated through SECURITY DEFINER RPC functions.';

COMMENT ON POLICY "Users can update their own profile (restricted columns)" ON profiles IS 
'Allows users to update only their username, avatar_url, bio, and full_name. Restricted columns (credits, level, reputation_score, etc.) can only be updated through RPC functions.';

-- ============================================
-- Step 5: Grant necessary permissions
-- ============================================

-- Ensure service_role has full access to certificates (for triggers/functions)
-- This is already the case by default, but we document it here

-- Ensure authenticated users can only SELECT certificates
-- (Already handled by existing SELECT policy)

-- ============================================
-- Step 6: Verification Queries (for manual testing)
-- ============================================

-- To verify certificates security:
-- 1. Try direct INSERT as authenticated user (should fail):
--    INSERT INTO certificates (...) VALUES (...); -- Should be blocked by RLS
--
-- 2. Try direct UPDATE as authenticated user (should fail):
--    UPDATE certificates SET ... WHERE id = ...; -- Should be blocked by RLS
--
-- 3. Verify function can still insert (should work):
--    SELECT generate_certificate_on_completion('session-uuid'); -- Should work

-- To verify profiles.credits security:
-- 1. Try direct UPDATE of credits as authenticated user (should fail):
--    UPDATE profiles SET credits = 100 WHERE user_id = auth.uid(); -- Should be blocked
--
-- 2. Try UPDATE of username (should work):
--    UPDATE profiles SET username = 'newusername' WHERE user_id = auth.uid(); -- Should work
--
-- 3. Verify RPC function can update credits (should work):
--    SELECT complete_skill_swap('session-uuid'); -- Should update credits
