import { useLocation } from "react-router-dom"
import { useEffect } from "react"
import { Sidebar } from "./Sidebar"
import { MobileBottomNav } from "./MobileBottomNav"

export function Layout({ children }: { children: React.ReactNode }) {
    const location = useLocation()
    const isSettingsPage = location.pathname === '/settings'

    useEffect(() => {
        if (isSettingsPage) {
            document.body.classList.add('has-admin-cards')
        } else {
            document.body.classList.remove('has-admin-cards')
        }

        // Cleanup on unmount
        return () => {
            document.body.classList.remove('has-admin-cards')
        }
    }, [isSettingsPage])

    return (
        <div className="flex h-screen bg-background">
            {/* Desktop Sidebar - Only on large screens (lg+) */}
            <div className="hidden lg:block w-64 shrink-0 print:hidden">
                <Sidebar className="h-full" />
            </div>

            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-8 mobile-content lg:pb-8 print:p-0 print:overflow-visible print:pb-0 mb-safe w-full min-w-0">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav />
        </div>
    )
}
