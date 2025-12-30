import { createContext, useContext, type ReactNode } from "react"
import { translations, type Language, type ExtendedTranslationKey } from "../translations"
import { useSettings } from "./SettingsContext"

interface LanguageContextType {
    language: Language
    setLanguage: (lang: Language) => void
    t: (key: ExtendedTranslationKey) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
    const { settings, updateSettings } = useSettings()
    // Usar o idioma das configurações ou padrão 'pt'
    const language: Language = (settings?.language as Language) || "pt"

    const setLanguage = (lang: Language) => {
        updateSettings({ language: lang })
    }

    const t = (key: ExtendedTranslationKey) => {
        const translation = translations[language]
        if (key in translation) {
            const value = (translation as any)[key]
            // Se o valor é uma string, retornar. Se for objeto, retornar a chave
            return typeof value === 'string' ? value : key
        }
        return key
    }

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (context === undefined) {
        throw new Error("useLanguage must be used within a LanguageProvider")
    }
    return context
}
