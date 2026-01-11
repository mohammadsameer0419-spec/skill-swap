# handle_skill_exchange Function Review

## Current Implementation Analysis

The existing `handle_skill_exchange` function (in `handle_skill_exchange.sql`) was created before the ledger-based credit system was designed.

### What It Currently Does

1. ✅ **Runs in a Transaction**
   - PL/pgSQL functions run in implicit transactions
   - All operations are atomic (all succeed or all fail)

2. ✅ **Checks User's Current Balance**
   - Lines 21-32: Checks learner balance from `profiles.credits`
   - Lines 35-42: Checks teacher balance from `profiles.credits`
   - Uses `FOR UPDATE` to lock rows and prevent race conditions

3. ✅ **Updates profiles.credits Balance**
   - Lines 49-53: Subtracts 1 credit from learner
   - Lines 55-59: Adds 1 credit to teacher

4. ❌ **Does NOT Create credit_transactions Records**
   - No audit trail is created
   - No records in `credit_transactions` table

## Problem: Schema Mismatch

**The new schema (`001_initial_schema.sql`) does NOT include a `credits` column in the `profiles` table!**

The ledger-based system stores credits ONLY in the `credit_transactions` table. Balance is calculated dynamically by summing transactions.

The old function references `profiles.credits` which doesn't exist in the new schema.

## Required Changes

The function needs to be updated to:

1. ✅ Create rows in `credit_transactions` (audit trail)
2. ✅ Check balance by summing `credit_transactions` (not `profiles.credits`)
3. ❌ **NOT** update `profiles.credits` (this column doesn't exist in new schema)

## What Should Happen (Ledger-Based)

Instead of:
```sql
UPDATE profiles SET credits = credits - 1 WHERE user_id = learner_id;
UPDATE profiles SET credits = credits + 1 WHERE user_id = teacher_id;
```

Should be:
```sql
-- Record transaction for learner
INSERT INTO credit_transactions (user_id, type, amount, balance_after, ...)
VALUES (learner_id, 'spent', -1, new_balance, ...);

-- Record transaction for teacher  
INSERT INTO credit_transactions (user_id, type, amount, balance_after, ...)
VALUES (teacher_id, 'earned', +1, new_balance, ...);
```

Balance is then calculated: `SELECT SUM(amount) FROM credit_transactions WHERE user_id = ?`

## Recommendation

1. **Remove** `profiles.credits` column (if it exists from old schema)
2. **Update** `handle_skill_exchange` to use ledger system
3. **Or** use the new `transfer_credits()` function from `003_credit_ledger_functions.sql`

## Decision Needed

Do you want to:
- **Option A**: Keep `profiles.credits` column (simpler, but no audit trail)
- **Option B**: Use ledger-only system (new schema approach, full audit trail)

The new schema implements Option B (ledger-only), which is more robust for production.
