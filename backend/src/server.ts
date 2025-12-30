import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import printerRoutes from './routes/printer.js'
import ifoodRoutes from './routes/ifood.js'
import { IfoodPollingService } from './services/ifood-polling.js'

// Carregar variáveis de ambiente
dotenv.config()

const app = express()
const PORT = parseInt(process.env.BACKEND_PORT || '3000', 10)

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

// Tratamento de erros
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erro não tratado:', err)
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor'
  })
})

// Iniciar servidor
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




