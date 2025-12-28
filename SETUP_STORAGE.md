# Configuração do Storage para Upload de Imagens

Este guia explica como configurar o Supabase Storage para permitir upload de imagens de produtos.

## Problema

Se você está recebendo o erro: **"new row violates row-level security policy"**, isso significa que as políticas RLS (Row Level Security) do bucket de storage não estão configuradas.

## Solução

### Passo 1: Criar o Bucket

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá para **Storage** no menu lateral
4. Clique em **Buckets** > **New bucket**
5. Configure:
   - **Name**: `product-images`
   - **Public bucket**: ✅ Marque esta opção (permite acesso público às imagens)
6. Clique em **Create bucket**

### Passo 2: Configurar Políticas RLS

1. No Supabase Dashboard, vá para **SQL Editor**
2. Clique em **New query**
3. Copie e cole o conteúdo do arquivo `setup_storage_policies.sql`
4. Clique em **Run** (ou pressione `Ctrl+Enter` / `Cmd+Enter`)

O script criará as seguintes políticas:
- ✅ **Upload**: Usuários autenticados podem fazer upload
- ✅ **Leitura**: Acesso público para visualizar imagens
- ✅ **Atualização**: Usuários autenticados podem atualizar
- ✅ **Exclusão**: Usuários autenticados podem excluir

### Passo 3: Verificar

Após executar o script, tente fazer upload de uma imagem novamente. O erro não deve mais aparecer.

## Verificando se as Políticas Foram Criadas

Para verificar se as políticas foram criadas corretamente:

1. No Supabase Dashboard, vá para **Storage** > **Policies**
2. Você deve ver 4 políticas relacionadas ao bucket `product-images`

## Troubleshooting

### Erro persiste após configurar as políticas

1. Verifique se o bucket `product-images` foi criado corretamente
2. Certifique-se de que o bucket está marcado como **Public**
3. Verifique se você está logado (usuários não autenticados não podem fazer upload)
4. Tente recarregar a página e tentar novamente

### Ainda não funciona

Se o problema persistir:
1. Verifique os logs do Supabase Dashboard (Settings > Logs)
2. Certifique-se de que você está usando as credenciais corretas do Supabase
3. Verifique se o usuário está autenticado corretamente

