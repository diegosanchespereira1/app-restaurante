import { useState } from "react"
import { Sidebar } from "./Sidebar"

import { Menu as MenuIcon } from "lucide-react"
import { Button } from "../ui/button"
import { useLanguage } from "../../context/LanguageContext"

export function Layout({ children }: { children: React.ReactNode }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const { t } = useLanguage()

    return (
        <div className="flex h-screen bg-background">
            {/* Desktop Sidebar */}
            <div className="hidden md:block w-64 shrink-0 print:hidden">
                <Sidebar className="h-full" />
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden print:hidden">
                    <div
                        className="fixed inset-0 bg-black/50"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <div className="relative w-64 bg-card">
                        <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
                    </div>
                </div>
            )}

            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Header */}
                <div className="flex items-center p-4 border-b md:hidden print:hidden">
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                        <MenuIcon className="h-6 w-6" />
                    </Button>
                    <span className="ml-2 text-lg font-bold">{t("appTitle")}</span>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible">
                    {children}
                </div>
            </main>
        </div>
    )
}
