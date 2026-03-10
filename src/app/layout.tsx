import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SupabaseProvider from '@/components/providers/supabase-provider'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'MAK OS v1',
    description: 'Production-grade Next.js App Router for MAK OS v1',
}

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createSupabaseServerClient()
    const {
        data: { session },
    } = await supabase.auth.getSession()

    return (
        <html lang="en">
            <body className={inter.className}>
                <SupabaseProvider initialSession={session}>
                    {children}
                </SupabaseProvider>
            </body>
        </html>
    )
}
