# Backend de Impressão - Restaurant App

Backend Node.js para impressão de rede de recibos.

## Configuração

1. Instalar dependências:
```bash
npm install
```

2. Criar arquivo `.env` baseado em `.env.example`:
```bash
cp .env.example .env
```

3. Configurar variáveis de ambiente no `.env`:
- `BACKEND_PORT`: Porta do servidor (padrão: 3000)
- `FRONTEND_URL`: URL do frontend para CORS
- `PRINTER_TIMEOUT`: Timeout de conexão com impressora em ms (padrão: 5000)
- `SUPABASE_URL`: URL do projeto Supabase (obrigatório para integração iFood)
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key do Supabase (obrigatório para integração iFood)
- `IFOOD_ENCRYPTION_KEY`: Chave OBRIGATÓRIA (mín. 32 caracteres ou 64 hex) para criptografar credenciais do iFood. O backend não inicia sem esta variável.
- `IFOOD_API_TIMEOUT`: Timeout para requisições à API do iFood em ms (padrão: 30000)
- `BACKEND_URL` ou `BACKEND_PUBLIC_URL`: URL pública do backend para webhooks (opcional)

**Importante**: Consulte `IFOOD_BEST_PRACTICES.md` antes de fazer alterações no código de integração com iFood.

## Documentação iFood

Para referência completa da API do iFood, consulte:

- **`IFOOD_API_REFERENCE.md`** - Referência completa com links para documentação oficial
- **`IFOOD_BEST_PRACTICES.md`** - Boas práticas recomendadas pelo iFood
- **`TROUBLESHOOTING_IFOOD.md`** - Guia de resolução de problemas

**Documentação Oficial do iFood**:
- Swagger/API Reference: https://developer.ifood.com.br/pt-BR/docs/references/
- Guia de Documentação: https://developer.ifood.com.br/pt-BR/docs/guides/
- Endpoint OAuth Token: https://developer.ifood.com.br/pt-BR/docs/references/#operations-OAuth-oauthTokenV1

## Desenvolvimento

```bash
npm run dev
```

O servidor estará disponível em `http://localhost:3000`

## Build

```bash
npm run build
```

## Produção

```bash
npm start
```

## Endpoints

### Integração iFood

#### POST `/api/ifood/config`
Configura credenciais da integração com iFood.

#### GET `/api/ifood/config`
Obtém configuração atual da integração.

#### POST `/api/ifood/webhook`
Endpoint para receber webhooks do iFood.

#### GET `/api/ifood/status`
Obtém status da integração.

### Impressora

#### POST `/api/printer/test`
Testa conexão com impressora de rede.

**Body:**
```json
{
  "ipAddress": "192.168.1.100",
  "port": 9100,
  "protocol": "raw"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Conexão estabelecida com sucesso"
}
```

### POST `/api/printer/print`
Envia trabalho de impressão.

**Body:**
```json
{
  "printerConfig": {
    "ipAddress": "192.168.1.100",
    "port": 9100,
    "protocol": "raw",
    "paperSize": "80mm"
  },
  "printData": {
    "orderId": "ORD-001",
    "customer": "João Silva",
    "items": [...],
    "total": 50.00
  }
}
```

## Protocolos Suportados

- **RAW** (porta 9100): Protocolo mais comum para impressoras térmicas
- **IPP** (portas 631, 80, 443): Internet Printing Protocol (implementação básica)
- **LPR** (porta 515): Line Printer Protocol (implementação básica)

## Docker

O backend está configurado para rodar no Docker através do `docker-compose.yml` na raiz do projeto.




