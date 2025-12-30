import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import { Badge } from "../components/ui/badge"
import { Save, RefreshCw, CheckCircle, XCircle, Clock, ShoppingBag, Copy, ExternalLink } from "lucide-react"
import { useAuth } from "../context/AuthContext"

interface IfoodConfig {
  merchant_id: string
  client_id: string
  client_secret: string
  authorization_code?: string
  polling_interval: number
  is_active: boolean
}

interface IfoodStatus {
  configured: boolean
  active: boolean
  authenticated: boolean
  last_sync: string | null
  polling_interval: number | null
  webhook_url: string | null
}

interface ProductMapping {
  id: number
  ifood_product_id: string
  ifood_sku: string | null
  product_id: number
  products: {
    id: number
    name: string
    price: number
    sku: string | null
  } | null
}

export function IfoodIntegration() {
  const { hasPermission } = useAuth()
  const [config, setConfig] = useState<IfoodConfig>({
    merchant_id: "",
    client_id: "",
    client_secret: "",
    authorization_code: "",
    polling_interval: 30,
    is_active: false
  })
  const [status, setStatus] = useState<IfoodStatus | null>(null)
  const [mappings, setMappings] = useState<ProductMapping[]>([])
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

  useEffect(() => {
    if (hasPermission('admin')) {
      loadConfig()
      loadStatus()
      loadMappings()
    }
  }, [hasPermission])

  const loadConfig = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/ifood/config`)
      const result = await response.json()
      
      if (result.success && result.config) {
        setConfig({
          merchant_id: result.config.merchant_id || "",
          client_id: result.config.client_id || "",
          client_secret: "", // Never load secret back
          authorization_code: result.config.authorization_code || "",
          polling_interval: result.config.polling_interval || 30,
          is_active: result.config.is_active || false
        })
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  const loadStatus = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/ifood/status`)
      const result = await response.json()
      
      if (result.success) {
        setStatus(result.status)
      }
    } catch (error) {
      console.error('Error loading status:', error)
    }
  }

  const loadMappings = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/ifood/mapping`)
      const result = await response.json()
      
      if (result.success) {
        setMappings(result.mappings || [])
      }
    } catch (error) {
      console.error('Error loading mappings:', error)
    }
  }

  const handleSave = async () => {
    if (!config.merchant_id || !config.client_id || !config.client_secret) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      console.log('Enviando configuração para:', `${backendUrl}/api/ifood/config`)
      
      const response = await fetch(`${backendUrl}/api/ifood/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      })

      console.log('Resposta recebida:', response.status, response.statusText)

      if (!response.ok) {
        // Tentar ler o erro da resposta
        let errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } catch (e) {
          // Se não conseguir ler JSON, usar mensagem padrão
        }
        setMessage({ type: 'error', text: errorMessage })
        return
      }

      const result = await response.json()
      console.log('Resultado:', result)

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Configuração salva com sucesso!' })
        setConfig(prev => ({ ...prev, client_secret: "" })) // Clear secret after saving
        await loadStatus()
      } else {
        setMessage({ type: 'error', text: result.message || 'Erro ao salvar configuração' })
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
      const errorMessage = error instanceof Error 
        ? `Erro de conexão: ${error.message}. Verifique se o backend está rodando em ${backendUrl}`
        : 'Erro de conexão com o servidor. Verifique se o backend está rodando.'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setMessage(null)

    try {
      const response = await fetch(`${backendUrl}/api/ifood/sync`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: 'Sincronização iniciada' })
        setTimeout(() => {
          loadStatus()
          loadMappings()
        }, 2000)
      } else {
        setMessage({ type: 'error', text: result.message || 'Erro ao sincronizar' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro de conexão com o servidor' })
    } finally {
      setSyncing(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca'
    return new Date(dateString).toLocaleString('pt-BR')
  }

  if (!hasPermission('admin')) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integração iFood</h1>
        <p className="text-muted-foreground mt-2">
          Configure e gerencie a integração com o iFood para receber pedidos automaticamente
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Status da Integração</CardTitle>
          <CardDescription>Informações sobre o estado atual da integração</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Configurado:</span>
            {status?.configured ? (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Sim
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                <XCircle className="h-3 w-3 mr-1" />
                Não
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Ativo:</span>
            {status?.active ? (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Sim
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                <XCircle className="h-3 w-3 mr-1" />
                Não
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Autenticado:</span>
            {status?.authenticated ? (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Sim
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                <XCircle className="h-3 w-3 mr-1" />
                Não
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Última Sincronização:</span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(status?.last_sync || null)}
            </span>
          </div>

          {status?.polling_interval && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Intervalo de Polling:</span>
              <span className="text-sm text-muted-foreground">{status.polling_interval}s</span>
            </div>
          )}

          <Button 
            onClick={handleSync} 
            disabled={syncing || !status?.configured}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </Button>
        </CardContent>
      </Card>

      {/* Webhook URL Card */}
      {status?.configured && status?.webhook_url && (
        <Card>
          <CardHeader>
            <CardTitle>URL do Webhook</CardTitle>
            <CardDescription>
              Configure esta URL no painel do iFood para receber pedidos via webhook
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={status.webhook_url}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(status.webhook_url || '')
                    setMessage({ type: 'success', text: 'URL copiada para a área de transferência!' })
                    setTimeout(() => setMessage(null), 3000)
                  }}
                  title="Copiar URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(status.webhook_url || '', '_blank')}
                  title="Abrir URL"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copie esta URL e configure no painel do iFood em "Configurações de Integração" → "Webhooks"
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>
            Configure suas credenciais do iFood. O client_secret será criptografado antes de ser armazenado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="merchant_id">Merchant ID *</Label>
            <Input
              id="merchant_id"
              type="text"
              value={config.merchant_id}
              onChange={(e) => setConfig(prev => ({ ...prev, merchant_id: e.target.value }))}
              placeholder="ID do estabelecimento no iFood"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_id">Client ID *</Label>
            <Input
              id="client_id"
              type="text"
              value={config.client_id}
              onChange={(e) => setConfig(prev => ({ ...prev, client_id: e.target.value }))}
              placeholder="Client ID da API do iFood"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_secret">Client Secret *</Label>
            <Input
              id="client_secret"
              type="password"
              value={config.client_secret}
              onChange={(e) => setConfig(prev => ({ ...prev, client_secret: e.target.value }))}
              placeholder="Client Secret da API do iFood"
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para manter o secret atual. Será criptografado antes de ser armazenado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="authorization_code">Authorization Code (Código de Autorização)</Label>
            <Input
              id="authorization_code"
              type="text"
              value={config.authorization_code || ""}
              onChange={(e) => setConfig(prev => ({ ...prev, authorization_code: e.target.value }))}
              placeholder="Código de autorização do iFood (opcional)"
            />
            <p className="text-xs text-muted-foreground">
              Código de autorização fornecido pelo iFood durante o processo de integração OAuth.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="polling_interval">Intervalo de Polling (segundos)</Label>
            <Input
              id="polling_interval"
              type="number"
              min="10"
              max="300"
              value={config.polling_interval}
              onChange={(e) => setConfig(prev => ({ ...prev, polling_interval: parseInt(e.target.value) || 30 }))}
            />
            <p className="text-xs text-muted-foreground">
              Intervalo em segundos para verificar novos pedidos (mínimo: 10s, máximo: 300s)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Ativar Integração</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativado, o sistema buscará pedidos automaticamente
              </p>
            </div>
            <Switch
              id="is_active"
              checked={config.is_active}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_active: checked }))}
            />
          </div>

          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </CardContent>
      </Card>

      {/* Product Mappings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Mapeamento de Produtos</CardTitle>
          <CardDescription>
            Produtos do iFood mapeados para produtos do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum mapeamento encontrado. Os produtos serão mapeados automaticamente por SKU quando os pedidos chegarem.
            </p>
          ) : (
            <div className="space-y-4">
              {mappings.map((mapping) => (
                <div 
                  key={mapping.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {mapping.products?.name || `Produto ID: ${mapping.product_id}`}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span>iFood ID: {mapping.ifood_product_id}</span>
                      {mapping.ifood_sku && (
                        <span className="ml-4">SKU: {mapping.ifood_sku}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      R$ {mapping.products?.price?.toFixed(2) || '0.00'}
                    </div>
                    {mapping.products?.sku && (
                      <div className="text-xs text-muted-foreground">
                        SKU: {mapping.products.sku}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

