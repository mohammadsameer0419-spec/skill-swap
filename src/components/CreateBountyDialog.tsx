import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Target } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { bountyService } from '@/lib/services/bountyService'
import { useAuth } from '@/hooks/useAuth'
import { useCreditBalance } from '@/hooks/useCreditBalance'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CreateBountyData, BountyDifficulty } from '@/types/bounty.types'

interface CreateBountyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Create Bounty Dialog Component
 * Allows users to post learning requests
 */
export function CreateBountyDialog({ open, onOpenChange }: CreateBountyDialogProps) {
  const { user } = useAuth()
  const { data: creditBalance } = useCreditBalance(user?.id)
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creditsOffered, setCreditsOffered] = useState<number>(5)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [difficultyLevel, setDifficultyLevel] = useState<BountyDifficulty | null>(null)
  const [skillTag, setSkillTag] = useState('')
  const [skillTags, setSkillTags] = useState<string[]>([])
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null)

  // Fetch skill categories
  const { data: categories } = useQuery({
    queryKey: ['skill-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skill_categories')
        .select('id, name')
        .order('name')

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  })

  const createMutation = useMutation({
    mutationFn: (bountyData: CreateBountyData) => bountyService.createBounty(bountyData),
    onSuccess: () => {
      toast.success('Bounty created successfully!')
      // Reset form
      setTitle('')
      setDescription('')
      setCreditsOffered(5)
      setCategoryId(null)
      setDifficultyLevel(null)
      setSkillTags([])
      setExpiresInDays(null)
      // Close dialog
      onOpenChange(false)
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['bounties'] })
      queryClient.invalidateQueries({ queryKey: ['credit-balance'] })
    },
    onError: (error: Error) => {
      toast.error(`Failed to create bounty: ${error.message}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    const availableCredits = creditBalance?.available || 0
    if (creditsOffered > availableCredits) {
      toast.error(`Insufficient credits. Available: ${availableCredits}, Required: ${creditsOffered}`)
      return
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      credits_offered: creditsOffered,
      category_id: categoryId,
      skill_tags: skillTags.length > 0 ? skillTags : undefined,
      difficulty_level: difficultyLevel,
      expires_at: expiresAt,
    })
  }

  const handleAddTag = () => {
    if (skillTag.trim() && !skillTags.includes(skillTag.trim())) {
      setSkillTags([...skillTags, skillTag.trim()])
      setSkillTag('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setSkillTags(skillTags.filter((t) => t !== tag))
  }

  const availableCredits = creditBalance?.available || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Post a Bounty
          </DialogTitle>
          <DialogDescription>
            Create a learning request. Level 3+ users can claim it to help you learn.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., I want to learn how to build a Discord Bot"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe what you want to learn in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              maxLength={1000}
            />
          </div>

          {/* Credits Offered */}
          <div className="space-y-2">
            <Label htmlFor="credits">
              Credits Offered * (Available: {availableCredits})
            </Label>
            <Input
              id="credits"
              type="number"
              min={1}
              max={availableCredits}
              value={creditsOffered}
              onChange={(e) => setCreditsOffered(parseInt(e.target.value) || 1)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Credits will be reserved when you create this bounty
            </p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category (Optional)</Label>
            <Select value={categoryId || ''} onValueChange={(value) => setCategoryId(value || null)}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty Level */}
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty Level (Optional)</Label>
            <Select
              value={difficultyLevel || ''}
              onValueChange={(value) => setDifficultyLevel((value as BountyDifficulty) || null)}
            >
              <SelectTrigger id="difficulty">
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Skill Tags */}
          <div className="space-y-2">
            <Label>Skill Tags (Optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Python, Discord API"
                value={skillTag}
                onChange={(e) => setSkillTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {skillTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {skillTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expires">Expires In (Optional)</Label>
            <Select
              value={expiresInDays?.toString() || ''}
              onValueChange={(value) => setExpiresInDays(value ? parseInt(value) : null)}
            >
              <SelectTrigger id="expires">
                <SelectValue placeholder="Never expires" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Never expires</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Bounty'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
