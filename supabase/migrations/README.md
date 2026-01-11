# Database Migrations

## Overview

This directory contains production-ready database migrations for the Micro Skill Swap App. These migrations implement a scalable, secure schema with proper data integrity.

## Migration Files

### 001_initial_schema.sql
Creates all core tables:
- `profiles` - Enhanced user profiles with reputation
- `skill_categories` - Taxonomy for skill categorization
- `skills` - Skills offered by users
- `skill_sessions` - Full session lifecycle management
- `credit_transactions` - Ledger-based credit system
- `reviews` - Bi-directional review system
- `certificates` - Immutable certificate records

### 002_rls_policies.sql
Row Level Security (RLS) policies for all tables ensuring users can only access their own data.

### 003_credit_ledger_functions.sql
Transaction-based credit system functions:
- `get_user_credit_balance()` - Get current balance
- `record_credit_transaction()` - Record transaction in ledger
- `lock_credits_for_session()` - Lock credits during active sessions
- `unlock_credits_from_session()` - Unlock credits
- `transfer_credits()` - Transfer credits between users

### 004_session_management_functions.sql
Session lifecycle management:
- `create_session_request()` - Create new session request
- `accept_session_request()` - Teacher accepts request
- `schedule_session()` - Set session time
- `start_session()` - Mark session as started
- `complete_session()` - Complete session and transfer credits
- `cancel_session()` - Cancel session and unlock credits

### 005_review_reputation_functions.sql
Review and reputation system:
- `create_review()` - Create bi-directional review
- `update_user_reputation()` - Calculate weighted reputation
- `get_user_reputation_breakdown()` - Get detailed reputation data

### 006_certificate_functions.sql
Certificate generation:
- `generate_certificate_number()` - Generate unique certificate ID
- `create_certificate()` - Create immutable certificate
- `get_user_certificates()` - Get user's certificates

## Applying Migrations

### Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run each migration file in order (001, 002, 003, etc.)
4. Verify no errors occurred

### Option 2: Supabase CLI
```bash
supabase db reset  # Reset database (dev only)
supabase migration up  # Apply all migrations
```

## Key Design Decisions

### Credit Ledger System
- **Why**: Prevents double-spending, provides full audit trail
- **How**: All credit changes are transactions in `credit_transactions` table
- **Benefits**: Can reconstruct any user's balance at any point in time

### Session State Machine
- **Why**: Ensures data consistency and prevents invalid state transitions
- **States**: requested → accepted → scheduled → in_progress → completed/cancelled
- **Benefits**: Clear lifecycle, easier debugging, prevents race conditions

### Bi-directional Reviews
- **Why**: Prevents review manipulation, ensures both parties review
- **How**: Both learner and teacher review each other after completion
- **Benefits**: More accurate reputation scores

### Weighted Reputation
- **Why**: Recent reviews are more relevant than old ones
- **How**: Reviews from last 30 days get 1.5x weight, older get 1.0x
- **Benefits**: Reputation reflects current performance

### Immutable Certificates
- **Why**: Certificates are credentials that should never change
- **How**: No UPDATE or DELETE permissions, denormalized data
- **Benefits**: Historical accuracy, can't be tampered with

## Next Steps

After applying migrations:
1. Update TypeScript types to match new schema
2. Create service layer to use these functions
3. Update frontend to use new services
4. Test all flows end-to-end
5. Set up monitoring and error tracking

## Security Notes

- All RPC functions use `SECURITY DEFINER` to bypass RLS
- RLS policies ensure users can only access their own data
- Input validation in functions prevents SQL injection
- Transaction locking prevents race conditions

## Performance Considerations

- Indexes on foreign keys and frequently queried columns
- Composite indexes for common query patterns
- Consider adding indexes if queries are slow in production
