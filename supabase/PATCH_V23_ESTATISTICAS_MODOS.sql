-- Real ou IA? v23: fornece a modalidade registrada à análise do Admin.
-- Executar somente DEPOIS do SQL v19. Não modifica dados existentes.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_analise_v4() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.sou_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  RETURN jsonb_build_object(
    'versao', 4,
    'gerado_em', now(),
    'sessoes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'id', p.id, 'modo_teste', p.modo_teste, 'inicio', p.created_at, 'fim', p.finalizado_em,
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
