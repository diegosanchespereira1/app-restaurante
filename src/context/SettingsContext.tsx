import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface Settings {
  enableTables: boolean
  enableOrderDisplay: boolean
}

interface SettingsContextType {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
  isTablesEnabled: boolean
  isOrderDisplayEnabled: boolean
}

const defaultSettings: Settings = {
  enableTables: true,
  enableOrderDisplay: false
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('restaurant-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      } catch (error) {
        console.error('Error parsing saved settings:', error)
      }
    }
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('restaurant-settings', JSON.stringify(settings))
  }, [settings])

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  const isTablesEnabled = settings.enableTables
  const isOrderDisplayEnabled = settings.enableOrderDisplay

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        isTablesEnabled,
        isOrderDisplayEnabled
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