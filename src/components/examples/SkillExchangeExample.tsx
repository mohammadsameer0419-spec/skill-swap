/**
 * Example component demonstrating how to use the auth hook,
 * React Query hooks for skills, and requests with optimistic updates
 */
import { useAuth } from '@/hooks/useAuth'
import {
  useSkills,
  useCreateSkill,
  useUpdateSkill,
  useDeleteSkill,
} from '@/hooks/useSkills'
import {
  useSendRequest,
  useUserRequests,
  useUpdateCredits,
} from '@/hooks/useRequests'
import { useProfile } from '@/hooks/useProfile'
import { Button } from '@/components/ui/button'
import { SkillLevel } from '@/types/skill.types'
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createSkillSchema } from '@/lib/validations/skill.schema'
import type { CreateSkillInput } from '@/lib/validations/skill.schema'

export function SkillExchangeExample() {
  const { user, profile, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { data: profileData } = useProfile(user?.id)
  const { data: skills, isLoading: isSkillsLoading, error: skillsError } =
    useSkills({ status: 'active' })
  const { data: requests, isLoading: isRequestsLoading } = useUserRequests(
    user?.id || null,
    'learner'
  )

  const createSkillMutation = useCreateSkill()
  const updateSkillMutation = useUpdateSkill()
  const deleteSkillMutation = useDeleteSkill()
  const sendRequestMutation = useSendRequest()
  const updateCreditsMutation = useUpdateCredits()

  // Form handling with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateSkillInput>({
    resolver: zodResolver(createSkillSchema),
  })

  const onSubmit = async (data: CreateSkillInput) => {
    if (!user?.id) return

    try {
      await createSkillMutation.mutateAsync({
        userId: user.id,
        data,
      })
      reset()
    } catch (error) {
      console.error('Failed to create skill:', error)
    }
  }

  const handleSendRequest = async (skillId: string, teacherId: string) => {
    if (!user?.id || !profile) return

    try {
      // Get skill to get credits amount
      const skill = skills?.find((s) => s.id === skillId)
      if (!skill) return

      await sendRequestMutation.mutateAsync({
        learnerId: user.id,
        teacherId,
        skillId,
        creditsAmount: skill.credits_required,
      })
    } catch (error) {
      console.error('Failed to send request:', error)
    }
  }

  const handleUpdateCredits = async (operation: 'add' | 'subtract') => {
    if (!user?.id) return

    try {
      await updateCreditsMutation.mutateAsync({
        userId: user.id,
        credits: 5,
        operation,
      })
    } catch (error) {
      console.error('Failed to update credits:', error)
    }
  }

  if (isAuthLoading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return <div>Please sign in to use this feature</div>
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Profile Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Profile</h2>
        {profileData && (
          <div>
            <p>Username: {profileData.username || 'Not set'}</p>
            <p>
              Credits:{' '}
              {updateCreditsMutation.isLoading
                ? 'Updating...'
                : profileData.credits}
            </p>
            <div className="mt-4 space-x-2">
              <Button
                onClick={() => handleUpdateCredits('add')}
                disabled={updateCreditsMutation.isLoading}
              >
                Add 5 Credits
              </Button>
              <Button
                variant="outline"
                onClick={() => handleUpdateCredits('subtract')}
                disabled={updateCreditsMutation.isLoading}
              >
                Subtract 5 Credits
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Skill Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Create Skill</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Skill Name</label>
            <input
              {...register('name')}
              className="w-full px-4 py-2 border rounded-md"
              placeholder="e.g., Python Programming"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Level</label>
            <select
              {...register('level')}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value={SkillLevel.BEGINNER}>Beginner</option>
              <option value={SkillLevel.INTERMEDIATE}>Intermediate</option>
              <option value={SkillLevel.ADVANCED}>Advanced</option>
              <option value={SkillLevel.EXPERT}>Expert</option>
            </select>
            {errors.level && (
              <p className="text-red-500 text-sm mt-1">{errors.level.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Credits Required
            </label>
            <input
              type="number"
              {...register('credits_required', { valueAsNumber: true })}
              className="w-full px-4 py-2 border rounded-md"
              min={1}
              max={100}
            />
            {errors.credits_required && (
              <p className="text-red-500 text-sm mt-1">
                {errors.credits_required.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={createSkillMutation.isLoading}
            className="w-full"
          >
            {createSkillMutation.isLoading ? 'Creating...' : 'Create Skill'}
          </Button>
          {createSkillMutation.error && (
            <p className="text-red-500 text-sm">
              {createSkillMutation.error.message}
            </p>
          )}
        </form>
      </div>

      {/* Skills List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Available Skills</h2>
        {isSkillsLoading ? (
          <div>Loading skills...</div>
        ) : skillsError ? (
          <div className="text-red-500">Error: {skillsError.message}</div>
        ) : (
          <div className="space-y-4">
            {skills?.map((skill) => (
              <div
                key={skill.id}
                className="border rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <h3 className="font-semibold">{skill.name}</h3>
                  <p className="text-sm text-gray-600">{skill.description}</p>
                  <p className="text-sm">Level: {skill.level}</p>
                  <p className="text-sm">
                    Credits: {skill.credits_required}
                  </p>
                </div>
                <Button
                  onClick={() => handleSendRequest(skill.id, skill.user_id)}
                  disabled={
                    sendRequestMutation.isLoading ||
                    skill.user_id === user?.id
                  }
                >
                  {sendRequestMutation.isLoading
                    ? 'Sending...'
                    : 'Request Exchange'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">My Requests</h2>
        {isRequestsLoading ? (
          <div>Loading requests...</div>
        ) : (
          <div className="space-y-4">
            {requests?.map((request) => (
              <div key={request.id} className="border rounded-lg p-4">
                <p>Status: {request.status}</p>
                <p>Credits: {request.credits_amount}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
