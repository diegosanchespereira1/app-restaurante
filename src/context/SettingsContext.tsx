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
  saveSettings: () => void
  resetSettings: () => void
  isLoading: boolean
}

const defaultSettings: Settings = {
  enableTables: true,
  enableOrderDisplay: false
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

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        isTablesEnabled,
        isOrderDisplayEnabled,
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