import { z } from 'zod'
import { SkillLevel, SkillStatus } from '@/types/skill.types'

/**
 * Zod schema for creating a new skill
 */
export const createSkillSchema = z.object({
  name: z
    .string()
    .min(3, 'Skill name must be at least 3 characters')
    .max(100, 'Skill name must be less than 100 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional()
    .nullable(),
  category: z
    .string()
    .max(50, 'Category must be less than 50 characters')
    .trim()
    .optional()
    .nullable(),
  level: z.nativeEnum(SkillLevel, {
    errorMap: () => ({ message: 'Please select a valid skill level' }),
  }),
  credits_required: z
    .number()
    .int('Credits must be a whole number')
    .min(1, 'Credits must be at least 1')
    .max(100, 'Credits cannot exceed 100'),
})

/**
 * Zod schema for updating an existing skill
 */
export const updateSkillSchema = z.object({
  name: z
    .string()
    .min(3, 'Skill name must be at least 3 characters')
    .max(100, 'Skill name must be less than 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional()
    .nullable(),
  category: z
    .string()
    .max(50, 'Category must be less than 50 characters')
    .trim()
    .optional()
    .nullable(),
  level: z.nativeEnum(SkillLevel).optional(),
  status: z.nativeEnum(SkillStatus).optional(),
  credits_required: z
    .number()
    .int('Credits must be a whole number')
    .min(1, 'Credits must be at least 1')
    .max(100, 'Credits cannot exceed 100')
    .optional(),
})

/**
 * Zod schema for sending a skill exchange request
 */
export const sendRequestSchema = z.object({
  skill_id: z.string().uuid('Invalid skill ID'),
  credits_amount: z
    .number()
    .int('Credits must be a whole number')
    .min(1, 'Credits must be at least 1'),
})

/**
 * Zod schema for updating credits
 */
export const updateCreditsSchema = z.object({
  credits: z
    .number()
    .int('Credits must be a whole number')
    .min(0, 'Credits cannot be negative'),
})

// Export TypeScript types inferred from schemas
export type CreateSkillInput = z.infer<typeof createSkillSchema>
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>
export type SendRequestInput = z.infer<typeof sendRequestSchema>
export type UpdateCreditsInput = z.infer<typeof updateCreditsSchema>
