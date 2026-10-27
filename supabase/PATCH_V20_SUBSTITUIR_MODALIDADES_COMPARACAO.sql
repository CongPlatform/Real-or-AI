-- V20: substituição ATÔMICA de somente comparações das modalidades selecionadas.
-- Exige PATCH_V19_MODOS_E_GRUPOS.sql previamente aplicado.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_substituir_modalidades_comparacao_v20(p_tipos text[],p_novos jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_item jsonb; v_id uuid; v_tipo text; v_codigo text; v_ids uuid[]:=ARRAY[]::uuid[]; v_n int; v_ativos int;
BEGIN
 IF NOT public.sou_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF p_tipos IS NULL OR cardinality(p_tipos)=0 OR p_tipos <@ ARRAY['imagem','audio','texto','video']::text[] IS NOT TRUE THEN RAISE EXCEPTION 'Modalidades inválidas'; END IF;
 IF p_novos IS NULL OR jsonb_typeof(p_novos)<>'array' OR jsonb_array_length(p_novos)<1 THEN RAISE EXCEPTION 'Sem grupos novos'; END IF;
 -- Evita duas substituições simultâneas, mantendo uma transação.
 PERFORM pg_advisory_xact_lock(20261027,20);
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_novos) LOOP
   v_id := (v_item->>'id')::uuid;
   v_tipo := v_item->>'tipo'; v_codigo := v_item->>'codigo';
   IF v_id=ANY(v_ids) OR NOT (v_tipo=ANY(p_tipos)) OR v_codigo !~ '^C[1-9][0-9]*$' THEN RAISE EXCEPTION 'Grupo duplicado ou inválido'; END IF;
   SELECT count(*) INTO v_ativos FROM public.comparacoes WHERE id=v_id AND tipo=v_tipo AND ativo=false;
   IF v_ativos<>1 THEN RAISE EXCEPTION 'Novo grupo inexistente ou já ativo: %',v_id; END IF;
   SELECT count(*) INTO v_n FROM public.conteudos c JOIN public.gabarito g ON g.conteudo_id=c.id WHERE c.comparacao_id=v_id AND c.ativo;
   IF v_n<2 OR v_n>4 THEN RAISE EXCEPTION 'Grupo % possui % conteúdos válidos',v_codigo,v_n; END IF;
   v_ids := array_append(v_ids,v_id);
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(p_novos) j GROUP BY j->>'tipo',j->>'codigo' HAVING count(*)>1 LIMIT 1) IS NOT NULL THEN RAISE EXCEPTION 'Código repetido'; END IF;
 -- Não altera conteúdos individuais (comparacao_id null) nem tabelas de respostas.
 UPDATE public.comparacoes SET ativo=false,
   codigo_importacao=left(coalesce(codigo_importacao,'SEM_CODIGO'),80)||'-ARQUIVO-'||substr(id::text,1,8)
 WHERE tipo=ANY(p_tipos) AND ativo=true AND NOT(id=ANY(v_ids));
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_novos) LOOP
   UPDATE public.comparacoes SET ativo=true,codigo_importacao=v_item->>'codigo'
   WHERE id=(v_item->>'id')::uuid AND tipo=v_item->>'tipo';
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.admin_substituir_modalidades_comparacao_v20(text[],jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_substituir_modalidades_comparacao_v20(text[],jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
