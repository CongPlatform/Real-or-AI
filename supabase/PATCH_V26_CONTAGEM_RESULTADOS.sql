-- REAL OU IA? v26 — Contagens de uma mesma sessão (v19/v23 instalados).
-- Nenhuma exclusão de dados. Execute depois dos patches v19 e v23.
BEGIN;
CREATE OR REPLACE FUNCTION public.finalizar_participante_v3(p_participante uuid, p_estimativa int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_total int; v_ind int; v_comp int; v_resp_ind int; v_resp_comp int; v_json jsonb;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE tipo_rodada='individual'),
    count(*) FILTER (WHERE tipo_rodada='comparacao')
  INTO v_total,v_ind,v_comp FROM public.rodadas_v3 WHERE participante_id=p_participante;
  SELECT count(*) INTO v_resp_ind
  FROM public.rodadas_v3 r WHERE r.participante_id=p_participante AND r.tipo_rodada='individual'
    AND EXISTS (SELECT 1 FROM public.respostas a WHERE a.participante_id=p_participante AND a.conteudo_id=r.conteudo_id);
  SELECT count(*) INTO v_resp_comp
  FROM public.rodadas_v3 r WHERE r.participante_id=p_participante AND r.tipo_rodada='comparacao'
    AND EXISTS (SELECT 1 FROM public.respostas_comp a WHERE a.participante_id=p_participante AND a.comparacao_id=r.comparacao_id);
  IF v_total < 1 OR v_ind+v_comp <> v_total OR v_resp_ind <> v_ind OR v_resp_comp <> v_comp THEN
    RAISE EXCEPTION 'Teste incompleto: individuais %/%, comparações %/%',v_resp_ind,v_ind,v_resp_comp,v_comp;
  END IF;
  IF p_estimativa IS NULL OR p_estimativa < 0 OR p_estimativa > v_total THEN
    RAISE EXCEPTION 'A estimativa deve estar entre 0 e %',v_total;
  END IF;
  v_json := public.finalizar_participante(p_participante,p_estimativa);
  IF COALESCE((v_json->>'total')::int,-1) <> v_ind
     OR COALESCE((v_json->'comp'->>'total')::int,-1) <> v_comp THEN
    RAISE EXCEPTION 'Divergência de contagem entre respostas e roteiro: individuais %, comparações %',v_ind,v_comp;
  END IF;
  UPDATE public.participantes SET estimativa_base_decisoes=v_total
    WHERE id=p_participante AND finalizado=true;
  RETURN v_json || jsonb_build_object(
    'estimativa',p_estimativa,'base_decisoes',v_total,
    'rodadas_sorteadas',v_total,'individuais_sorteadas',v_ind,
    'comparacoes_sorteadas',v_comp,
    'individuais_respondidas',v_resp_ind,'comparacoes_respondidas',v_resp_comp);
END $$;
REVOKE ALL ON FUNCTION public.finalizar_participante_v3(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalizar_participante_v3(uuid,integer) TO anon,authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
