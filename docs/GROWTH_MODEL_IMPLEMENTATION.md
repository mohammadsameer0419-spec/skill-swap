# Skill Growth & Resource Ecosystem - Implementation Guide

## Overview

This document describes the implementation of the **5-Level Growth Model**, **Onboarding System**, and **Learning Resources** ecosystem for the Micro Skill Swap App.

## Architecture

### Database Schema

#### 1. User Levels (ENUM)
- **Type**: `user_level` ENUM
- **Values**: `beginner`, `learner`, `skilled`, `advanced`, `expert`
- **Stored in**: `profiles.level`

#### 2. Level Requirements

| Level | Name | Sessions Required | Rating Required | Benefits |
|-------|------|-------------------|-----------------|----------|
| 1 | Beginner | 0 (Auto) | 0 | Access basic videos/notes; Join zero-skill tasks |
| 2 | Learner | 3 | 4.0 | Access practice tasks & guided resources |
| 3 | Skilled | 10 | 4.2 | Can teach Beginners; Suggest resources |
| 4 | Advanced | 25 | 4.5 | Host Live Classes; Earn 1.2x bonus credits |
| 5 | Expert | 50 | 4.8 | Mentor status; Upload curated paths; Mod rights |

#### 3. Onboarding System

**Tables:**
- `onboarding_steps` - Defines all onboarding steps
- `user_onboarding_progress` - Tracks user completion

**Default Steps:**
1. Welcome to Skill Swap!
2. Create Your Profile
3. Add Your First Skill
4. Explore Learning Resources
5. Complete Your First Session

#### 4. Learning Resources

**Tables:**
- `resource_categories` - Resource categories (Getting Started, Videos, etc.)
- `learning_resources` - Individual resources (videos, articles, tutorials)
- `user_resource_progress` - User progress tracking
- `curated_learning_paths` - Expert-created learning paths
- `user_path_progress` - User path completion tracking

## Key Functions

### Level Management

1. **`calculate_user_level(user_id)`**
   - Calculates user's level based on sessions and rating
   - Returns appropriate level enum

2. **`update_user_level(user_id)`**
   - Updates user level if requirements met
   - Only levels up, never down
   - Called automatically on session completion

3. **`check_level_permission(user_id, permission)`**
   - Checks if user has specific permission
   - Returns boolean

4. **`get_level_progress(user_id)`**
   - Returns detailed progress toward next level
   - Includes sessions needed, rating needed, progress percentage

### Onboarding

1. **`complete_onboarding_step(user_id, step_key, metadata)`**
   - Marks an onboarding step as completed
   - Idempotent (safe to call multiple times)

2. **`get_user_onboarding_progress(user_id)`**
   - Returns all steps with completion status
   - Includes progress percentage

### Learning Resources

1. **`get_available_resources(user_id, category_id, type, limit, offset)`**
   - Returns resources user can access based on level
   - Filters by category and type
   - Includes user progress data

2. **`update_resource_progress(user_id, resource_id, percentage, status)`**
   - Updates or creates resource progress
   - Status: `started`, `in_progress`, `completed`, `skipped`

3. **`increment_resource_views(resource_id)`**
   - Tracks resource popularity

4. **`create_curated_path(user_id, title, description, resource_ids, ...)`**
   - Creates learning path (Experts only)
   - Returns path ID

5. **`start_learning_path(user_id, path_id)`**
   - Starts a learning path for user
   - Checks level requirements

## Automatic Level Progression

Levels are automatically updated via database triggers:

1. **Session Completion Trigger** (`trg_update_level_on_session_complete`)
   - Fires when session status changes to 'completed'
   - Updates level for both learner and teacher

2. **Reputation Update Trigger** (`trg_update_level_on_reputation`)
   - Fires when reputation_score changes
   - Updates user level

## Frontend Components

### 1. `LevelDisplay`
- Shows current level with badge
- Displays progress toward next level
- Shows sessions and rating progress bars
- Located at: `src/components/LevelDisplay.tsx`

