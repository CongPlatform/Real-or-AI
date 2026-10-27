-- REAL OU IA? v22 — libera áudios nas comparações (Parte 2).
-- Execute APÓS os patches v19 e v20 no SQL Editor do Supabase.
-- Remove SOMENTE a regra obsoleta da v16. Não altera RLS, não apaga
-- conteúdos, respostas, comparações ou mídias individuais.
BEGIN;
DROP TRIGGER IF EXISTS bloquear_audio_comparacoes_v16 ON public.comparacoes;
DROP FUNCTION IF EXISTS public.bloquear_audio_em_comparacoes_v16();
COMMIT;
NOTIFY pgrst, 'reload schema';
