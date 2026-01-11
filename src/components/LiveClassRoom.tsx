import { useEffect, useState, useCallback } from 'react'
import {
    StreamVideo,
    StreamVideoClient,
    StreamCall,
    StreamTheme,
    useCallStateHooks,
    CallControls,
    SpeakerLayout,
    useCall,
} from '@stream-io/video-react-sdk'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
    ScreenShare,
    Users,
    Video,
    VideoOff,
    Mic,
    MicOff,
    PhoneOff,
    Monitor,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { liveClassService } from '@/lib/services/liveClassService'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { PostClassReview } from '@/components/PostClassReview'
import type { LiveClassWithHost, Participant } from '@/types/live-class.types'

interface LiveClassRoomProps {
    classId: string
    meetingId: string // Stream call ID
    onClassEnd?: () => void
}

/**
 * Level badge colors
 */
const LEVEL_COLORS: Record<string, string> = {
    beginner: 'bg-gray-500',
    learner: 'bg-blue-500',
    skilled: 'bg-green-500',
    advanced: 'bg-purple-500',
    expert: 'bg-yellow-500',
}

/**
 * Live Class Room Component
 * Integrates Stream Video SDK for video conferencing
 */
export function LiveClassRoom({
    classId,
    meetingId,
    onClassEnd,
}: LiveClassRoomProps) {
    const { user, profile } = useAuth()
    const [client, setClient] = useState<StreamVideoClient | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isHost, setIsHost] = useState(false)
    const [hasReservedAttendance, setHasReservedAttendance] = useState(false)
    const [classData, setClassData] = useState<LiveClassWithHost | null>(null)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [showParticipants, setShowParticipants] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [isCompleting, setIsCompleting] = useState(false)
    const [showReviewModal, setShowReviewModal] = useState(false)

    // Initialize Stream client and check permissions
    useEffect(() => {
        const initializeStream = async () => {
            if (!user || !profile) {
                setIsLoading(false)
                return
            }

            try {
                // Get Stream API key and token from environment
                // Note: In production, you should generate tokens server-side
                const streamApiKey = import.meta.env.VITE_STREAM_API_KEY as string
                const streamToken = import.meta.env.VITE_STREAM_TOKEN as string

                if (!streamApiKey) {
                    console.warn('Stream API key not found. Using placeholder.')
                    // For development, you can use a placeholder
                    // In production, generate tokens via your backend
                }

                // Create Stream client
                // Note: In production, generate tokens server-side for security
                const streamClient = new StreamVideoClient({
                    apiKey: streamApiKey || 'placeholder',
                    user: {
                        id: user.id,
                        name: profile.full_name || profile.username || 'User',
                        image: profile.avatar_url || undefined,
                    },
                    token: streamToken || undefined, // Generate server-side in production
                })

                setClient(streamClient)

                // Check if user is host
                const hostCheck = await liveClassService.isHost(classId, profile.id)
                setIsHost(hostCheck)

                // Check if user has reserved attendance
                const attendanceCheck = await liveClassService.hasReservedAttendance(
                    classId,
                    profile.id
                )
                setHasReservedAttendance(attendanceCheck)

                // Load class data
                const classInfo = await liveClassService.getClassById(classId)
                setClassData(classInfo)

                // Load participants
                const participantList = await liveClassService.getParticipants(classId)
                setParticipants(participantList)
            } catch (error) {
                console.error('Error initializing Stream:', error)
                toast.error('Failed to initialize video room')
            } finally {
                setIsLoading(false)
            }
        }

        initializeStream()

        // Cleanup
        return () => {
            if (client) {
                client.disconnectUser()
            }
        }
    }, [user, profile, classId])

    // Handle ending class
    const handleEndClass = useCallback(async () => {
        if (!isHost) return

        setIsCompleting(true)
        try {
            // Complete the class (transfers credits)
            const result = await liveClassService.completeClass(classId)

            if (result) {
                toast.success(
                    `Class completed! ${result.completed_attendees} attendees, ${result.total_credits_transferred} credits transferred.`
                )

                // Update class status
                await liveClassService.updateClassStatus(classId, 'completed')

                // Show review modal (only for attendees, not host)
                if (!isHost && classData) {
                    setShowReviewModal(true)
                }

                // Callback to parent
                onClassEnd?.()
            } else {
                toast.error('Failed to complete class')
            }
        } catch (error) {
            console.error('Error ending class:', error)
            toast.error('Failed to end class')
        } finally {
            setIsCompleting(false)
        }
    }, [isHost, classId, onClassEnd])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="space-y-4 w-full max-w-4xl">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        )
    }

    if (!client) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card>
                    <CardContent className="p-8 text-center">
                        <p className="text-destructive">
                            Failed to initialize video room. Please check your Stream configuration.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Check permissions
    if (!isHost && !hasReservedAttendance) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card>
                    <CardContent className="p-8 text-center">
                        <p className="text-destructive">
                            You don't have permission to join this class. Please reserve your spot first.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <>
            <StreamVideo client={client}>
                <StreamCall callId={meetingId}>
                    <StreamTheme>
                        <LiveClassRoomContent
                            classId={classId}
                            meetingId={meetingId}
                            isHost={isHost}
                            classData={classData}
                            participants={participants}
                            showParticipants={showParticipants}
                            onToggleParticipants={() => setShowParticipants(!showParticipants)}
                            isRecording={isRecording}
                            onToggleRecording={() => setIsRecording(!isRecording)}
                            onEndClass={handleEndClass}
                            isCompleting={isCompleting}
                        />
                    </StreamTheme>
                </StreamCall>
            </StreamVideo>

            {/* Post-Class Review Modal */}
            {classData && (
                <PostClassReview
                    open={showReviewModal}
                    onOpenChange={setShowReviewModal}
                    classId={classId}
                    hostId={classData.host_id}
                    hostName={classData.host_profile?.full_name || classData.host_profile?.username || undefined}
                    onReviewSubmitted={() => {
                        // Refresh level progress after review (reputation affects level)
                        // The level update trigger will handle this automatically
                    }}
                />
            )}
        </>
    )
}

