-- Script para criar a tabela de configurações globais
-- Execute este script no SQL Editor do Supabase Dashboard
-- As configurações são globais e apenas admins podem salvá-las
-- Todos os usuários visualizam as mesmas configurações

-- Criar tabela de configurações globais (apenas uma linha)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY DEFAULT 'global',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "All users can view settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only admins can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only admins can insert settings" ON public.app_settings;

-- Política: Todos os usuários autenticados podem visualizar as configurações
CREATE POLICY "All users can view settings" ON public.app_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política: Apenas admins podem inserir configurações
CREATE POLICY "Only admins can insert settings" ON public.app_settings
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política: Apenas admins podem atualizar configurações
CREATE POLICY "Only admins can update settings" ON public.app_settings
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Função para atualizar updated_at e updated_by automaticamente
CREATE OR REPLACE FUNCTION public.update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at e updated_by
DROP TRIGGER IF EXISTS update_app_settings_updated_at_trigger ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at_trigger
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_settings_updated_at();

-- Inserir registro inicial com configurações padrão (se não existir)
INSERT INTO public.app_settings (id, settings)
VALUES ('global', '{"language": "pt", "enableTables": true, "enableOrderDisplay": false, "printer": {"enabled": false, "type": "browser", "name": "", "ipAddress": "", "port": 9100, "paperSize": "80mm", "autoPrint": false}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Forçar recarregamento do cache do schema
NOTIFY pgrst, 'reload config';

