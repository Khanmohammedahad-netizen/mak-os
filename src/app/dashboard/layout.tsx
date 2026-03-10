import { Navigation } from '@/components/navigation'
import { MobileNav } from '@/components/mobile-nav'
import { StatusBanner } from '@/components/status-banner'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="h-screen flex w-full relative bg-slate-50 text-slate-900">
            {/* Desktop Sidebar */}
            <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-gray-900">
                <Navigation />
            </div>

            {/* Mobile Header + Bottom Tab Nav */}
            <MobileNav />

            {/* App Content Container - safe area padded for Mobile Navigation */}
            <main className="md:pl-72 flex-1 w-full overflow-y-auto pt-[60px] pb-[72px] md:pt-0 md:pb-0 h-full flex flex-col">
                <StatusBanner />
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    )
}
