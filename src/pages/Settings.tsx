import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Label } from "../components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select"
import { useLanguage } from "../context/LanguageContext"

export function Settings() {
    const { language, setLanguage, t } = useLanguage()

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
            </div>
        </div>
    )
}
