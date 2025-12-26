import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

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
  enableTables: true,
  enableOrderDisplay: false,
  printer: defaultPrinterSettings
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = localStorage.getItem('restaurant-settings')
        console.log('Loading settings from localStorage:', savedSettings)
        
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings)
          console.log('Parsed settings:', parsed)
          
          // Merge saved settings with defaults to handle new settings that might be added
          const mergedSettings = { ...defaultSettings, ...parsed }
          console.log('Merged settings:', mergedSettings)
          
          setSettings(mergedSettings)
        } else {
          console.log('No saved settings found, using defaults')
          setSettings(defaultSettings)
        }
      } catch (error) {
        console.error('Error loading settings from localStorage:', error)
        setSettings(defaultSettings)
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem('restaurant-settings', JSON.stringify(settings))
        console.log('Settings saved to localStorage:', settings)
      } catch (error) {
        console.error('Error saving settings to localStorage:', error)
      }
    }
  }, [settings, isLoading])

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

  const saveSettings = () => {
    try {
      localStorage.setItem('restaurant-settings', JSON.stringify(settings))
      console.log('Settings manually saved:', settings)
      // You could add a toast notification here
    } catch (error) {
      console.error('Error manually saving settings:', error)
    }
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
    try {
      localStorage.removeItem('restaurant-settings')
      console.log('Settings reset to defaults')
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