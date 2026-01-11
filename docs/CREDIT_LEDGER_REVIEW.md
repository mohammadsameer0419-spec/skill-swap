# Credit Ledger System - Design Review

## Overview

The credit system uses a **ledger-based approach** instead of storing a single balance. Every credit change is recorded as a transaction, providing:
- Full audit trail
- Prevention of double-spending
- Ability to reconstruct balance at any point in time
- Transaction locking for active sessions

## Table Structure

### `credit_transactions` Table

```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,              -- User whose credits changed
  type TEXT NOT NULL,                  -- Transaction type (see below)
  amount INTEGER NOT NULL,             -- Amount (positive or negative)
  balance_after INTEGER NOT NULL,      -- Balance after this transaction
  session_id UUID,                     -- Related session (if applicable)
  related_transaction_id UUID,         -- Linked transaction (for refunds)
  description TEXT,                    -- Human-readable description
  created_at TIMESTAMPTZ NOT NULL
);
```

## Transaction Types

1. **'earned'** - User earned credits from teaching (positive amount)
2. **'spent'** - User spent credits on learning (negative amount)
3. **'refund'** - Credits refunded from cancellation (positive amount)
4. **'adjustment'** - Admin adjustment (positive or negative)
5. **'locked'** - Credits locked for active session (negative amount)
6. **'unlocked'** - Credits unlocked from session (positive amount)

## How It Works

### Getting Balance
Balance is calculated by summing all transaction amounts for a user:
```sql
SELECT SUM(amount) FROM credit_transactions WHERE user_id = ?
```

### Locking Credits
When a session is requested:
1. Create 'locked' transaction (negative amount)
2. Reduces available balance
3. Credits cannot be spent elsewhere
4. Locked credits shown as separate from available

### Transferring Credits
When session completes:
1. Create 'spent' transaction for learner (negative)
2. Create 'earned' transaction for teacher (positive)
3. Unlock any locked credits
4. Both transactions linked to session_id

### Cancellation/Refund
When session is cancelled:
1. Create 'unlocked' transaction (reverses the lock)
2. Optionally create 'refund' transaction if credits were already transferred
3. Credits return to available balance

## Key Design Decisions

### Why Ledger Instead of Balance Column?

**Problems with balance column:**
- Race conditions (two transactions happening simultaneously)
- No audit trail
- Hard to debug issues
- Cannot see credit history
- Double-spending possible

**Benefits of ledger:**
- Atomic transactions prevent race conditions
- Full history of all credit movements
- Can reconstruct balance at any point in time
- Can audit suspicious activity
- Transaction locking prevents double-spending

### Balance Calculation

Balance is calculated dynamically, not stored:
- **Available Balance**: SUM(amount) where amount != 0
- **Locked Balance**: SUM(amount) where type = 'locked'
- **Total Earned**: SUM(amount) where type = 'earned'
- **Total Spent**: ABS(SUM(amount) where type = 'spent')

### Indexes

- `idx_credit_transactions_user` - Fast balance queries (user_id, created_at DESC)
- `idx_credit_transactions_session` - Link transactions to sessions
- `idx_credit_transactions_type` - Filter by transaction type

### Constraints

- `valid_amount CHECK (amount != 0)` - Prevents zero transactions
- `user_id` foreign key ensures referential integrity
- `session_id` foreign key links to sessions

## Example Transaction Flow

### User receives 10 initial credits
```
type: 'adjustment', amount: +10, balance_after: 10
```

### User requests session (5 credits)
```
type: 'locked', amount: -5, balance_after: 5
```

### Session completes
```
type: 'unlocked', amount: +5, balance_after: 10
type: 'spent', amount: -5, balance_after: 5
(teacher) type: 'earned', amount: +5, balance_after: 15
```

### Session cancelled before completion
```
type: 'unlocked', amount: +5, balance_after: 10
```

## Security Considerations

1. **RLS Policy**: Users can only view their own transactions
2. **No Direct Inserts**: Transactions created via RPC functions only
3. **Validation**: All transactions validated before insertion
4. **Atomicity**: Transactions wrapped in database transactions

## Performance Considerations

- Index on (user_id, created_at DESC) allows fast balance queries
- SUM() aggregation is efficient with proper indexes
- Consider caching balance if query frequency is very high
- Partition by date if transaction volume becomes massive

## Questions for Review

1. **Transaction Types**: Are all needed types included?
2. **Locking Mechanism**: Should we track locked vs available separately?
3. **Balance Calculation**: Is SUM() efficient enough, or need materialized view?
4. **Refunds**: Do we need separate 'refund' type or use 'adjustment'?
5. **Related Transactions**: Is related_transaction_id needed for refund linking?
