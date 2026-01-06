# Plano de Reorganização da Tela de Pedidos para Mobile

## Problema Identificado
Quando um usuário adiciona um novo item ao pedido no mobile, o item aparece no resumo do pedido que está localizado no final da página. Isso força o usuário a rolar até o final para visualizar o item adicionado, criando uma experiência ruim.

## Análise do Layout Atual

### Desktop
- Layout em duas colunas:
  - **Esquerda**: Lista de itens disponíveis (flex-1)
  - **Direita**: Resumo do pedido fixo (w-[480px])

### Mobile (Atual)
- Layout em coluna única:
  - **Topo**: Lista de itens disponíveis
  - **Abaixo**: Resumo completo do pedido
- Problema: O resumo fica muito abaixo e não é visível ao adicionar itens

## Solução Proposta

### Estratégia 1: Resumo Compacto Sticky (Recomendada)
- **Resumo Compacto Fixo na Parte Inferior**
  - Fixo na parte inferior da tela (sticky/fixed)
  - Mostra: quantidade de itens, total do pedido, botão para criar pedido
  - Sempre visível enquanto o usuário navega pelos itens
  - Ocupa pouco espaço vertical

- **Drawer/Modal para Detalhes**
  - Ao clicar no resumo compacto, abre um drawer/modal
  - Mostra a lista completa de itens do pedido
  - Permite editar quantidades, remover itens
  - Mostra configurações (tipo de pedido, mesa, cliente)

### Estrutura do Layout Mobile Proposto

```
┌─────────────────────────────┐
│ Header (sticky top)         │
├─────────────────────────────┤
│ Filtros de Categoria        │
├─────────────────────────────┤
│                             │
│ Grid de Itens (scrollable)  │
│                             │
│                             │
├─────────────────────────────┤
│ Resumo Compacto (sticky)    │ ← Sempre visível
│ [3 itens] R$ 45,00 [Abrir] │
└─────────────────────────────┘
```

### Componentes a Criar/Modificar

1. **MobileOrderSummaryCompact.tsx** (Novo)
   - Componente de resumo compacto fixo
   - Mostra: quantidade de itens, total, botão de ação
   - Responsivo apenas para mobile

2. **MobileOrderDetailsDrawer.tsx** (Novo)
   - Drawer/modal que desliza de baixo para cima
   - Contém todos os detalhes do pedido
   - Lista de itens, configurações, botão de criar pedido

3. **NewOrder.tsx** (Modificar)
   - Adicionar lógica condicional para mobile vs desktop
   - No mobile: esconder o resumo completo lateral
   - No mobile: mostrar o resumo compacto sticky
   - Manter layout desktop atual

## Implementação Passo a Passo

### Fase 1: Criar Componentes Auxiliares
1. Criar `MobileOrderSummaryCompact.tsx`
   - Componente que mostra resumo mínimo
   - Usa `useState` para controlar abertura do drawer
   - Posicionamento: `fixed bottom-0` com z-index apropriado
   - Ajustar padding bottom para não sobrepor a navegação inferior

2. Criar `MobileOrderDetailsDrawer.tsx`
   - Drawer usando Dialog component existente
   - Ou criar drawer customizado com animação de slide
   - Conter todo o conteúdo do resumo do pedido
   - Permitir scroll interno

### Fase 2: Modificar NewOrder.tsx
1. Adicionar detecção de mobile
   - Usar hook `useMediaQuery` ou classe Tailwind `md:` para condicionais
   
2. Reorganizar layout:
   - Desktop: manter layout atual (2 colunas)
   - Mobile: 
     - Esconder resumo completo lateral (`hidden md:flex`)
     - Mostrar apenas grid de itens
     - Adicionar componente de resumo compacto

3. Passar props necessárias:
   - `selectedItems`
   - `unifiedItems`
   - `handleAddItem`
   - `handleRemoveItem`
   - `calculateTotal`
   - Configurações de pedido (tipo, mesa, cliente)
   - Função `handleCreateOrder`

### Fase 3: Melhorias de UX
1. **Feedback Visual ao Adicionar Item**
   - Animação/badge no resumo compacto quando item é adicionado
   - Scroll suave opcional (mas não obrigatório)

2. **Ajustes de Espaçamento**
   - Garantir que o resumo compacto não sobreponha a navegação inferior
   - Padding bottom adequado na lista de itens
   - Ajustar altura do resumo compacto

3. **Acessibilidade**
   - Labels adequados
   - Navegação por teclado
   - Aria labels

## Detalhes Técnicos

### Tailwind Classes para Responsividade
- `hidden md:block` - Esconder no mobile, mostrar no desktop
- `md:hidden` - Mostrar no mobile, esconder no desktop
- `fixed bottom-0` - Fixar na parte inferior
- `pb-20` ou `pb-24` - Padding bottom para não sobrepor navegação

### Estrutura de Estados
- Manter estados existentes no `NewOrder.tsx`
- Adicionar estado para controlar abertura do drawer: `const [isDrawerOpen, setIsDrawerOpen] = useState(false)`

### Componentes UI Disponíveis
- Usar `Dialog` component existente para o drawer
- Ou criar drawer customizado com transições
- Usar `Button`, `Card` components existentes

## Testes Necessários
1. ✅ Adicionar item ao pedido e verificar que aparece no resumo compacto
2. ✅ Abrir drawer e verificar lista de itens
3. ✅ Editar quantidades dentro do drawer
4. ✅ Remover itens do pedido
5. ✅ Criar pedido a partir do drawer
6. ✅ Verificar que não sobrepõe a navegação inferior
7. ✅ Verificar layout desktop não foi afetado
8. ✅ Testar em diferentes tamanhos de tela mobile

## Considerações Adicionais
- O resumo compacto deve aparecer apenas quando há itens no pedido
- Quando o pedido está vazio, não mostrar o resumo compacto
- Manter todas as funcionalidades existentes (tipo de pedido, seleção de mesa, nome do cliente)
- Garantir que a experiência desktop não seja afetada




