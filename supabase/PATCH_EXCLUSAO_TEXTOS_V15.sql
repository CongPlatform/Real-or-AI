-- REAL OU IA? v15: exclusão de textos com diagnóstico e confirmação explícita.
-- INSTALAÇÃO NÃO APAGA REGISTROS. Execute no SQL Editor após os patches v4, v6 e v10.
-- Nunca conceda execução destas funções a anon; o acesso é checado no servidor.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_previa_exclusao_textos_v15(p_classe text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_ids uuid[] := '{}'::uuid[];
  v_comps uuid[] := '{}'::uuid[];
  v_sessoes uuid[] := '{}'::uuid[];
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.sou_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador autenticado';
  END IF;
  IF p_classe IS NULL OR p_classe NOT IN ('todos','ia','humano') THEN
    RAISE EXCEPTION 'Selecione todos, ia ou humano';
  END IF;
  SELECT COALESCE(array_agg(c.id),'{}'::uuid[]) INTO v_ids
  FROM public.conteudos c LEFT JOIN public.gabarito g ON g.conteudo_id=c.id
  WHERE c.tipo='texto' AND (p_classe='todos'
    OR (p_classe='ia' AND g.eh_ia IS TRUE)
    OR (p_classe='humano' AND g.eh_ia IS FALSE));
  SELECT COALESCE(array_agg(DISTINCT c.comparacao_id),'{}'::uuid[]) INTO v_comps
  FROM public.conteudos c WHERE c.id=ANY(v_ids) AND c.comparacao_id IS NOT NULL;
  SELECT COALESCE(array_agg(DISTINCT z.id),'{}'::uuid[]) INTO v_sessoes FROM (
    SELECT participante_id id FROM public.rodadas_v3
      WHERE conteudo_id=ANY(v_ids) OR primeiro_id=ANY(v_ids) OR segundo_id=ANY(v_ids) OR comparacao_id=ANY(v_comps)
    UNION SELECT participante_id FROM public.respostas WHERE conteudo_id=ANY(v_ids)
    UNION SELECT participante_id FROM public.respostas_comp WHERE comparacao_id=ANY(v_comps)
  ) z;
  SELECT jsonb_build_object(
    'textos',(SELECT count(*) FROM public.conteudos WHERE id=ANY(v_ids)),
    'comparacoes',(SELECT count(*) FROM public.comparacoes WHERE id=ANY(v_comps)),
    'sessoes_afetadas',cardinality(v_sessoes),
    'sessoes_em_andamento',(SELECT count(*) FROM public.participantes p WHERE p.id=ANY(v_sessoes) AND NOT p.finalizado),
    'respostas_individuais',(SELECT count(*) FROM public.respostas WHERE conteudo_id=ANY(v_ids)),
    'respostas_comparacoes',(SELECT count(*) FROM public.respostas_comp WHERE comparacao_id=ANY(v_comps)),
    'rodadas',(SELECT count(*) FROM public.rodadas_v3 WHERE conteudo_id=ANY(v_ids)
      OR primeiro_id=ANY(v_ids) OR segundo_id=ANY(v_ids) OR comparacao_id=ANY(v_comps)),
    'textos_restantes_na_mesma_dupla',(SELECT count(*) FROM public.conteudos c
      WHERE c.comparacao_id=ANY(v_comps) AND NOT c.id=ANY(v_ids))
  ) INTO v_resultado;
  RETURN v_resultado;
END $$;

CREATE OR REPLACE FUNCTION public.admin_excluir_textos_v15(
  p_classe text, p_confirmacao text, p_quantidade_esperada integer, p_forcar boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_ids uuid[] := '{}'::uuid[];
  v_comps uuid[] := '{}'::uuid[];
  v_sessoes uuid[] := '{}'::uuid[];
  v_total integer;
  v_respostas integer;
  v_comp_resp integer;
  v_rodadas integer;
  v_comps_total integer;
  v_sessoes_total integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.sou_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador autenticado';
  END IF;
  IF p_classe IS NULL OR p_classe NOT IN ('todos','ia','humano') THEN
    RAISE EXCEPTION 'Filtro de textos inválido';
  END IF;
  IF p_confirmacao IS DISTINCT FROM
      (CASE WHEN p_forcar THEN 'EXCLUIR TEXTOS E RESPOSTAS' ELSE 'EXCLUIR TEXTOS' END)
  THEN RAISE EXCEPTION 'Frase de confirmação incorreta'; END IF;
  -- Serializa as exclusões em lote e verifica novamente o volume selecionado.
  PERFORM pg_advisory_xact_lock(149021, 15);
  SELECT COALESCE(array_agg(c.id),'{}'::uuid[]) INTO v_ids
  FROM public.conteudos c LEFT JOIN public.gabarito g ON g.conteudo_id=c.id
  WHERE c.tipo='texto' AND (p_classe='todos'
    OR (p_classe='ia' AND g.eh_ia IS TRUE)
    OR (p_classe='humano' AND g.eh_ia IS FALSE));
  v_total:=cardinality(v_ids);
  IF v_total IS DISTINCT FROM p_quantidade_esperada THEN
    RAISE EXCEPTION 'Quantidade mudou no banco (% textos). Atualize a prévia antes de excluir',v_total;
  END IF;
  IF v_total=0 THEN
    RETURN jsonb_build_object('textos_excluidos',0,'sessoes_afetadas',0,'respostas_excluidas',0,'comparacoes_excluidas',0);
  END IF;
  SELECT COALESCE(array_agg(DISTINCT c.comparacao_id),'{}'::uuid[]) INTO v_comps
  FROM public.conteudos c WHERE c.id=ANY(v_ids) AND c.comparacao_id IS NOT NULL;
  SELECT COALESCE(array_agg(DISTINCT z.id),'{}'::uuid[]) INTO v_sessoes FROM (
    SELECT participante_id id FROM public.rodadas_v3
      WHERE conteudo_id=ANY(v_ids) OR primeiro_id=ANY(v_ids) OR segundo_id=ANY(v_ids) OR comparacao_id=ANY(v_comps)
    UNION SELECT participante_id FROM public.respostas WHERE conteudo_id=ANY(v_ids)
    UNION SELECT participante_id FROM public.respostas_comp WHERE comparacao_id=ANY(v_comps)
  ) z;
  v_sessoes_total:=cardinality(v_sessoes);
  IF v_sessoes_total>0 AND NOT p_forcar THEN
    RAISE EXCEPTION 'Existem % sessões vinculadas. Faça backup e marque a opção de excluir respostas relacionadas.',v_sessoes_total;
  END IF;
  -- Sessões afetadas não podem continuar contribuindo para os indicadores oficiais.
  UPDATE public.participantes SET excluir_analise=true WHERE id=ANY(v_sessoes);
  -- Liberar primeiro as chaves estrangeiras de rodadas_v3 (não possuem ON DELETE CASCADE no conteúdo).
  DELETE FROM public.rodadas_v3 r WHERE r.conteudo_id=ANY(v_ids)
    OR r.primeiro_id=ANY(v_ids) OR r.segundo_id=ANY(v_ids) OR r.comparacao_id=ANY(v_comps);
  GET DIAGNOSTICS v_rodadas=ROW_COUNT;
  DELETE FROM public.respostas r WHERE r.conteudo_id=ANY(v_ids);
  GET DIAGNOSTICS v_respostas=ROW_COUNT;
  -- respostas_comp_itens_v6 sai por CASCADE da resposta_comp correspondente.
  DELETE FROM public.respostas_comp r WHERE r.comparacao_id=ANY(v_comps);
  GET DIAGNOSTICS v_comp_resp=ROW_COUNT;
  -- Desabilita comparações parcialmente atingidas; preserva peças não selecionadas.
  UPDATE public.comparacoes SET ativo=false WHERE id=ANY(v_comps);
  DELETE FROM public.conteudos c WHERE c.id=ANY(v_ids);
  DELETE FROM public.comparacoes cp WHERE cp.id=ANY(v_comps)
    AND NOT EXISTS(SELECT 1 FROM public.conteudos c WHERE c.comparacao_id=cp.id);
  GET DIAGNOSTICS v_comps_total=ROW_COUNT;
  RETURN jsonb_build_object('textos_excluidos',v_total,'sessoes_afetadas',v_sessoes_total,
    'respostas_excluidas',v_respostas+v_comp_resp,'rodadas_excluidas',v_rodadas,
    'comparacoes_excluidas',v_comps_total);
END $$;

REVOKE ALL ON FUNCTION public.admin_previa_exclusao_textos_v15(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_excluir_textos_v15(text,text,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_previa_exclusao_textos_v15(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_excluir_textos_v15(text,text,integer,boolean) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
