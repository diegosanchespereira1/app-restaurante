import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/card'
import { Loader2 } from 'lucide-react'
import { Logo } from '../components/ui/Logo'

export function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { signIn } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const result = await signIn(emailOrUsername, password)
    
    if (result.success) {
      navigate('/')
    } else {
      setError(result.error || 'Erro ao fazer login')
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" showText={true} />
          </div>
          <CardDescription>
            {t('loginDescription') || 'Entre com suas credenciais para acessar o sistema'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="emailOrUsername">{t('emailOrUsername') || 'Email ou Nome de Usuário'}</Label>
              <Input
                id="emailOrUsername"
                type="text"
                placeholder={t('emailOrUsernamePlaceholder') || 'seu@email.com ou nomeusuario'}
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password') || 'Senha'}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('passwordPlaceholder') || '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('loggingIn') || 'Entrando...'}
                </>
              ) : (
                t('login') || 'Entrar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

