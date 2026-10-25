-- REAL OU IA? v18 - palpite sobre todas as decisões e auditoria coerente.
-- Executar DEPOIS dos SQLs de protocolo 20+20 e de estatísticas v4.
-- Instalar NÃO altera estimativas históricas nem apaga registros.
BEGIN;
ALTER TABLE public.participantes ADD COLUMN IF NOT EXISTS estimativa_base_decisoes integer;
ALTER TABLE public.participantes DROP CONSTRAINT IF EXISTS participantes_estimativa_base_decisoes_check;
ALTER TABLE public.participantes ADD CONSTRAINT participantes_estimativa_base_decisoes_check CHECK (estimativa_base_decisoes IN (30,40));

create or replace function public.finalizar_participante_v3(p_participante uuid,p_estimativa int)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tot int; v_resp int; v_ind int; v_comp int; v_result jsonb;
begin
 select count(*),count(*) filter(where tipo_rodada='individual'),count(*) filter(where tipo_rodada='comparacao')
   into v_tot,v_ind,v_comp from public.rodadas_v3 where participante_id=p_participante;
 select count(*) into v_resp from public.rodadas_v3 r where r.participante_id=p_participante
   and ((r.tipo_rodada='individual' and exists(select 1 from public.respostas a where a.participante_id=p_participante and a.conteudo_id=r.conteudo_id))
     or (r.tipo_rodada='comparacao' and exists(select 1 from public.respostas_comp a where a.participante_id=p_participante and a.comparacao_id=r.comparacao_id)));
 if v_tot not in (30,40) or v_resp<>v_tot or (v_tot=40 and (v_ind<>20 or v_comp<>20)) then
   raise exception 'Teste incompleto ou protocolo incorreto: % respostas de % decisões (% individuais, % comparações)', v_resp,v_tot,v_ind,v_comp;
 end if;
 IF p_estimativa IS NULL OR p_estimativa < 0 OR p_estimativa > v_tot THEN
   RAISE EXCEPTION 'Informe uma estimativa entre 0 e % decisões', v_tot;
 END IF;
 -- O palpite novo considera todas as decisões (20 individuais + 20 duplas).
 v_result := public.finalizar_participante(p_participante,p_estimativa);
 update public.participantes
 set estimativa_base_decisoes=v_tot
 where id=p_participante and finalizado is true and estimativa_base_decisoes is null;
 return v_result;
end $$;
REVOKE ALL ON FUNCTION public.finalizar_participante_v3(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalizar_participante_v3(uuid,integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_analise_v4() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.sou_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  RETURN jsonb_build_object(
    'versao', 4,
    'gerado_em', now(),
    'sessoes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'id', p.id, 'inicio', p.created_at, 'fim', p.finalizado_em,
       'finalizado', p.finalizado, 'excluir_analise', p.excluir_analise, 'faixa', p.faixa_etaria, 'genero', p.genero,
       'escolaridade', p.escolaridade, 'freq', p.freq_ia, 'usos', p.usos_ia,
       'confianca', p.confianca, 'estimativa', p.estimativa_acertos, 'estimativa_base_decisoes', p.estimativa_base_decisoes,
       'sorteadas', (SELECT count(*) FROM public.rodadas_v3 rd WHERE rd.participante_id=p.id),
       'individuais_sorteadas', (SELECT count(*) FROM public.rodadas_v3 rd WHERE rd.participante_id=p.id AND rd.tipo_rodada='individual'),
       'comparacoes_sorteadas', (SELECT count(*) FROM public.rodadas_v3 rd WHERE rd.participante_id=p.id AND rd.tipo_rodada='comparacao'),
       'individuais_respondidas', (SELECT count(*) FROM public.respostas r JOIN public.rodadas_v3 rd ON rd.participante_id=r.participante_id AND rd.conteudo_id=r.conteudo_id WHERE r.participante_id=p.id),
       'comparacoes_respondidas', (SELECT count(*) FROM public.respostas_comp r JOIN public.rodadas_v3 rd ON rd.participante_id=r.participante_id AND rd.comparacao_id=r.comparacao_id WHERE r.participante_id=p.id)
     ) ORDER BY p.created_at) FROM public.participantes p), '[]'::jsonb),
    'individuais', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'participante_id', r.participante_id, 'conteudo_id', r.conteudo_id,
      'tipo', rd.tipo_midia, 'enquadramento', rd.enquadramento,
      'origem_ia', g.eh_ia, 'resposta_ia', r.resposta_ia,
      'acertou', r.acertou, 'tempo_ms', r.tempo_ms,
      'segundos_reproduzidos', r.segundos_reproduzidos, 'pedidos_mais', r.pedidos_mais,
      'duracao_audio_s', r.duracao_audio_s, 'trecho_liberado_s', r.trecho_liberado_s,
      'repeticoes_audio', r.repeticoes_audio, 'data', r.created_at,
      'ordem', rd.ordem
    ) ORDER BY r.created_at)
    FROM public.respostas r JOIN public.rodadas_v3 rd
      ON rd.participante_id=r.participante_id AND rd.conteudo_id=r.conteudo_id
    JOIN public.gabarito g ON g.conteudo_id=r.conteudo_id), '[]'::jsonb),
    'comparacoes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'participante_id', r.participante_id, 'comparacao_id', r.comparacao_id,
      'tipo', rd.tipo_midia, 'enquadramento', rd.enquadramento,
      'acertou', r.acertou, 'acertos_itens', r.acertos_itens,
      'n_itens', r.n_itens, 'n_reais_ia', r.n_reais_ia,
      'n_marcados_ia', r.n_marcados_ia, 'tempo_ms', r.tempo_ms,
      'data', r.created_at, 'ordem', rd.ordem
    ) ORDER BY r.created_at)
    FROM public.respostas_comp r JOIN public.rodadas_v3 rd
      ON rd.participante_id=r.participante_id AND rd.comparacao_id=r.comparacao_id), '[]'::jsonb),
    'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'nome', c.titulo, 'tipo', c.tipo,
      'ativo', c.ativo, 'origem_ia', g.eh_ia,
      'audio_gain_db', c.audio_gain_db, 'audio_rms_dbfs', c.audio_rms_dbfs, 'audio_peak_dbfs', c.audio_peak_dbfs,
      'comparacao_id', c.comparacao_id,
      'sorteios', (SELECT count(*) FROM public.rodadas_v3 rd WHERE rd.conteudo_id=c.id)
    ) ORDER BY c.created_at)
    FROM public.conteudos c LEFT JOIN public.gabarito g ON g.conteudo_id=c.id), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.admin_analise_v4() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analise_v4() TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
