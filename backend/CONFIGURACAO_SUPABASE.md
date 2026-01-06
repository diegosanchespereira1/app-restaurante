# Como Configurar as Variáveis do Supabase

## 📍 Localização do Arquivo

Crie um arquivo chamado `.env` na pasta `backend/` do projeto:

```
app-restaurante/
└── backend/
    ├── .env          ← CRIE ESTE ARQUIVO AQUI
    ├── package.json
    ├── src/
    └── ...
```

## 🔑 Como Obter as Credenciais do Supabase

### 1. Acesse o Painel do Supabase

1. Vá para: https://app.supabase.com
2. Faça login na sua conta
3. Selecione seu projeto (ou crie um novo)

### 2. Obter SUPABASE_URL

1. No painel do Supabase, vá em **Settings** (Configurações)
2. Clique em **API** no menu lateral
3. Na seção **Project URL**, copie a URL
   - Formato: `https://xxxxxxxxxxxxx.supabase.co`

### 3. Obter SUPABASE_SERVICE_ROLE_KEY

1. Ainda na página **Settings > API**
2. Na seção **Project API keys**, encontre a chave **`service_role`** (secret)
3. Clique em **Reveal** para mostrar a chave
4. **⚠️ ATENÇÃO**: Esta chave tem privilégios totais no banco de dados
   - NUNCA compartilhe publicamente
   - NUNCA use no frontend
   - Use apenas no backend

## 📝 Criar o Arquivo .env

### Passo 1: Criar o arquivo

Na pasta `backend/`, crie um arquivo chamado `.env`:

```bash
cd backend
touch .env
```

### Passo 2: Adicionar as variáveis

Abra o arquivo `.env` e adicione:

```env
# Supabase - OBRIGATÓRIO
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# Backend
BACKEND_PORT=3000
FRONTEND_URL=http://localhost:5173

# Impressora
PRINTER_TIMEOUT=5000

# iFood (obrigatório)
# Mínimo 32 caracteres (ou 64 em hexadecimal). O backend não inicia sem esta chave.
IFOOD_ENCRYPTION_KEY=
IFOOD_API_TIMEOUT=30000
```

### Passo 3: Substituir os valores

Substitua:
- `https://seu-projeto.supabase.co` pela sua URL do Supabase
- `sua-service-role-key-aqui` pela sua Service Role Key

## ✅ Verificar se está funcionando

1. Inicie o backend:
```bash
cd backend
npm run dev
```

2. Se aparecer a mensagem:
```
🚀 Servidor backend rodando na porta 3000
```

E **NÃO** aparecer erros sobre Supabase, está configurado corretamente!

## 🔒 Segurança

- O arquivo `.env` está no `.gitignore` e não será commitado
- NUNCA compartilhe suas credenciais
- NUNCA faça commit do arquivo `.env` no Git

## 📸 Exemplo Visual

```
backend/
├── .env                    ← Arquivo de configuração (não commitado)
├── .env.example            ← Exemplo (pode ser commitado)
├── package.json
└── src/
```

## 🆘 Problemas Comuns

### Erro: "Supabase credentials not configured"
- Verifique se o arquivo `.env` está na pasta `backend/`
- Verifique se as variáveis estão escritas corretamente (sem espaços extras)
- Reinicie o servidor após criar/modificar o `.env`

### Erro: "Invalid API key"
- Verifique se copiou a chave completa (é muito longa)
- Certifique-se de usar a `service_role` key, não a `anon` key

