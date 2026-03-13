'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Users,
    Briefcase,
    GitBranch,
    Target,
    Bot,
    Phone,
    LogOut,
    Clock,
    Kanban,
} from 'lucide-react'

import { useSupabase } from './providers/supabase-provider'

const routes = [
    {
        label: 'Calls',
        icon: Phone,
        href: '/dashboard/calls',
        color: 'text-emerald-400',
    },
    {
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: '/dashboard',
        color: 'text-sky-500',
    },
    {
        label: 'Repositories',
        icon: GitBranch,
        href: '/dashboard/repositories',
        color: 'text-violet-500',
    },
    {
        label: 'Clients',
        icon: Users,
        href: '/dashboard/clients',
        color: 'text-pink-700',
    },
    {
        label: 'Projects',
        icon: Briefcase,
        href: '/dashboard/projects',
        color: 'text-orange-700',
    },
    {
        label: 'Leads',
        icon: Target,
        href: '/dashboard/leads',
        color: 'text-emerald-500',
    },
    {
        label: 'AI Agents',
        icon: Bot,
        href: '/dashboard/agents',
        color: 'text-cyan-400',
    },
    {
        label: 'History',
        icon: Clock,
        href: '/dashboard/history',
        color: 'text-amber-400',
    },
    {
        label: 'Pipeline',
        icon: Kanban,
        href: '/dashboard/pipeline',
        color: 'text-indigo-400',
    },
]

export function Navigation() {
    const pathname = usePathname()
    const { supabase } = useSupabase()

    const handleSignOut = async () => {
        await supabase.auth.signOut()
    }

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-slate-900 text-white">
            <div className="px-3 py-2 flex-1">
                <Link href="/dashboard" className="flex items-center pl-3 mb-14">
                    <h1 className="text-2xl font-bold">MAK OS V1</h1>
                </Link>
                <div className="space-y-1">
                    {routes.map((route) => (
                        <Link
                            href={route.href}
                            key={route.href}
                            className={cn(
                                'text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition',
                                pathname === route.href
                                    ? 'text-white bg-white/10'
                                    : 'text-zinc-400'
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn('h-5 w-5 mr-3', route.color)} />
                                {route.label}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
            <div className="px-3 py-2">
                <button
                    onClick={handleSignOut}
                    className="text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition text-zinc-400"
                >
                    <div className="flex items-center flex-1">
                        <LogOut className="h-5 w-5 mr-3 text-red-500" />
                        Sign Out
                    </div>
                </button>
            </div>
        </div>
    )
}
