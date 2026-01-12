import { useEffect, useState } from 'react'
import { useUser, useSessionContext } from '@supabase/auth-helpers-react'
import { supabase } from '@/lib/supabase'

export const useAuth = () => {
  const { session, isLoading: isSessionLoading } = useSessionContext()
  const user = useUser()
  const [profile, setProfile] = useState<any>(null) // Added profile back
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getProfile() {
      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      setProfile(data)
      setLoading(false)
    }

    if (!isSessionLoading) {
      getProfile()
    }
  }, [user, isSessionLoading])

  return {
    user,
    session,
    profile, // Now components won't break
    loading: loading || isSessionLoading,
    signOut: () => supabase.auth.signOut(), // Added signOut back
  }
}