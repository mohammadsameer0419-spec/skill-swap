# Migration Guide: Demo to Production

## Overview

This guide explains the transformation from the demo app to the production-ready Micro Skill Swap App.

## What Changed

### Database Schema

**Old Schema:**
- Simple `profiles` table with `credits` as a number
- Basic `skills` table
- `credit_exchanges` table (simple)
- No session management
- No reviews or reputation
- No certificates

**New Schema:**
- Enhanced `profiles` with reputation system
- `skill_categories` for taxonomy
- Enhanced `skills` with proper relationships
- `skill_sessions` for full lifecycle management
- `credit_transactions` ledger system
- `reviews` for bi-directional reviews
- `certificates` for immutable records

### Credit System

**Old Approach:**
- Credits stored as integer in profiles table
- Simple increment/decrement operations
- No audit trail

**New Approach:**
- Ledger-based system (`credit_transactions` table)
- Every credit change is a transaction
- Full audit trail
- Locking mechanism during sessions
- Can reconstruct balance at any point in time

### Session Management

**Old Approach:**
- Direct credit exchange via RPC
- No session tracking
- No lifecycle management

**New Approach:**
- Full session lifecycle (requested → accepted → scheduled → in_progress → completed)
- Credit locking during active sessions
- Proper state transitions
- Cancellation handling with refunds

## Migration Steps

### 1. Backup Existing Data
```sql
-- Export existing data before migration
-- This is critical if you have production data
```

### 2. Apply Migrations in Order
1. Run `001_initial_schema.sql`
2. Run `002_rls_policies.sql`
3. Run `003_credit_ledger_functions.sql`
4. Run `004_session_management_functions.sql`
5. Run `005_review_reputation_functions.sql`
6. Run `006_certificate_functions.sql`

### 3. Migrate Existing Data (if needed)
If you have existing data, create a migration script to:
- Migrate existing credits to ledger system
- Create initial credit transactions
- Update any existing sessions

### 4. Update Application Code
- Update TypeScript types
- Update service layer
- Update frontend components
- Test thoroughly

## Breaking Changes

1. **Credit System**: Old code that directly modifies `profiles.credits` will break
2. **Session Model**: Old `credit_exchanges` table replaced with `skill_sessions`
3. **API Changes**: All credit operations now go through RPC functions
4. **Review System**: New requirement for bi-directional reviews

## Backward Compatibility

The migrations create new tables and functions without removing old ones initially. This allows:
- Gradual migration
- Testing new system alongside old
- Data migration scripts to run

After full migration, old tables can be dropped.

## Testing Checklist

- [ ] Users can create profiles
- [ ] Users can create skills
- [ ] Users can request sessions
- [ ] Teachers can accept sessions
- [ ] Sessions can be scheduled
- [ ] Sessions can be completed
- [ ] Credits transfer correctly
- [ ] Reviews can be created
- [ ] Reputation updates correctly
- [ ] Certificates can be generated
- [ ] RLS policies work correctly
- [ ] No unauthorized data access

## Rollback Plan

If issues occur:
1. Keep old tables/functions intact during initial deployment
2. Have rollback scripts ready
3. Monitor error rates and user feedback
4. Fix issues in new system rather than rolling back if possible
