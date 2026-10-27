-- REAL OU IA? v29 — finalização coerente com o roteiro da sessão.
-- Corrige o falso erro "Divergência de contagem entre respostas e roteiro".
-- Não apaga respostas, não muda sorteios, nem relaxa o requisito de completar as rodadas.
BEGIN;
CREATE OR REPLACE FUNCTION public.finalizar_participante_v3(p_participante uuid, p_estimativa int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_total integer; v_ind integer; v_comp integer;
 v_resp_ind integer; v_resp_comp integer;
 v_acertos_ind integer; v_acertos_comp integer;
 v_por_tipo jsonb; v_json jsonb;
BEGIN
 -- Bloqueia a sessão enquanto verifica e finaliza: duas chamadas não finalizam em paralelo.
 PERFORM 1 FROM public.participantes WHERE id=p_participante FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Participante não encontrado'; END IF;
 SELECT count(*),count(*) FILTER(WHERE tipo_rodada='individual'),
        count(*) FILTER(WHERE tipo_rodada='comparacao')
 INTO v_total,v_ind,v_comp
 FROM public.rodadas_v3 WHERE participante_id=p_participante;
 IF v_total < 1 OR v_ind+v_comp <> v_total THEN
   RAISE EXCEPTION 'Roteiro inválido. Informe a equipe da pesquisa.';
 END IF;
 IF p_estimativa IS NULL OR p_estimativa NOT BETWEEN 0 AND v_total THEN
   RAISE EXCEPTION 'Informe uma estimativa entre 0 e %',v_total;
 END IF;
 -- Só contam respostas das rodadas efetivamente sorteadas, não registros órfãos/antigos.
 SELECT count(*),count(*) FILTER(WHERE a.acertou)
 INTO v_resp_ind,v_acertos_ind
 FROM public.rodadas_v3 r
 JOIN public.respostas a ON a.participante_id=r.participante_id AND a.conteudo_id=r.conteudo_id
 WHERE r.participante_id=p_participante AND r.tipo_rodada='individual';
 SELECT count(*),count(*) FILTER(WHERE a.acertou)
 INTO v_resp_comp,v_acertos_comp
 FROM public.rodadas_v3 r
 JOIN public.respostas_comp a ON a.participante_id=r.participante_id AND a.comparacao_id=r.comparacao_id
 WHERE r.participante_id=p_participante AND r.tipo_rodada='comparacao';
 IF v_resp_ind<>v_ind OR v_resp_comp<>v_comp THEN
   RAISE EXCEPTION 'Teste incompleto: individuais %/%, comparações %/%',
     v_resp_ind,v_ind,v_resp_comp,v_comp;
 END IF;
 SELECT coalesce(jsonb_object_agg(tipo,jsonb_build_object('total',total,'acertos',acertos)),'{}'::jsonb)
 INTO v_por_tipo FROM (
   SELECT c.tipo,count(*)::integer total,count(*) FILTER(WHERE a.acertou)::integer acertos
   FROM public.rodadas_v3 r JOIN public.respostas a
      ON a.participante_id=r.participante_id AND a.conteudo_id=r.conteudo_id
   JOIN public.conteudos c ON c.id=r.conteudo_id
   WHERE r.participante_id=p_participante AND r.tipo_rodada='individual'
   GROUP BY c.tipo
 ) t;
 UPDATE public.participantes SET finalizado=true,estimativa_acertos=p_estimativa,
    estimativa_base_decisoes=v_total WHERE id=p_participante;
 v_json=jsonb_build_object(
    'total',v_ind,'acertos',v_acertos_ind,'por_tipo',coalesce(v_por_tipo,'{}'::jsonb),
    'comp',jsonb_build_object('total',v_comp,'acertos',v_acertos_comp),
    'estimativa',p_estimativa,'base_decisoes',v_total,
    'rodadas_sorteadas',v_total,'individuais_sorteadas',v_ind,
    'comparacoes_sorteadas',v_comp,'individuais_respondidas',v_resp_ind,
    'comparacoes_respondidas',v_resp_comp);
 RETURN v_json;
END $$;
REVOKE ALL ON FUNCTION public.finalizar_participante_v3(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalizar_participante_v3(uuid,integer) TO anon,authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
