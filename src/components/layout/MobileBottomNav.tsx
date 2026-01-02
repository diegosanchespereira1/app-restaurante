import React from "react"
import { LayoutDashboard, ClipboardList, UtensilsCrossed, Settings, Plus, Tag, Package, TrendingUp, DollarSign, ShoppingBag } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { useLanguage } from "../../context/LanguageContext"
import { Card, CardContent } from "../ui/card"

export function MobileBottomNav() {
    const { hasPermission } = useAuth()
    const { t } = useLanguage()
    const navigate = useNavigate()
    const location = useLocation()

    const links = [
        { href: "/", label: "Painel", icon: LayoutDashboard, requiredRole: null as any },
        { href: "/orders", label: "Pedidos", icon: ClipboardList, requiredRole: null as any },
        { href: "/menu", label: "Bebidas", icon: UtensilsCrossed, requiredRole: null as any },
        { href: "/settings", label: "Configurações", icon: Settings, requiredRole: ['admin', 'gerente'] as any },
    ].filter(link => {
        if (!link.requiredRole) return true
        return hasPermission(link.requiredRole)
    })

    const isActive = (href: string) => {
        if (href === "/orders") return location.pathname.startsWith("/orders")
        return location.pathname === href
    }

    // Admin/gerente cards exclusivos da página de configurações
    const isSettingsPage = location.pathname === "/settings"
    const adminCards = [
        { href: "/promotions", label: "Promoções", icon: Tag, requiredRole: ['admin', 'gerente', 'usuario'] as any },
        { href: "/stock", label: t("stockManagement") || "Estoque", icon: Package, requiredRole: 'admin' as any },
        { href: "/ifood", label: "iFood", icon: ShoppingBag, requiredRole: 'admin' as any },
        { href: "/sales", label: t("salesAnalysis"), icon: TrendingUp, requiredRole: ['admin', 'gerente'] as any },
        { href: "/finance", label: t("finance"), icon: DollarSign, requiredRole: ['admin', 'gerente'] as any },
    ].filter(card => {
        if (!card.requiredRole) return true
        return hasPermission(card.requiredRole)
    })

    // Ajustar posição do card Financeiro para não ficar sob o FAB (empurrar para a direita)
    let displayCards = adminCards
    const financeIndex = adminCards.findIndex(card => card.href === "/finance")
    if (financeIndex !== -1 && adminCards.length === 5) {
        const cardsCopy = [...adminCards]
        cardsCopy.splice(4, 0, { href: "__spacer_finance__", label: "", icon: null as any, requiredRole: null as any })
        displayCards = cardsCopy
    }

    return (
        <>
            {isSettingsPage && displayCards.length > 0 && (
                <div className="mobile-admin-cards fixed bottom-[60px] left-0 right-0 z-40 lg:hidden print:hidden px-4 pb-2 bg-background/95 backdrop-blur-sm">
                    <div className="grid grid-cols-3 gap-2 max-w-screen-md mx-auto">
                        {displayCards.map((card) => {
                            if (card.href === "__spacer_finance__") {
                                return <div key={card.href} aria-hidden="true" />
                            }
                            return (
                                <Card
                                    key={card.href}
                                    className="cursor-pointer hover:bg-accent transition-colors active:scale-95 shadow-sm"
                                    onClick={() => navigate(card.href)}
                                >
                                    <CardContent className="flex flex-col items-center justify-center gap-1 p-2.5 min-h-[60px]">
                                        {card.icon && <card.icon className="h-5 w-5 text-primary flex-shrink-0" />}
                                        <span className="text-xs font-medium text-center leading-tight line-clamp-2">{card.label}</span>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white nav-shadow lg:hidden print:hidden mobile-bottom-nav">
                <div className="relative w-full">
                    {/* FAB centralizado */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20">
                        <button
                            onClick={() => navigate("/orders/new")}
                            className="bg-primary hover:bg-primary/90 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg border-4 border-white transition-transform active:scale-95"
                            aria-label="Novo pedido"
                        >
                            <Plus className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex justify-between items-end px-2 pb-2 pt-3 h-16">
                        {links.map((link, index) => {
                            // Inserir espaçador no meio para acomodar o FAB (entre segundo e terceiro item)
                            const spacerNeeded = index === 2 && links.length >= 3
                            return (
                                <React.Fragment key={link.href}>
                                    {spacerNeeded && <div className="w-1/5" />}
                                    <button
                                        className={`flex flex-col items-center justify-center w-1/5 gap-1 ${isActive(link.href) ? "text-primary" : "text-gray-400 hover:text-gray-600"}`}
                                        onClick={() => navigate(link.href)}
                                    >
                                        <link.icon className="text-xl h-5 w-5" />
                                        <span className="text-[10px] font-medium">{link.label}</span>
                                    </button>
                                </React.Fragment>
                            )
                        })}
                    </div>
                </div>
            </nav>
        </>
    )
}