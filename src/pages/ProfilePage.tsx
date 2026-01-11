import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CertificatesTab } from '@/components/CertificatesTab'
import { useAuth } from '@/hooks/useAuth'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Profile Page with Tabs
 * Includes Certificates tab and other profile sections
 */
export function ProfilePage() {
  const { profile, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Profile</h1>
        <p className="text-muted-foreground">
          {profile?.full_name || profile?.username || 'User'}
        </p>
      </div>

      <Tabs defaultValue="certificates" className="w-full">
        <TabsList>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="certificates" className="mt-6">
          <CertificatesTab />
        </TabsContent>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Overview</h2>
            <p className="text-muted-foreground">Profile overview coming soon...</p>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Settings</h2>
            <p className="text-muted-foreground">Settings coming soon...</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
