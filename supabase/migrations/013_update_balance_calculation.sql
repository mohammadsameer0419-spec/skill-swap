-- ============================================
-- Update Balance Calculation Functions
-- ============================================
-- Implements the correct balance calculation:
-- - Total Credits: The raw balance (sum of ALL transactions)
-- - Available to Spend: Total Credits - Reserved Credits
--
-- This migration updates existing functions to match the specification

-- ============================================
-- Update: Get User Credit Balance Detailed
-- ============================================
-- Returns: { total, available, reserved }
-- Where: 
--   - total: Total Credits (raw balance, sum of ALL transactions)
--   - reserved: Reserved Credits (sum of reserved/pending transactions)
--   - available: Available to Spend (Total - Reserved)
CREATE OR REPLACE FUNCTION get_user_credit_balance_detailed(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_reserved INTEGER;
  v_available INTEGER;
  v_result JSON;
BEGIN
  -- Total Credits: The raw balance (sum of ALL transactions)
  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM credit_transactions
  WHERE user_id = p_user_id;
  
  -- Reserved Credits: Sum of reserved/pending transactions
  -- Use ABS() since reserved transactions have negative amounts
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_reserved
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND status IN ('reserved', 'pending');
  
  -- Available to Spend: Total - Reserved
  v_available := v_total - v_reserved;
  
  -- Build result JSON
  v_result := json_build_object(
    'total', v_total,          -- Total Credits: The raw balance
    'available', v_available,  -- Available to Spend: Total - Reserved
    'reserved', v_reserved     -- Reserved Credits
  );
  
  RETURN v_result;
END;
$$;

-- Update comment
COMMENT ON FUNCTION get_user_credit_balance_detailed IS 
'Returns detailed credit balance:
- total: Total Credits (raw balance, sum of all transactions)
- available: Available to Spend (Total - Reserved)
- reserved: Reserved Credits (sum of reserved/pending transactions)';

-- Grant execute permission (if not already granted)
GRANT EXECUTE ON FUNCTION get_user_credit_balance_detailed(UUID) TO authenticated;
