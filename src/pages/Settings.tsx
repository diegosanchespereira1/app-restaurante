import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import { Button } from "../components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select"
import { useLanguage } from "../context/LanguageContext"
import { useSettings } from "../context/SettingsContext"
import { Save, RotateCcw, ExternalLink } from "lucide-react"
import { useState } from "react"

export function Settings() {
    const { language, setLanguage, t } = useLanguage()
    const { 
        updateSettings, 
        isTablesEnabled, 
        isOrderDisplayEnabled, 
        saveSettings, 
        resetSettings, 
        isLoading
    } = useSettings()
    
    const [saveMessage, setSaveMessage] = useState<string | null>(null)

    const handleSave = () => {
        saveSettings()
        setSaveMessage("Configurações salvas com sucesso!")
        setTimeout(() => setSaveMessage(null), 3000)
    }

    const handleReset = () => {
        if (window.confirm("Tem certeza que deseja resetar todas as configurações para os valores padrão?")) {
            resetSettings()
            setSaveMessage("Configurações resetadas para o padrão!")
            setTimeout(() => setSaveMessage(null), 3000)
        }
    }

    const openOrderDisplayInNewWindow = () => {
        const currentUrl = window.location.href
        const baseUrl = currentUrl.split('#')[0] // Remove hash if present
        const orderDisplayUrl = `${baseUrl}#/order-display-standalone`
        window.open(orderDisplayUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">{t("settingsTitle")}</h2>
                <p className="text-muted-foreground">{t("settingsDescription")}</p>
            </div>

            {/* Save/Reset Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Ações de Configuração</CardTitle>
                    <CardDescription>
                        Salve suas configurações ou reset para os valores padrão
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <Button onClick={handleSave} className="flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            Salvar Configurações
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={handleReset}
                            className="flex items-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset para Padrão
                        </Button>
                    </div>
                    {saveMessage && (
                        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
                            {saveMessage}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Order Display Actions */}
            {isOrderDisplayEnabled && (
                <Card>
                    <CardHeader>
                        <CardTitle>Tela de Pedidos</CardTitle>
                        <CardDescription>
                            Acesso rápido para a tela dedicada de monitoramento de pedidos
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button 
                            onClick={openOrderDisplayInNewWindow}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Abrir Tela de Pedidos em Nova Janela
                        </Button>
                        <p className="text-sm text-muted-foreground mt-2">
                            A tela será aberta em uma nova janela sem menus, otimizada para monitoramento de cozinha
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t("language")}</CardTitle>
                        <CardDescription>{t("selectLanguage")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2">
                            <Label htmlFor="language">{t("language")}</Label>
                            <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
                                <SelectTrigger id="language" className="w-[200px]">
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">{t("english")}</SelectItem>
                                    <SelectItem value="pt">{t("portuguese")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t("tableManagement")}</CardTitle>
                        <CardDescription>{t("enableTablesDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="enable-tables">{t("enableTables")}</Label>
                                <p className="text-sm text-muted-foreground">
                                    Status atual: {isTablesEnabled ? "Ativado" : "Desativado"}
                                </p>
                            </div>
                            <Switch
                                id="enable-tables"
                                checked={isTablesEnabled}
                                onCheckedChange={(checked) => updateSettings({ enableTables: checked })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Tela de Pedidos</CardTitle>
                        <CardDescription>
                            Ative para usar a tela dedicada de monitoramento de pedidos. 
                            Esta tela é otimizada para cozinhas e permite visualizar e atualizar status dos pedidos em tempo real.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="enable-order-display">Habilitar Tela de Pedidos</Label>
                                <p className="text-sm text-muted-foreground">
                                    Disponível em: /order-display • Status atual: {isOrderDisplayEnabled ? "Ativado" : "Desativado"}
                                </p>
                            </div>
                            <Switch
                                id="enable-order-display"
                                checked={isOrderDisplayEnabled}
                                onCheckedChange={(checked) => updateSettings({ enableOrderDisplay: checked })}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Current Settings Display */}
            <Card>
                <CardHeader>
                    <CardTitle>Configurações Atuais</CardTitle>
                    <CardDescription>
                        Resumo das configurações salvas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Idioma:</span>
                            <span className="font-medium">{language === 'pt' ? 'Português' : 'English'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Gestão de Mesas:</span>
                            <span className="font-medium">{isTablesEnabled ? 'Ativado' : 'Desativado'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Tela de Pedidos:</span>
                            <span className="font-medium">{isOrderDisplayEnabled ? 'Ativado' : 'Desativado'}</span>
                        </div>
                        {isLoading && (
                            <div className="flex justify-between">
                                <span>Estado:</span>
                                <span className="font-medium text-orange-600">Carregando...</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
