import { Sidebar } from "./Sidebar"
import { MobileBottomNav } from "./MobileBottomNav"

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-background">
            {/* Desktop Sidebar */}
            <div className="hidden md:block w-64 shrink-0 print:hidden">
                <Sidebar className="h-full" />
            </div>

            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 mobile-content md:pb-8 print:p-0 print:overflow-visible print:pb-0 mb-safe">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav />
        </div>
    )
}
