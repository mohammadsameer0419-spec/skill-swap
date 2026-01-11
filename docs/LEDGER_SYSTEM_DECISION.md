# Credit System Decision: Ledger-Only (Option B)

## Decision: Ledger-Based System

We are using **Option B: Ledger-Only System** - credits are stored exclusively in the `credit_transactions` table with no `credits` column in the `profiles` table.

## Schema Verification

### ✅ Profiles Table
- **NO `credits` column** - confirmed in `001_initial_schema.sql` (lines 13-29)
- Only contains: id, user_id, username, full_name, avatar_url, bio, reputation_score, total_reviews, completed_sessions
- Credits balance is calculated dynamically from transactions

### ✅ Credit Transactions Table
- Contains all credit movements (lines 127-157 in `001_initial_schema.sql`)
- Transaction types: earned, spent, refund, adjustment, locked, unlocked
- Each transaction has: user_id, type, amount, balance_after, session_id, description
- Full audit trail of all credit changes

### ✅ Balance Calculation
Balance is calculated by summing all transactions:
```sql
SELECT COALESCE(SUM(amount), 0) 
FROM credit_transactions 
WHERE user_id = ?
```

## Migration Impact

### Old Function (`handle_skill_exchange.sql`)
- ❌ References `profiles.credits` (column doesn't exist)
- ❌ Does not create audit trail in `credit_transactions`
- **Status**: Needs to be replaced/updated

### New Functions (to be created)
- Will use `credit_transactions` table exclusively
- Will create audit records for all operations
- Balance checked by summing transactions
- Use functions from `003_credit_ledger_functions.sql` as reference

## Benefits of Option B

1. **Full Audit Trail**: Every credit change is recorded
2. **No Race Conditions**: Transaction-based prevents double-spending
3. **Historical Data**: Can reconstruct balance at any point in time
4. **Debugging**: Easy to trace credit issues
5. **Compliance**: Better for financial records/auditing

## Next Steps

1. ✅ Schema is correct (no profiles.credits column)
2. ✅ credit_transactions table is properly defined
3. ⏳ Update/replace `handle_skill_exchange` function to use ledger
4. ⏳ Create new RPC functions that work with ledger system
5. ⏳ Test credit operations with new system

## Important Notes

- The existing `handle_skill_exchange.sql` function **will not work** with the new schema
- All credit operations must go through the ledger system
- Balance is always calculated dynamically (not stored)
- Functions will be created in separate migration file (003_credit_ledger_functions.sql)