/**
 * Inner component that uses Stream hooks
 */
function LiveClassRoomContent({
    classId,
    meetingId,
    isHost,
    classData,
    participants,
    showParticipants,
    onToggleParticipants,
    isRecording,
    onToggleRecording,
    onEndClass,
    isCompleting,
}: {
    classId: string
    meetingId: string
    isHost: boolean
    classData: LiveClassWithHost | null
    participants: Participant[]
    showParticipants: boolean
    onToggleParticipants: () => void
    isRecording: boolean
    onToggleRecording: () => void
    onEndClass: () => void
    isCompleting: boolean
}) {
    const call = useCall()
    const {
        useParticipantCount,
        useIsCallRecordingInProgress,
        useParticipants,
        useLocalParticipant,
    } = useCallStateHooks()
    const participantCount = useParticipantCount()
    const isRecordingInProgress = useIsCallRecordingInProgress()
    const participants = useParticipants()
    const localParticipant = useLocalParticipant()

    // Custom Moderator Check - Check if user is host via localParticipant or isHost prop
    const isModerator = isHost ||
        localParticipant?.custom?.level === 'expert' ||
        localParticipant?.custom?.level === 'advanced' ||
        localParticipant?.role === 'host' ||
        localParticipant?.role === 'moderator'

    return (
        <div className="relative h-screen w-full overflow-hidden bg-background">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm p-4">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-semibold">
                                {classData?.title || 'Live Class'}
                            </h1>
                            <Badge
                                variant="destructive"
                                className="bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/50"
                            >
                                Live Now
                            </Badge>
                        </div>
                        {classData?.host_profile && (
                            <p className="text-sm text-muted-foreground">
                                Host: {classData.host_profile.full_name ||
                                    classData.host_profile.username ||
                                    'Unknown'}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Participants count */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onToggleParticipants}
                        >
                            <Users className="w-4 h-4 mr-2" />
                            {participantCount} Participants
                        </Button>

                        {/* Recording toggle (UI only for now) */}
                        {isModerator && (
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="recording"
                                    checked={isRecording || isRecordingInProgress}
                                    onCheckedChange={onToggleRecording}
                                    disabled={isRecordingInProgress}
                                />
                                <Label htmlFor="recording" className="text-sm">
                                    Record
                                </Label>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Video area */}
            <div className="h-full pt-20">
                <SpeakerLayout participantsBarPosition="bottom" />
            </div>

            {/* Participants sidebar */}
            {showParticipants && (
                <Card className="absolute right-0 top-20 bottom-20 w-80 border-l border-border rounded-none z-20">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Participants</CardTitle>
                            <Badge
                                variant="destructive"
                                className="bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/50 text-xs"
                            >
                                Live Now
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                        {participants.map((participant) => (
                            <div
                                key={participant.profile_id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors"
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarImage
                                        src={participant.avatar_url || undefined}
                                        alt={participant.full_name || participant.username || 'User'}
                                    />
                                    <AvatarFallback>
                                        {(participant.full_name || participant.username || 'U')
                                            .charAt(0)
                                            .toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {participant.full_name || participant.username || 'Anonymous'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge
                                            className={`${LEVEL_COLORS[participant.level] || 'bg-gray-500'} text-white text-xs`}
                                        >
                                            {participant.level.charAt(0).toUpperCase() +
                                                participant.level.slice(1)}
                                        </Badge>
                                        {/* Show host badge if this participant is the host */}
                                        {streamParticipants.find(p => p.userId === participant.profile_id)?.role === 'host' && (
                                            <Badge variant="outline" className="text-xs">
                                                Host
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Professional Call Controls */}
            <div className="fixed bottom-0 flex w-full items-center justify-center gap-5 pb-8 z-10">
                <CallControls
                    onLeave={async () => {
                        // Handle leave logic if needed
                        if (!isHost) {
                            // For attendees, just leave the call
                            // Credits are handled when host ends class
                        }
                    }}
                />

                {isModerator && (
                    <Button
                        variant="destructive"
                        onClick={onEndClass}
                        disabled={isCompleting}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        <PhoneOff className="w-4 h-4 mr-2" />
                        {isCompleting ? 'Completing...' : 'End Class for All'}
                    </Button>
                )}
            </div>
        </div>
    )
}
