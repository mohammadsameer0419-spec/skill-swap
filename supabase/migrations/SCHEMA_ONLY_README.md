# Database Schema Migrations (Schema Only)

This directory contains **schema-only migrations** (tables, indexes, RLS policies) for review.

## Files to Review

### 1. `001_initial_schema.sql`
Contains all table definitions including:
- **profiles** - User profiles with reputation
- **skill_categories** - Skill taxonomy
- **skills** - Skills offered by users
- **skill_sessions** - Session lifecycle management
- **credit_transactions** - **Ledger-based credit system** ⭐ (Review Focus)
- **reviews** - Bi-directional reviews
- **certificates** - Immutable certificates

### 2. `002_rls_policies.sql`
Row Level Security policies for all tables.

## Review Focus: Credit Ledger System

The **credit_transactions** table implements a ledger-based credit system. Key features:

- Every credit change is a transaction
- Balance calculated by summing transactions (not stored)
- Transaction types: earned, spent, refund, adjustment, locked, unlocked
- Prevents double-spending via transaction locking
- Full audit trail

See `docs/CREDIT_LEDGER_REVIEW.md` for detailed explanation.

## What's NOT Included (Yet)

These will be created after schema review:
- RPC functions for credit operations (003_credit_ledger_functions.sql)
- Session management functions (004_session_management_functions.sql)
- Review functions (005_review_reputation_functions.sql)
- Certificate functions (006_certificate_functions.sql)

## Next Steps

1. Review `001_initial_schema.sql` - especially `credit_transactions` table
2. Review `002_rls_policies.sql` - security policies
3. Check indexes for performance
4. Verify constraints and foreign keys
5. Once approved, functions will be created
