import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { supabase } from '@/lib/supabase'
import { ReactNode, useState } from 'react'

interface AuthProviderProps {
    children: ReactNode
}

/**
 * Auth Provider using @supabase/auth-helpers-react
 * Wraps the app to provide session context
 */
export function AuthProvider({ children }: AuthProviderProps) {
    const [initialSession] = useState(() => {
        // Get initial session if available
        return supabase.auth.getSession()
    })

    return (
        <SessionContextProvider
            supabaseClient={supabase}
            initialSession={null}
        >
            {children}
        </SessionContextProvider>
    )
}
