import { useEffect, useState } from "react"
import { useOnboardingProgress } from "@/hooks/useGrowth"
import { useAuth } from "@/hooks/useAuth"
import { OnboardingFlow } from "./OnboardingFlow"
import { DashboardHeader } from "./dashboard-header"
import { Skeleton } from "@/components/ui/skeleton"
import confetti from "canvas-confetti"

interface DashboardLayoutProps {
    children: React.ReactNode
}

/**
 * Dashboard Layout Component
 * Handles onboarding flow and shows dashboard when complete
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { user } = useAuth()
    const { data: onboardingProgress, isLoading } = useOnboardingProgress(user?.id)
    const [showConfetti, setShowConfetti] = useState(false)
    const [wasCompleted, setWasCompleted] = useState(false)

    // Track onboarding completion for confetti effect
    useEffect(() => {
        if (onboardingProgress && onboardingProgress.is_complete && !wasCompleted) {
            // Trigger confetti celebration
            setShowConfetti(true)
            setWasCompleted(true)

            // Enhanced confetti burst - heavy and celebratory
            const duration = 5000 // Longer duration for more impact
            const animationEnd = Date.now() + duration

            // Heavy, celebratory defaults
            const defaults = {
                startVelocity: 50, // Higher velocity for more impact
                spread: 360,
                ticks: 100, // More ticks for longer-lasting particles
                zIndex: 9999,
                gravity: 0.8, // Slightly higher gravity for more natural fall
                colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE']
            }

            function randomInRange(min: number, max: number) {
                return Math.random() * (max - min) + min
            }

            // Initial big burst from center
            confetti({
                ...defaults,
                particleCount: 150,
                origin: { x: 0.5, y: 0.3 },
                angle: 90,
            })

            // Additional bursts from sides
            const interval = setInterval(() => {
                const timeLeft = animationEnd - Date.now()

                if (timeLeft <= 0) {
                    return clearInterval(interval)
                }

                const particleCount = 80 * (timeLeft / duration) // More particles

                // Launch confetti from left
                confetti({
                    ...defaults,
                    particleCount: Math.floor(particleCount),
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                })

                // Launch confetti from right
                confetti({
                    ...defaults,
                    particleCount: Math.floor(particleCount),
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                })

                // Launch confetti from center (sporadic)
                if (Math.random() > 0.7) {
                    confetti({
                        ...defaults,
                        particleCount: Math.floor(particleCount * 0.6),
                        origin: { x: 0.5, y: Math.random() * 0.4 },
                        angle: 90,
                    })
                }
            }, 200) // More frequent bursts

            // Cleanup after duration
            setTimeout(() => {
                setShowConfetti(false)
            }, duration)
        }
    }, [onboardingProgress?.is_complete, wasCompleted])

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <DashboardHeader />
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        )
    }

    // Show onboarding if not complete
    if (onboardingProgress && !onboardingProgress.is_complete) {
        return (
            <div className="min-h-screen bg-background">
                <DashboardHeader />
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <OnboardingFlow />
                </div>
            </div>
        )
    }

    // Show welcome message with confetti overlay
    if (showConfetti) {
        return (
            <div className="min-h-screen bg-background relative">
                <DashboardHeader />
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="text-center py-16">
                        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                            🎉 Welcome to SkillSwap! 🎉
                        </h1>
                        <p className="text-lg text-muted-foreground mb-8">
                            You're all set! Start exploring and learning new skills.
                        </p>
                        <div className="mt-8">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Show full dashboard
    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader />
            <div className="max-w-7xl mx-auto px-4 py-8">
                {children}
            </div>
        </div>
    )
}
