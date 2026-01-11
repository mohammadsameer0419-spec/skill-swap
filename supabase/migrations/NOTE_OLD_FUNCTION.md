# Note: Old Function Incompatibility

## ⚠️ Important

The file `handle_skill_exchange.sql` contains an **old function** that is **incompatible** with the new ledger-based schema.

## Why It's Incompatible

The old function:
- References `profiles.credits` column (doesn't exist in new schema)
- Does not create audit trail in `credit_transactions`
- Uses the old "balance column" approach

The new schema:
- Uses ledger-only system (no `profiles.credits` column)
- Requires all credit changes to be in `credit_transactions`
- Balance calculated by summing transactions

## What To Do

1. **Do NOT apply** `handle_skill_exchange.sql` with the new schema
2. **Delete or archive** `handle_skill_exchange.sql` 
3. **Use** the new functions from `003_credit_ledger_functions.sql` instead

## Replacement

The old function will be replaced by:
- `transfer_credits()` function (in 003_credit_ledger_functions.sql)
- Or a new session-based flow (in 004_session_management_functions.sql)

These new functions properly use the ledger system and create audit trails.