### 2. `OnboardingFlow`
- Guided onboarding for new users
- Shows step-by-step checklist
- Progress bar with completion percentage
- Located at: `src/components/OnboardingFlow.tsx`

### 3. `LearningResources`
- Displays available resources
- Category filtering
- Resource type icons
- Progress tracking per resource
- Mark as complete functionality
- Located at: `src/components/LearningResources.tsx`

### 4. `BalanceDisplay`
- Shows available credits
- Tooltip/sub-text for reserved credits
- Located at: `src/components/BalanceDisplay.tsx`

## React Hooks

Located in `src/hooks/useGrowth.ts`:

- `useLevelProgress(userId)` - Get level progress
- `useUpdateUserLevel()` - Update level mutation
- `useLevelPermission(userId, permission)` - Check permission
- `useOnboardingProgress(userId)` - Get onboarding status
- `useCompleteOnboardingStep()` - Complete step mutation
- `useAvailableResources(userId, options)` - Get resources
- `useUpdateResourceProgress()` - Update progress mutation
- `useResourceCategories()` - Get categories
- `useCuratedPaths(userId, onlyPublished)` - Get learning paths

## Services

Located in `src/lib/services/growthService.ts`:

- `GrowthService` - Service class with all growth-related methods
- Singleton export: `growthService`

## TypeScript Types

Located in `src/types/growth.types.ts`:

- `UserLevel` enum
- `LevelProgress` interface
- `UserOnboardingProgress` interface
- `LearningResource` interface
- `CuratedLearningPath` interface
- And more...

## Permissions Matrix

| Permission | Beginner | Learner | Skilled | Advanced | Expert |
|------------|----------|---------|---------|----------|--------|
| `access_basic_resources` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `access_practice_tasks` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `access_guided_resources` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `teach_beginners` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `suggest_resources` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `host_live_classes` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `earn_bonus_credits` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `mentor_status` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `upload_curated_paths` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `mod_rights` | ❌ | ❌ | ❌ | ❌ | ✅ |

## Database Migrations

1. **`016_growth_model_and_resources.sql`**
   - Creates ENUM type for levels
   - Adds level tracking to profiles
   - Creates onboarding tables
   - Creates learning resources tables
   - Implements level calculation functions
   - Sets up automatic triggers

2. **`017_onboarding_and_resources_functions.sql`**
   - Onboarding helper functions
   - Resource management functions
   - Path creation/management

## Usage Examples

### Check if user can teach beginners:
```typescript
const { data: canTeach } = useLevelPermission(userId, 'teach_beginners')
```

### Get level progress:
```typescript
const { data: progress } = useLevelProgress(userId)
// Returns: { current_level, next_level, sessions_needed, rating_needed, progress_percentage }
```

### Complete onboarding step:
```typescript
const completeStep = useCompleteOnboardingStep()
await completeStep.mutateAsync({
  userId: user.id,
  stepKey: 'create-profile',
  metadata: {}
})
```

### Get available resources:
```typescript
const { data: resources } = useAvailableResources(userId, {
  categoryId: 'some-category-id',
  resourceType: 'video',
  limit: 10
})
```

## Next Steps

1. **Seed Initial Resources**: Add default learning resources
2. **Create Expert Paths**: Have experts create curated learning paths
3. **UI Integration**: Integrate components into main dashboard
4. **Bonus Credits**: Implement 1.2x credit multiplier for Advanced/Expert
5. **Live Classes**: Implement live class hosting feature
6. **Moderation Tools**: Build moderation interface for Experts

## Notes

- Levels are automatically calculated and updated
- Level progression is one-way (only levels up, never down)
- All functions are secured with RLS policies
- Resource access is controlled by `required_level` column
- Onboarding steps can be marked required or optional
- Resources support multiple types: video, article, tutorial, documentation, exercise, path
