/**
 * Backend configuration
 * Tries to get URL from:
 * 1. Window.APP_CONFIG (from public/config.js) - for GitHub Pages
 * 2. VITE_BACKEND_URL (environment variable) - for development
 * 3. Default localhost - fallback
 */

declare global {
  interface Window {
    APP_CONFIG?: {
      BACKEND_URL?: string
    }
  }
}

export function getBackendUrl(): string {
  // Try to get from window config (for GitHub Pages)
  if (typeof window !== 'undefined' && window.APP_CONFIG?.BACKEND_URL) {
    return window.APP_CONFIG.BACKEND_URL
  }
  
  // Try to get from environment variable (for development)
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL
  }
  
  // Fallback to localhost
  return 'http://localhost:3000'
}



