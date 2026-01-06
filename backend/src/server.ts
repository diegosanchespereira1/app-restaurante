import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import printerRoutes from './routes/printer.js'
import ifoodRoutes from './routes/ifood.js'
import { IfoodPollingService } from './services/ifood-polling.js'
import { getEncryptionKey } from './utils/encryption.js'

// Carregar variáveis de ambiente
dotenv.config()

try {
  getEncryptionKey()
} catch (error) {
  console.error('Erro de configuração: IFOOD_ENCRYPTION_KEY inválida ou ausente')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const app = express()
const PORT = parseInt(process.env.BACKEND_PORT || '3000', 10)

// Middlewares
// CORS: Permitir GitHub Pages e localhost
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://diegosanchespereira1.github.io',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean) as string[]

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.includes(origin) || origin.includes('github.io')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Logging básico
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Rotas
app.use('/api/printer', printerRoutes)
app.use('/api/ifood', ifoodRoutes)

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    name: 'Restaurant Printer Backend',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      testConnection: 'POST /api/printer/test',
      print: 'POST /api/printer/print'
    }
  })
})

// Rota catch-all para rotas não encontradas (404)
app.use((req: express.Request, res: express.Response) => {
  console.warn(`[404] Rota não encontrada: ${req.method} ${req.path}`)
  res.status(404).json({
    success: false,
    message: `Rota não encontrada: ${req.method} ${req.path}`,
    path: req.path,
    method: req.method
  })
})

// Tratamento de erros
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erro não tratado:', err)
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

// Exportar app para Vercel (serverless)
// No Vercel, este será o handler da função serverless
export default app

// Iniciar servidor apenas se não estiver no Vercel
// O Vercel não executa este código, apenas usa o export default
if (typeof process !== 'undefined' && !process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`🚀 Servidor backend rodando na porta ${PORT}`)
    console.log(`📡 Frontend esperado em: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`)
    console.log(`⏱️  Timeout de impressora: ${process.env.PRINTER_TIMEOUT || '5000'}ms`)
    
    // Inicializar serviço de polling do iFood
    try {
      const pollingService = new IfoodPollingService()
      await pollingService.start()
      console.log('✅ Serviço de polling do iFood inicializado')
    } catch (error) {
      console.error('⚠️  Erro ao inicializar serviço de polling do iFood:', error)
      console.log('   (Isso é normal se a integração não estiver configurada)')
    }
  })
}




