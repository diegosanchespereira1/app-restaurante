import { LayoutDashboard, ClipboardList, UtensilsCrossed, Settings, Armchair, Menu, DollarSign, TrendingUp } from "lucide-react"
import { cn } from "../../lib/utils"
import { NavLink } from "react-router-dom"
import { useLanguage } from "../../context/LanguageContext"
import { useSettings } from "../../context/SettingsContext"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    onClose?: () => void
}

export function Sidebar({ className, onClose }: SidebarProps) {
    const { t } = useLanguage()
    const { isTablesEnabled } = useSettings()

    const links = [
        { href: "/", label: t("dashboard"), icon: LayoutDashboard },
        { href: "/orders", label: t("orders"), icon: ClipboardList },
        ...(isTablesEnabled ? [{ href: "/tables", label: t("tables"), icon: Armchair }] : []),
        { href: "/menu", label: t("menu"), icon: Menu },
        { href: "/sales", label: t("salesAnalysis"), icon: TrendingUp },
        { href: "/finance", label: t("finance"), icon: DollarSign },
        { href: "/settings", label: t("settings"), icon: Settings },
    ]

    return (
        <div className={cn("pb-12 min-h-screen border-r bg-card", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <div className="flex items-center gap-2 px-4 mb-6">
                        <UtensilsCrossed className="h-6 w-6 text-primary" />
                        <h2 className="text-xl font-bold tracking-tight">{t("appTitle")}</h2>
                    </div>
                    <div className="space-y-1">
                        {links.map((link) => (
                            <NavLink
                                key={link.href}
                                to={link.href}
                                onClick={onClose}
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary",
                                        isActive ? "bg-secondary text-primary" : "text-muted-foreground"
                                    )
                                }
                            >
                                <link.icon className="h-4 w-4" />
                                {link.label}
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
