import { LayoutDashboard, ClipboardList, UtensilsCrossed, Settings, Armchair } from "lucide-react"
import { NavLink } from "react-router-dom"
import { cn } from "../../lib/utils"
import { useLanguage } from "../../context/LanguageContext"
import { useSettings } from "../../context/SettingsContext"

export function MobileBottomNav() {
    const { t } = useLanguage()
    const { isTablesEnabled } = useSettings()

    const links = [
        { href: "/", label: t("dashboard"), icon: LayoutDashboard },
        { href: "/orders", label: t("orders"), icon: ClipboardList },
        ...(isTablesEnabled ? [{ href: "/tables", label: t("tables"), icon: Armchair }] : []),
        { href: "/menu", label: t("menu"), icon: UtensilsCrossed },
        { href: "/settings", label: t("settings"), icon: Settings },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden print:hidden mobile-bottom-nav">
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
    )
}