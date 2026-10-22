-- REAL OU IA? | Previews dentro dos rankings (v7)
-- Execute após os SQLs anteriores, principalmente PATCH_RANKING_MATERIAIS_V6.sql.
-- Não apaga, não altera conteúdos e não modifica as respostas.
-- Restrito a contas que possuem permissão de administrador.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_previews_materiais_v7()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.sou_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id,
      'url', c.url,
      'texto', c.texto
    ) ORDER BY c.created_at)
    FROM public.conteudos c
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_previews_materiais_v7() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_previews_materiais_v7() TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
