import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select"
import { useLanguage } from "../context/LanguageContext"
import { useSettings } from "../context/SettingsContext"
import { Save, RotateCcw, ExternalLink, Printer, TestTube } from "lucide-react"
import { useState } from "react"
import { testNetworkPrinter } from "../lib/printer"

export function Settings() {
    const { language, setLanguage, t } = useLanguage()
    const { 
        updateSettings, 
        updatePrinterSettings,
        isTablesEnabled, 
        isOrderDisplayEnabled,
        printerSettings,
        saveSettings, 
        resetSettings, 
        isLoading
    } = useSettings()
    
    const [saveMessage, setSaveMessage] = useState<string | null>(null)
    const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null)
    const [isTesting, setIsTesting] = useState(false)

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

    const handleTestConnection = async () => {
        if (!printerSettings.ipAddress || !printerSettings.port) {
            setTestStatus({
                success: false,
                message: 'Por favor, preencha o IP e porta da impressora'
            })
            return
        }

        setIsTesting(true)
        setTestStatus(null)

        // Determinar protocolo baseado na porta
        let protocol: 'raw' | 'ipp' | 'lpr' = 'raw'
        if (printerSettings.port === 631 || printerSettings.port === 80 || printerSettings.port === 443) {
            protocol = 'ipp'
        } else if (printerSettings.port === 515) {
            protocol = 'lpr'
        }

        const result = await testNetworkPrinter(
            printerSettings.ipAddress,
            printerSettings.port,
            protocol
        )

        setTestStatus(result)
        setIsTesting(false)

        // Limpar mensagem após 5 segundos
        setTimeout(() => {
            setTestStatus(null)
        }, 5000)
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

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Printer className="w-5 h-5" />
                            <CardTitle>{t("printerSettings")}</CardTitle>
                        </div>
                        <CardDescription>{t("printerSettingsDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="enable-printer">{t("enablePrinter")}</Label>
                                <p className="text-sm text-muted-foreground">
                                    Status atual: {printerSettings.enabled ? "Ativado" : "Desativado"}
                                </p>
                            </div>
                            <Switch
                                id="enable-printer"
                                checked={printerSettings.enabled}
                                onCheckedChange={(checked) => updatePrinterSettings({ enabled: checked })}
                            />
                        </div>

                        {printerSettings.enabled && (
                            <div className="space-y-4 pt-4 border-t">
                                <div className="grid gap-2">
                                    <Label htmlFor="printer-type">{t("printerType")}</Label>
                                    <Select
                                        value={printerSettings.type}
                                        onValueChange={(value: 'browser' | 'network' | 'usb') => 
                                            updatePrinterSettings({ type: value })
                                        }
                                    >
                                        <SelectTrigger id="printer-type">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="browser">{t("browser")}</SelectItem>
                                            <SelectItem value="network">{t("network")}</SelectItem>
                                            <SelectItem value="usb">{t("usb")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="printer-name">{t("printerName")}</Label>
                                    <Input
                                        id="printer-name"
                                        value={printerSettings.name}
                                        onChange={(e) => updatePrinterSettings({ name: e.target.value })}
                                        placeholder="Ex: Impressora Térmica 01"
                                    />
                                </div>

                                {/* Campos de endereço de rede - sempre visíveis quando impressora habilitada */}
                                <div className="space-y-4 pt-2 border-t">
                                    <h4 className="text-sm font-medium">Endereço da Impressora de Rede</h4>
                                    
                                    <div className="grid gap-2">
                                        <Label htmlFor="printer-ip">{t("printerIpAddress")}</Label>
                                        <Input
                                            id="printer-ip"
                                            type="text"
                                            value={printerSettings.ipAddress}
                                            onChange={(e) => updatePrinterSettings({ ipAddress: e.target.value })}
                                            placeholder="192.168.1.100"
                                            disabled={printerSettings.type === 'browser'}
                                        />
                                        {printerSettings.type === 'browser' && (
                                            <p className="text-xs text-muted-foreground">
                                                Configure apenas quando usar impressora de rede
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div className="grid gap-2">
                                        <Label htmlFor="printer-port">{t("printerPort")}</Label>
                                        <Input
                                            id="printer-port"
                                            type="number"
                                            value={printerSettings.port}
                                            onChange={(e) => updatePrinterSettings({ port: parseInt(e.target.value) || 9100 })}
                                            placeholder="9100"
                                            min="1"
                                            max="65535"
                                            disabled={printerSettings.type === 'browser'}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Porta padrão: 9100 (RAW), 631 (IPP), 515 (LPR)
                                        </p>
                                    </div>

                                    {printerSettings.type === 'network' && (
                                        <div className="pt-2">
                                            <Button
                                                onClick={handleTestConnection}
                                                disabled={isTesting || !printerSettings.ipAddress || !printerSettings.port}
                                                variant="outline"
                                                className="w-full flex items-center justify-center gap-2"
                                            >
                                                <TestTube className="w-4 h-4" />
                                                {isTesting ? 'Testando...' : 'Testar Conexão'}
                                            </Button>
                                            {testStatus && (
                                                <div className={`mt-2 p-3 rounded-md text-sm ${
                                                    testStatus.success 
                                                        ? 'bg-green-100 text-green-700' 
                                                        : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {testStatus.message}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="paper-size">{t("paperSize")}</Label>
                                    <Select
                                        value={printerSettings.paperSize}
                                        onValueChange={(value: '80mm' | '58mm' | 'A4') => 
                                            updatePrinterSettings({ paperSize: value })
                                        }
                                    >
                                        <SelectTrigger id="paper-size">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="80mm">{t("printer80mm")}</SelectItem>
                                            <SelectItem value="58mm">{t("printer58mm")}</SelectItem>
                                            <SelectItem value="A4">{t("printerA4")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="auto-print">{t("autoPrint")}</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Imprimir automaticamente ao criar pedidos
                                        </p>
                                    </div>
                                    <Switch
                                        id="auto-print"
                                        checked={printerSettings.autoPrint}
                                        onCheckedChange={(checked) => updatePrinterSettings({ autoPrint: checked })}
                                    />
                                </div>
                            </div>
                        )}
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
                        <div className="flex justify-between">
                            <span>Impressora:</span>
                            <span className="font-medium">
                                {printerSettings.enabled 
                                    ? `${printerSettings.name || 'Sem nome'} (${printerSettings.type})` 
                                    : 'Desativado'}
                            </span>
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
