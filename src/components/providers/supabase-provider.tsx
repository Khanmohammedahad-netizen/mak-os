'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Session, SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type SupabaseContext = {
    supabase: SupabaseClient<any, any, any>
    session: Session | null
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export default function SupabaseProvider({
    children,
    initialSession,
}: {
    children: React.ReactNode
    initialSession: Session | null
}) {
    const [supabase] = useState(() => createSupabaseBrowserClient())
    const [session, setSession] = useState<Session | null>(initialSession)
    const router = useRouter()

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, newSession) => {
            setSession(newSession)

            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                router.refresh()
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [router, supabase])

    return (
        <Context.Provider value={{ supabase, session }}>
            {children}
        </Context.Provider>
    )
}

export const useSupabase = () => {
    const context = useContext(Context)
    if (context === undefined) {
        throw new Error('useSupabase must be used inside SupabaseProvider')
    }
    return context
}
