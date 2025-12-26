import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import type { UserRole } from '../../context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { AlertCircle } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: UserRole | UserRole[]
  requireAuth?: boolean
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  requireAuth = true 
}: ProtectedRouteProps) {
  const { user, profile, isLoading, hasPermission } = useAuth()
  const { t } = useLanguage()

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('loading') || 'Carregando...'}</p>
        </div>
      </div>
    )
  }

  // If authentication is required but user is not logged in
  if (requireAuth && !user) {
    return <Navigate to="/login" replace />
  }

  // If role is required, always check permissions (fail-safe: deny access if profile is missing)
  if (requiredRole) {
    // If there's no profile when a role is required, deny access for security
    if (!profile) {
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-destructive/10 p-3">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-center">
                {t('accessDenied') || 'Acesso Negado'}
              </CardTitle>
              <CardDescription className="text-center">
                {t('accessDeniedMessage') || 'Você não tem permissão para acessar esta página'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => window.history.back()}>
                {t('back') || 'Voltar'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    // Check permissions - hasPermission already returns false if profile is null
    if (!hasPermission(requiredRole)) {
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-destructive/10 p-3">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-center">
                {t('accessDenied') || 'Acesso Negado'}
              </CardTitle>
              <CardDescription className="text-center">
                {t('accessDeniedMessage') || 'Você não tem permissão para acessar esta página'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => window.history.back()}>
                {t('back') || 'Voltar'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
  }

  // User is authenticated and has required permissions
  return <>{children}</>
}

