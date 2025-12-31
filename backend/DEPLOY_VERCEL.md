# Deploy do Backend no Vercel

## ⚠️ Importante

**GitHub Pages só serve arquivos estáticos** e não pode executar Node.js. Você precisa hospedar o backend em outro serviço.

## 🚀 Opção Recomendada: Vercel (Gratuito)

### Por que Vercel?

- ✅ Gratuito para projetos pessoais
- ✅ Suporta Node.js/Express
- ✅ Deploy automático via GitHub
- ✅ HTTPS automático
- ✅ Fácil configuração
- ✅ Serverless (escala automaticamente)

### Passo a Passo

#### 1. Preparar o Repositório

O código já está preparado! Os arquivos necessários foram criados:
- `backend/vercel.json` - Configuração do Vercel
- `backend/api/index.ts` - Entry point para Vercel
- `backend/src/server.ts` - Ajustado para funcionar no Vercel

#### 2. Fazer Deploy no Vercel

1. **Acesse**: https://vercel.com
2. **Faça login** com sua conta GitHub
3. **Clique em "Add New Project"**
4. **Importe o repositório** `app-restaurante`
5. **Configure o projeto**:
   - **Root Directory**: `backend` (clique em "Edit" e digite `backend`)
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist` (pode deixar vazio, não é usado)
   - **Install Command**: `npm install`

6. **Adicione as variáveis de ambiente** (Settings > Environment Variables):
   ```
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   FRONTEND_URL=https://diegosanchespereira1.github.io
   IFOOD_ENCRYPTION_KEY=chave-opcional-para-criptografia
   IFOOD_API_TIMEOUT=30000
   ```

7. **Clique em "Deploy"**

#### 3. Obter a URL do Backend

Após o deploy (2-3 minutos), você receberá uma URL como:
```
https://app-restaurante-backend.vercel.app
```

#### 4. Configurar o Frontend

1. **Edite o arquivo** `public/config.js`:
```javascript
window.APP_CONFIG = {
  BACKEND_URL: 'https://app-restaurante-backend.vercel.app' // SUA URL DO VERCEL
}
```

2. **Faça commit e push**:
```bash
git add public/config.js
git commit -m "Configurar URL do backend"
git push
```

3. **Faça rebuild do frontend**:
```bash
npm run build
npm run deploy
```

#### 5. Verificar se está funcionando

1. Acesse sua aplicação no GitHub Pages
2. Vá em Configurações > iFood
3. O sistema deve conseguir conectar ao backend

## 🔄 Alternativas ao Vercel

### Railway (Recomendado para backends tradicionais)

1. Acesse: https://railway.app
2. Conecte seu GitHub
3. Crie novo projeto
4. Adicione serviço "Empty Service"
5. Conecte ao repositório
6. Configure:
   - Root: `backend`
   - Build: `npm install && npm run build`
   - Start: `npm start`
7. Adicione variáveis de ambiente
8. Railway fornecerá uma URL pública

### Render

1. Acesse: https://render.com
2. Conecte GitHub
3. New > Web Service
4. Conecte repositório
5. Configure:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
6. Adicione variáveis de ambiente
7. Render fornecerá uma URL pública

## 📝 Notas Importantes

### Polling no Vercel

O Vercel é serverless, então o polling do iFood não funciona da mesma forma. Opções:

1. **Usar apenas webhooks** (recomendado)
   - Configure webhooks no iFood
   - O endpoint `/api/ifood/webhook` funcionará normalmente

2. **Usar Vercel Cron Jobs** (para polling)
   - Configure em `vercel.json`:
   ```json
   "crons": [{
     "path": "/api/ifood/sync",
     "schedule": "*/30 * * * * *"
   }]
   ```

### CORS

O backend já está configurado para aceitar requisições do GitHub Pages:
- `https://diegosanchespereira1.github.io`
- Qualquer subdomínio `*.github.io`

## 🆘 Troubleshooting

### Erro de CORS
- Verifique se `FRONTEND_URL` está configurado no Vercel
- Deve ser: `https://diegosanchespereira1.github.io`

### Backend não responde
- Verifique os logs no Vercel Dashboard
- Verifique se as variáveis de ambiente estão configuradas
- Teste a URL diretamente: `https://seu-backend.vercel.app/health`

### Variáveis de ambiente não funcionam
- No Vercel, vá em Settings > Environment Variables
- Certifique-se de adicionar para "Production"
- Faça redeploy após adicionar variáveis

