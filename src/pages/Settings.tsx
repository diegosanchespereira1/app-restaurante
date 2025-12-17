import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select"
import { useLanguage } from "../context/LanguageContext"
import { useSettings } from "../context/SettingsContext"

export function Settings() {
    const { language, setLanguage, t } = useLanguage()
    const { updateSettings, isTablesEnabled, isOrderDisplayEnabled } = useSettings()

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">{t("settingsTitle")}</h2>
                <p className="text-muted-foreground">{t("settingsDescription")}</p>
            </div>

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
                                    Disponível em: /order-display
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
        </div>
    )
}
