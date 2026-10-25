-- REAL OU IA? — Comparações importadas por ZIP, v11
-- Execute APÓS os patches anteriores, no SQL Editor. Não exclui registros.
BEGIN;
ALTER TABLE public.comparacoes
  ADD COLUMN IF NOT EXISTS codigo_importacao text;

-- Pode existir C1 em imagens, C1 em áudio etc., mas nunca dois pares C1 no mesmo tipo.
CREATE UNIQUE INDEX IF NOT EXISTS comparacoes_codigo_importacao_tipo_v11
  ON public.comparacoes (tipo, codigo_importacao)
  WHERE codigo_importacao IS NOT NULL;

-- A escrita continua sob a política de RLS administrativa já configurada.
-- O site não lê o gabarito publicamente; cada par só é ativado após ambas as peças estarem salvas.
COMMIT;
NOTIFY pgrst, 'reload schema';
