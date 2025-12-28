# Plano de Unificação do Cadastro de Produtos

## Objetivo
Criar um sistema único e unificado para cadastro de produtos, eliminando a confusão entre "Itens do Menu" e "Itens do Estoque".

## Estado Atual
- **Menu.tsx**: Permite cadastrar produtos apenas com informações de venda (name, price, description, category, image, status)
- **AddInventoryItem.tsx**: Permite cadastrar produtos com informações completas de estoque e fiscais
- **ItemsManagement.tsx**: Gerencia separadamente menu items e inventory items

## Solução Proposta

### 1. Nova Página: `AddProduct.tsx` ou `EditProduct.tsx`
Criar uma página única que permita cadastrar/editar produtos com:
- **Seções configuráveis**:
  - Informações Básicas (sempre visível): nome, categoria, imagem
  - Informações de Venda (opcional): preço, descrição, status
  - Informações de Estoque (opcional): unidade, estoque mínimo, estoque atual, preço de custo
  - Informações Fiscais (opcional): tipo de produto, NCM, CST ICMS, CFOP, alíquotas, código de barras

- **Lógica de negócio**:
  - Um produto pode ser apenas vendável (tem price)
  - Um produto pode ser apenas de estoque (tem unit/min_stock, mas não tem price)
  - Um produto pode ser ambos (tem price E unit/min_stock)

### 2. Atualizações Necessárias

#### 2.1. Contextos
- **RestaurantContext**: 
  - Adicionar função `addProduct` que cria produto na tabela `products`
  - Manter `addMenuItem` temporariamente para compatibilidade (deprecated)
  
- **StockContext**:
  - Atualizar `addInventoryItem` para usar `addProduct` internamente
  - Ou remover e usar diretamente do RestaurantContext

#### 2.2. Rotas
- Criar rota `/products/new` ou `/products/add` para cadastro
- Criar rota `/products/:id/edit` para edição
- Manter rotas antigas temporariamente (deprecated)

#### 2.3. Navegação
- Atualizar Sidebar para ter link "Produtos" ou "Cadastrar Produto"
- Atualizar Menu.tsx para usar novo cadastro ao invés do formulário inline
- Atualizar Stock.tsx para usar novo cadastro ao invés de AddInventoryItem

#### 2.4. Páginas Existentes
- **Menu.tsx**: 
  - Remover formulário de cadastro inline
  - Botão "Adicionar Produto" redireciona para `/products/new`
  - Manter apenas visualização e edição rápida (preço, status)

- **Stock.tsx**:
  - Botão "Adicionar Item" redireciona para `/products/new`
  - Remover referência a AddInventoryItem

- **ItemsManagement.tsx**:
  - Unificar visualização (remover tabs separadas)
  - Mostrar todos os produtos em uma única lista
  - Filtros para mostrar apenas vendáveis, apenas estoque, ou ambos

#### 2.5. Deprecar
- **AddInventoryItem.tsx**: Manter arquivo mas marcar como deprecated, redirecionar para novo cadastro
- **EditInventoryItem.tsx**: Atualizar para usar novo formulário unificado

## Implementação

### Etapa 1: Criar novo componente de formulário
- Criar `src/pages/AddProduct.tsx` ou `src/pages/ProductForm.tsx`
- Implementar formulário com seções colapsáveis/tabs
- Usar `CreateProductInput` do `src/types/product.ts`

### Etapa 2: Atualizar contextos
- Adicionar `addProduct` em RestaurantContext
- Atualizar StockContext para usar products

### Etapa 3: Atualizar rotas e navegação
- Adicionar rotas em App.tsx
- Atualizar Sidebar
- Atualizar Menu.tsx e Stock.tsx

### Etapa 4: Testar
- Cadastrar produto apenas vendável
- Cadastrar produto apenas de estoque
- Cadastrar produto completo (venda + estoque)
- Editar produto existente
- Verificar que produtos aparecem corretamente no Menu e Stock

### Etapa 5: Limpeza (opcional)
- Remover AddInventoryItem.tsx
- Atualizar ItemsManagement.tsx para usar visualização unificada

## Estrutura do Formulário Unificado

```
AddProduct.tsx
├── Seção 1: Informações Básicas (obrigatório)
│   ├── Nome *
│   ├── Categoria *
│   └── Imagem
│
├── Seção 2: Informações de Venda (opcional)
│   ├── Preço de Venda
│   ├── Descrição
│   └── Status (Available/Sold Out)
│
├── Seção 3: Informações de Estoque (opcional)
│   ├── Unidade de Medida
│   ├── Estoque Mínimo
│   ├── Estoque Atual
│   └── Preço de Custo
│
└── Seção 4: Informações Fiscais (opcional)
    ├── Tipo de Produto
    ├── NCM
    ├── CST ICMS
    ├── CFOP
    ├── Alíquota ICMS
    ├── Alíquota IPI
    └── Código de Barras (EAN)
```

Validações:
- Nome é obrigatório
- Se tem Preço de Venda OU Unidade/Estoque, é válido
- Se tem Preço de Venda, Status deve ser definido
- Categoria pode ser opcional (mas recomendado)

