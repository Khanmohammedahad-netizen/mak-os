'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard, Target, Bot, Menu, X, LogOut, Users, Briefcase, GitBranch, Clock
} from 'lucide-react'
import { useSupabase } from './providers/supabase-provider'

const mainRoutes = [
    { label: 'Home', icon: LayoutDashboard, href: '/dashboard', color: 'text-sky-500' },
    { label: 'Leads', icon: Target, href: '/dashboard/leads', color: 'text-emerald-500' },
    { label: 'Agents', icon: Bot, href: '/dashboard/agents', color: 'text-cyan-400' },
]

const extraRoutes = [
    { label: 'History', icon: Clock, href: '/dashboard/history', color: 'text-amber-400' },
    { label: 'Repositories', icon: GitBranch, href: '/dashboard/repositories', color: 'text-violet-500' },
    { label: 'Clients', icon: Users, href: '/dashboard/clients', color: 'text-pink-700' },
    { label: 'Projects', icon: Briefcase, href: '/dashboard/projects', color: 'text-orange-700' },
]

export function MobileNav() {
    const [menuOpen, setMenuOpen] = useState(false)
    const pathname = usePathname()
    const { supabase } = useSupabase()

    return (
        <>
            {/* Mobile Top Header (Sticky Top) */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-[40] bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white flex items-center justify-between px-4 h-[60px] shadow-sm">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">MAK OS</h1>
                </Link>
                {/* Optional Status Icon here */}
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {/* Mobile Bottom Tab Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-[50] bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-safe">
                <div className="flex items-center justify-around h-[72px] px-2">
                    {mainRoutes.map((route) => {
                        const isActive = pathname === route.href
                        return (
                            <Link
                                key={route.href}
                                href={route.href}
                                onClick={() => setMenuOpen(false)}
                                className={cn(
                                    "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all active:scale-95",
                                    isActive ? "text-white" : "text-slate-400 hover:text-slate-300"
                                )}
                            >
                                <route.icon className={cn("h-6 w-6", isActive ? route.color : "")} />
                                <span className={cn("text-[10px] font-medium tracking-wide", isActive ? "opacity-100" : "opacity-80")}>
                                    {route.label}
                                </span>
                            </Link>
                        )
                    })}

                    {/* Menu Toggle Button */}
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all active:scale-95",
                            menuOpen ? "text-white" : "text-slate-400 hover:text-slate-300"
                        )}
                    >
                        {menuOpen ? <X className="h-6 w-6 text-slate-300" /> : <Menu className="h-6 w-6" />}
                        <span className="text-[10px] font-medium tracking-wide opacity-80">Menu</span>
                    </button>
                </div>
            </div>

            {/* Mobile Menu Drawer (Sliding up from bottom bar) */}
            {menuOpen && (
                <>
                    <div className="md:hidden fixed inset-0 z-[45] bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
                    <div className="md:hidden fixed bottom-[72px] left-0 right-0 z-[48] bg-slate-900 border-t border-slate-800 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-5 duration-200 ease-out">
                        <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
                            {extraRoutes.map((route) => (
                                <Link
                                    key={route.href}
                                    href={route.href}
                                    onClick={() => setMenuOpen(false)}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors active:scale-95"
                                >
                                    <route.icon className={cn("h-5 w-5", route.color)} />
                                    <span className="text-sm font-medium text-slate-200">{route.label}</span>
                                </Link>
                            ))}

                            <button
                                onClick={async () => {
                                    await supabase.auth.signOut()
                                    setMenuOpen(false)
                                }}
                                className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 transition-colors active:scale-95 col-span-2 mt-2"
                            >
                                <LogOut className="h-5 w-5" />
                                <span className="text-sm font-medium">Sign Out</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
