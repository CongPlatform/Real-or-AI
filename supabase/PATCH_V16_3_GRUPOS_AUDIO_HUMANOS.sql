-- REAL OU IA? | V16.3 | Grupos para ÁUDIOS INDIVIDUAIS
-- Executar UMA VEZ no Supabase SQL Editor do projeto conectado ao site.
-- Compatível com V16.2. Não exclui nem altera os arquivos no Storage.
-- Grupos anteriormente implícitos nos títulos só serão preenchidos quando
-- o título COMEÇAR com G01_, G02_ ou GRUPO01_ etc. Outros continuam sem grupo,
-- e o administrador poderá associá-los individualmente no painel.
BEGIN;

ALTER TABLE public.conteudos ADD COLUMN IF NOT EXISTS grupo_audio integer;

-- Não permite aplicar grupo a texto, vídeo, imagem ou item de comparação.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conteudos_grupo_audio_v163_ck'
      AND conrelid = 'public.conteudos'::regclass
  ) THEN
    ALTER TABLE public.conteudos ADD CONSTRAINT conteudos_grupo_audio_v163_ck
    CHECK (grupo_audio IS NULL OR (tipo = 'audio' AND comparacao_id IS NULL AND grupo_audio BETWEEN 1 AND 9999));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS conteudos_audio_grupo_v163_idx
  ON public.conteudos (grupo_audio) WHERE tipo='audio' AND comparacao_id IS NULL;

-- Migração não destrutiva de nomes antigos que já indicavam grupo.
UPDATE public.conteudos
SET grupo_audio = substring(titulo from '^(?:[Gg]|[Gg][Rr][Uu][Pp][Oo])[ _-]*0*([1-9][0-9]*)(?:[ _.-]|$)')::integer
WHERE tipo = 'audio' AND comparacao_id IS NULL AND grupo_audio IS NULL
  AND titulo ~* '^(g|grupo)[ _-]*0*[1-9][0-9]*([ _.-]|$)'
  AND substring(titulo from '^(?:[Gg]|[Gg][Rr][Uu][Pp][Oo])[ _-]*0*([1-9][0-9]*)(?:[ _.-]|$)')::numeric BETWEEN 1 AND 9999;

NOTIFY pgrst, 'reload schema';
COMMIT;
