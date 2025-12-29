import React from "react"
import { LayoutDashboard, ClipboardList, UtensilsCrossed, Settings, Armchair, Package, TrendingUp, DollarSign, Tag } from "lucide-react"
import { NavLink, useNavigate, useLocation } from "react-router-dom"
import { cn } from "../../lib/utils"
import { useLanguage } from "../../context/LanguageContext"
import { useSettings } from "../../context/SettingsContext"
import { useAuth } from "../../context/AuthContext"
import { Card, CardContent } from "../ui/card"

export function MobileBottomNav() {
    const { t } = useLanguage()
    const { isTablesEnabled } = useSettings()
    const { hasPermission } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const allLinks = [
        { href: "/", label: t("dashboard"), icon: LayoutDashboard, requiredRole: null as any },
        { href: "/orders", label: t("orders"), icon: ClipboardList, requiredRole: null as any },
        ...(isTablesEnabled ? [{ href: "/tables", label: t("tables"), icon: Armchair, requiredRole: null as any }] : []),
        { href: "/menu", label: t("menu"), icon: UtensilsCrossed, requiredRole: null as any },
        { href: "/settings", label: t("settings"), icon: Settings, requiredRole: ['admin', 'gerente'] as any },
    ]

    // Filter links based on permissions
    const links = allLinks.filter(link => {
        if (!link.requiredRole) return true
        return hasPermission(link.requiredRole)
    })

    // Only process admin cards when on settings page
    const isSettingsPage = location.pathname === '/settings'
    
    // Cards for admin/manager features - only processed when on settings page
    type AdminCard = {
        href: string
        label: string
        icon: React.ComponentType<{ className?: string }>
        requiredRole: any
    }
    
    let visibleCards: AdminCard[] = []
    if (isSettingsPage) {
        const adminCards: AdminCard[] = [
            { 
                href: "/promotions", 
                label: "Promoções", 
                icon: Tag, 
                requiredRole: ['admin', 'gerente', 'usuario'] as any 
            },
            { 
                href: "/stock", 
                label: t("stockManagement") || "Estoque", 
                icon: Package, 
                requiredRole: 'admin' as any 
            },
            { 
                href: "/sales", 
                label: t("salesAnalysis"), 
                icon: TrendingUp, 
                requiredRole: ['admin', 'gerente'] as any 
            },
            { 
                href: "/finance", 
                label: t("finance"), 
                icon: DollarSign, 
                requiredRole: ['admin', 'gerente'] as any 
            },
        ]

        visibleCards = adminCards.filter(card => {
            if (!card.requiredRole) return true
            return hasPermission(card.requiredRole)
        })
    }

    return (
        <>
            {/* Admin Cards Section - Only rendered on settings page */}
            {isSettingsPage && visibleCards.length > 0 && (
                <div className="mobile-admin-cards fixed bottom-[60px] left-0 right-0 z-40 lg:hidden print:hidden px-4 pb-2 bg-background/95 backdrop-blur-sm">
                    <div className="grid grid-cols-3 gap-2 max-w-screen-md mx-auto">
                        {visibleCards.map((card) => (
                            <Card
                                key={card.href}
                                className="cursor-pointer hover:bg-accent transition-colors active:scale-95 shadow-sm"
                                onClick={() => navigate(card.href)}
                            >
                                <CardContent className="flex flex-col items-center justify-center gap-1 p-2.5 min-h-[60px]">
                                    <card.icon className="h-5 w-5 text-primary flex-shrink-0" />
                                    <span className="text-xs font-medium text-center leading-tight line-clamp-2">{card.label}</span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t lg:hidden print:hidden mobile-bottom-nav">
                <div className="grid gap-1 px-2 py-2" style={{
                    gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))`
                }}>
                    {links.map((link) => (
                        <NavLink
                            key={link.href}
                            to={link.href}
                            className={({ isActive }) =>
                                cn(
                                    "flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-all min-h-[60px]",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                                )
                            }
                        >
                            <link.icon className="h-5 w-5 flex-shrink-0" />
                            <span className="truncate max-w-full text-center leading-tight">{link.label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </>
    )
}