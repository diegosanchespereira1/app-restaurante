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

### POST `/api/printer/test`
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




