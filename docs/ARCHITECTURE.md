# Micro Skill Swap App - Architecture Documentation

## Overview

A production-ready, scalable peer-to-peer skill exchange platform with credit-based transactions, AI-powered matching, session management, reviews, and certifications.

## Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + ShadCN UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS)
- **State Management**: TanStack Query (React Query)
- **AI**: OpenAI API (for matching recommendations)
- **Hosting**: Vercel (frontend), Supabase (backend)

## Database Schema

### Core Tables

1. **profiles** - User profiles with reputation and credits
2. **skills** - Skills offered by users
3. **skill_sessions** - Full session lifecycle management
4. **credit_transactions** - Ledger-based credit system
5. **reviews** - Bi-directional reviews between users
6. **certificates** - Immutable certificate records
7. **skill_categories** - Category taxonomy

### Key Design Decisions

- **Credit Ledger**: Transaction-based system prevents double-spending and provides full audit trail
- **Session State Machine**: Strict state transitions ensure data consistency
- **Bi-directional Reviews**: Both parties review each other, preventing review manipulation
- **Weighted Reputation**: Recent reviews weighted higher than old ones
- **Immutable Certificates**: Once issued, certificates cannot be modified

## Security

- Row Level Security (RLS) on all tables
- Input validation at service layer
- Transaction-based operations prevent race conditions
- Credit locking during active sessions

## Scalability Considerations

- Indexed foreign keys for fast joins
- Query optimization with proper indexes
- Caching strategy for AI recommendations
- Pagination for large datasets
- Modular service architecture for future extensions
