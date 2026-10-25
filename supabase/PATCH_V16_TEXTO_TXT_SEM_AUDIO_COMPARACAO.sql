-- REAL OU IA? v16 — comparações de texto via TXT + retirada de áudio das comparações.
-- Executar no Supabase SQL Editor APÓS schema.sql e PATCH_IMPORTAR_COMPARACOES_V11.sql.
-- Não apaga áudios, conteúdos, respostas nem participantes.
-- Comparações de áudio já existentes são DESATIVADAS para novas sessões;
-- sessões iniciadas anteriormente preservam seu roteiro e seus dados históricos.
BEGIN;

ALTER TABLE public.comparacoes ADD COLUMN IF NOT EXISTS codigo_importacao text;
CREATE UNIQUE INDEX IF NOT EXISTS comparacoes_codigo_importacao_tipo_v11
  ON public.comparacoes (tipo, codigo_importacao)
  WHERE codigo_importacao IS NOT NULL;

UPDATE public.comparacoes SET ativo = false WHERE tipo = 'audio' AND ativo = true;

CREATE OR REPLACE FUNCTION public.bloquear_audio_em_comparacoes_v16()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo = 'audio' AND NEW.ativo THEN
    RAISE EXCEPTION 'Áudio só é permitido na modalidade individual, não em comparações.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bloquear_audio_comparacoes_v16 ON public.comparacoes;
CREATE TRIGGER bloquear_audio_comparacoes_v16
  BEFORE INSERT OR UPDATE OF tipo, ativo ON public.comparacoes
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_audio_em_comparacoes_v16();

COMMIT;
NOTIFY pgrst, 'reload schema';
