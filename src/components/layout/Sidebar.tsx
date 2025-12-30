import { LayoutDashboard, ClipboardList, Settings, Armchair, Menu, DollarSign, TrendingUp, LogOut, User, Package, Tag, ShoppingBag } from "lucide-react"
import { cn } from "../../lib/utils"
import { NavLink, useNavigate } from "react-router-dom"
import { useLanguage } from "../../context/LanguageContext"
import { useSettings } from "../../context/SettingsContext"
import { useAuth } from "../../context/AuthContext"
import { Button } from "../ui/button"
import { Logo } from "../ui/Logo"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    onClose?: () => void
}

export function Sidebar({ className, onClose }: SidebarProps) {
    const { t } = useLanguage()
    const { isTablesEnabled } = useSettings()
    const { hasPermission, profile, signOut } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    const allLinks = [
        { href: "/", label: t("dashboard"), icon: LayoutDashboard, requiredRole: null as any },
        { href: "/orders", label: t("orders"), icon: ClipboardList, requiredRole: null as any },
        ...(isTablesEnabled ? [{ href: "/tables", label: t("tables"), icon: Armchair, requiredRole: null as any }] : []),
        { href: "/menu", label: t("menu"), icon: Menu, requiredRole: null as any },
        { href: "/promotions", label: "Promoções", icon: Tag, requiredRole: ['admin', 'gerente', 'usuario'] as any },
        { href: "/stock", label: t("stockManagement") || "Estoque", icon: Package, requiredRole: 'admin' as any },
        { href: "/sales", label: t("salesAnalysis"), icon: TrendingUp, requiredRole: ['admin', 'gerente'] as any },
        { href: "/finance", label: t("finance"), icon: DollarSign, requiredRole: ['admin', 'gerente'] as any },
        { href: "/ifood", label: "iFood", icon: ShoppingBag, requiredRole: 'admin' as any },
        { href: "/settings", label: t("settings"), icon: Settings, requiredRole: ['admin', 'gerente'] as any },
    ]

    // Filter links based on permissions
    const links = allLinks.filter(link => {
        if (!link.requiredRole) return true
        return hasPermission(link.requiredRole)
    })

    return (
        <div className={cn("pb-12 min-h-screen border-r bg-card flex flex-col", className)}>
            <div className="space-y-4 py-4 flex-1">
                <div className="px-3 py-2 min-w-0">
                    <div className="px-4 mb-6 py-2 min-w-0 overflow-hidden">
                        <Logo size="sm" showText={true} className="min-w-0" />
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
            
            {/* User info and logout */}
            <div className="px-3 py-4 border-t">
                {profile && (
                    <div className="flex items-center gap-2 px-3 py-2 mb-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">
                                {profile.username || profile.full_name || profile.email}
                            </p>
                            <p className="text-xs capitalize">
                                {profile.role || 'sem role'}
                                {profile.role === 'admin' && ' ✓'}
                            </p>
                        </div>
                    </div>
                )}
                {!profile && (
                    <div className="px-3 py-2 mb-2 text-xs text-destructive">
                        ⚠ Perfil não carregado
                    </div>
                )}
                <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={handleLogout}
                >
                    <LogOut className="h-4 w-4 mr-2" />
                    {t("logout") || "Sair"}
                </Button>
            </div>
        </div>
    )
}
