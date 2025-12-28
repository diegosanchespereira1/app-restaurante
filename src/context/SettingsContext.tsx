import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Language } from '../translations'

interface PrinterSettings {
  enabled: boolean
  type: 'browser' | 'network' | 'usb'
  name: string
  ipAddress: string
  port: number
  paperSize: '80mm' | '58mm' | 'A4'
  autoPrint: boolean
}

interface Settings {
  language: Language
  enableTables: boolean
  enableOrderDisplay: boolean
  printer: PrinterSettings
}

interface SettingsContextType {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
  updatePrinterSettings: (printerSettings: Partial<PrinterSettings>) => void
  isTablesEnabled: boolean
  isOrderDisplayEnabled: boolean
  printerSettings: PrinterSettings
  saveSettings: () => void
  resetSettings: () => void
  isLoading: boolean
}

const defaultPrinterSettings: PrinterSettings = {
  enabled: false,
  type: 'browser',
  name: '',
  ipAddress: '',
  port: 9100,
  paperSize: '80mm',
  autoPrint: false
}

const defaultSettings: Settings = {
  language: 'pt',
  enableTables: true,
  enableOrderDisplay: false,
  printer: defaultPrinterSettings
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const { user, profile } = useAuth()
  const isInitialLoad = useRef(true)
  const isSavingRef = useRef(false)

  // Verificar se o usuário é admin
  const isAdmin = profile?.role === 'admin'

  // Load settings from database or localStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Se o Supabase estiver configurado, carregar configurações globais do banco
        if (isSupabaseConfigured) {
          console.log('Loading global settings from database')
          
          const { data, error } = await supabase
            .from('app_settings')
            .select('settings')
            .eq('id', 'global')
            .single()

          if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error loading settings from database:', error)
            // Fallback para localStorage em caso de erro
            loadFromLocalStorage()
          } else if (data && data.settings) {
            console.log('Settings loaded from database:', data.settings)
            // Merge com defaults para garantir que novas configurações sejam incluídas
            const mergedSettings = { ...defaultSettings, ...data.settings }
            setSettings(mergedSettings)
          } else {
            console.log('No settings found in database, using defaults')
            setSettings(defaultSettings)
          }
        } else {
          // Modo demo: usar localStorage
          console.log('Loading settings from localStorage (demo mode)')
          loadFromLocalStorage()
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        loadFromLocalStorage()
      } finally {
        setIsLoading(false)
        isInitialLoad.current = false
      }
    }

    const loadFromLocalStorage = () => {
      try {
        const savedSettings = localStorage.getItem('restaurant-settings')
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings)
          const mergedSettings = { ...defaultSettings, ...parsed }
          setSettings(mergedSettings)
        } else {
          setSettings(defaultSettings)
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error)
        setSettings(defaultSettings)
      }
    }

    loadSettings()
  }, []) // Carregar apenas uma vez ao montar

  // Save settings to database or localStorage (apenas se for admin)
  useEffect(() => {
    // Não salvar durante o carregamento inicial
    // Apenas admins podem salvar
    if (isLoading || isInitialLoad.current || isSavingRef.current || !isAdmin) {
      return
    }

    const saveSettings = async () => {
      isSavingRef.current = true
      
      try {
        // Se o Supabase estiver configurado e o usuário for admin, salvar no banco
        if (isSupabaseConfigured && isAdmin) {
          console.log('Saving global settings to database (admin user)')
          
          const { error } = await supabase
            .from('app_settings')
            .upsert({
              id: 'global',
              settings: settings,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            })

          if (error) {
            console.error('Error saving settings to database:', error)
            // Fallback para localStorage em caso de erro
            saveToLocalStorage()
          } else {
            console.log('Settings saved to database successfully')
          }
        } else {
          // Modo demo: usar localStorage
          saveToLocalStorage()
        }
      } catch (error) {
        console.error('Error saving settings:', error)
        saveToLocalStorage()
      } finally {
        isSavingRef.current = false
      }
    }

    const saveToLocalStorage = () => {
      try {
        localStorage.setItem('restaurant-settings', JSON.stringify(settings))
        console.log('Settings saved to localStorage:', settings)
      } catch (error) {
        console.error('Error saving to localStorage:', error)
      }
    }

    // Debounce: aguardar 500ms antes de salvar para evitar muitas chamadas
    const timeoutId = setTimeout(() => {
      saveSettings()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [settings, isAdmin, isLoading])

  const updateSettings = (newSettings: Partial<Settings>) => {
    console.log('Updating settings:', newSettings)
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  const updatePrinterSettings = (printerSettings: Partial<PrinterSettings>) => {
    console.log('Updating printer settings:', printerSettings)
    setSettings(prev => ({
      ...prev,
      printer: { ...prev.printer, ...printerSettings }
    }))
  }

  const saveSettings = async () => {
    // Apenas admins podem salvar configurações
    if (!isAdmin) {
      console.warn('Only admins can save settings')
      return
    }

    try {
      // Se o Supabase estiver configurado e o usuário for admin, salvar no banco
      if (isSupabaseConfigured && isAdmin) {
        console.log('Manually saving global settings to database (admin user)')
        
        const { error } = await supabase
          .from('app_settings')
          .upsert({
            id: 'global',
            settings: settings,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })

        if (error) {
          console.error('Error manually saving settings to database:', error)
          // Fallback para localStorage
          localStorage.setItem('restaurant-settings', JSON.stringify(settings))
        } else {
          console.log('Settings manually saved to database successfully')
        }
      } else {
        // Modo demo: usar localStorage
        localStorage.setItem('restaurant-settings', JSON.stringify(settings))
        console.log('Settings manually saved to localStorage:', settings)
      }
    } catch (error) {
      console.error('Error manually saving settings:', error)
    }
  }

  const resetSettings = async () => {
    // Apenas admins podem resetar configurações
    if (!isAdmin) {
      console.warn('Only admins can reset settings')
      return
    }

    setSettings(defaultSettings)
    
    try {
      // Se o Supabase estiver configurado e o usuário for admin, resetar no banco
      if (isSupabaseConfigured && isAdmin) {
        console.log('Resetting global settings in database (admin user)')
        
        const { error } = await supabase
          .from('app_settings')
          .upsert({
            id: 'global',
            settings: defaultSettings,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })

        if (error) {
          console.error('Error resetting settings in database:', error)
          // Fallback para localStorage
          localStorage.removeItem('restaurant-settings')
        } else {
          console.log('Settings reset in database successfully')
        }
      } else {
        // Modo demo: usar localStorage
        localStorage.removeItem('restaurant-settings')
        console.log('Settings reset in localStorage')
      }
    } catch (error) {
      console.error('Error resetting settings:', error)
    }
  }

  const isTablesEnabled = settings.enableTables
  const isOrderDisplayEnabled = settings.enableOrderDisplay
  const printerSettings = settings.printer

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        updatePrinterSettings,
        isTablesEnabled,
        isOrderDisplayEnabled,
        printerSettings,
        saveSettings,
        resetSettings,
        isLoading
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}

export type { PrinterSettings }