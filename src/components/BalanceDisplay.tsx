import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Coins, Info } from "lucide-react"
import { useCreditBalance } from "@/hooks/useCreditBalance"
import { useAuth } from "@/hooks/useAuth"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * BalanceDisplay Component
 * Shows the user's available credit balance with a tooltip/sub-text
 * indicating reserved credits in active requests
 */
export function BalanceDisplay() {
  const { user } = useAuth()
  const { data: balance, isLoading, error } = useCreditBalance(user?.id)

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Available Credits</p>
              <Skeleton className="h-8 w-16 mt-2" />
            </div>
            <div className="p-2 rounded-lg bg-secondary">
              <Coins className="w-5 h-5 text-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !balance) {
    return (
      <Card className="bg-card">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Available Credits</p>
              <p className="text-2xl font-semibold text-destructive mt-1">
                Error loading balance
              </p>
            </div>
            <div className="p-2 rounded-lg bg-secondary">
              <Coins className="w-5 h-5 text-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasReservedCredits = balance.reserved > 0

  return (
    <Card className="bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Available Credits</p>
              {hasReservedCredits && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        aria-label="Credit balance information"
                      >
                        <Info className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{balance.reserved} credit{balance.reserved !== 1 ? 's' : ''} are currently locked in active requests</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-2xl font-semibold text-foreground mt-1">
              {balance.available}
            </p>
            {hasReservedCredits && (
              <p className="text-xs text-muted-foreground mt-1">
                {balance.reserved} credit{balance.reserved !== 1 ? 's' : ''} locked in active requests
              </p>
            )}
          </div>
          <div className="p-2 rounded-lg bg-secondary">
            <Coins className="w-5 h-5 text-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
