-- REAL OU IA? | Estatísticas v4 | Execute APÓS o patch v3 de 30 decisões.
-- Não remove conteúdos, respostas ou participantes. Execute com backup disponível.
BEGIN;
ALTER TABLE public.participantes ADD COLUMN IF NOT EXISTS finalizado_em timestamptz;
ALTER TABLE public.participantes ADD COLUMN IF NOT EXISTS excluir_analise boolean NOT NULL DEFAULT false;
ALTER TABLE public.conteudos ADD COLUMN IF NOT EXISTS audio_gain_db numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE public.conteudos ADD COLUMN IF NOT EXISTS audio_rms_dbfs numeric(6,2);
ALTER TABLE public.conteudos ADD COLUMN IF NOT EXISTS audio_peak_dbfs numeric(6,2);
ALTER TABLE public.conteudos ADD COLUMN IF NOT EXISTS audio_analisado_em timestamptz;
-- Somente ganho de reprodução é público; nenhuma informação sobre o gabarito.
GRANT SELECT (audio_gain_db) ON public.conteudos TO anon;
ALTER TABLE public.respostas ADD COLUMN IF NOT EXISTS duracao_audio_s numeric(9,2);
ALTER TABLE public.respostas ADD COLUMN IF NOT EXISTS trecho_liberado_s numeric(9,2);
ALTER TABLE public.respostas ADD COLUMN IF NOT EXISTS repeticoes_audio integer;

CREATE OR REPLACE FUNCTION public.registrar_finalizacao_estudo_v4()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.finalizado IS TRUE THEN NEW.finalizado_em := COALESCE(NEW.finalizado_em, now()); END IF;
  ELSIF NEW.finalizado IS TRUE AND OLD.finalizado IS DISTINCT FROM TRUE THEN
    NEW.finalizado_em := COALESCE(NEW.finalizado_em, now());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_finalizacao_estudo_v4 ON public.participantes;
CREATE TRIGGER trg_finalizacao_estudo_v4
BEFORE INSERT OR UPDATE OF finalizado ON public.participantes
FOR EACH ROW EXECUTE FUNCTION public.registrar_finalizacao_estudo_v4();

-- Nova função com nome diferente: não gera sobrecargas ambíguas no PostgREST.
CREATE OR REPLACE FUNCTION public.enviar_resposta_v4(
  p_participante uuid,
  p_conteudo uuid,
  p_resposta_ia boolean,
  p_tempo_ms integer,
  p_segundos_reproduzidos numeric,
  p_pedidos_mais integer,
  p_duracao_audio_s numeric,
  p_trecho_liberado_s numeric,
  p_repeticoes_audio integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_tipo text; v_dur numeric; v_liberado numeric;
BEGIN
  SELECT c.tipo INTO v_tipo
    FROM public.rodadas_v3 rd JOIN public.conteudos c ON c.id = rd.conteudo_id
   WHERE rd.participante_id = p_participante AND rd.conteudo_id = p_conteudo
     AND rd.tipo_rodada = 'individual';
  IF v_tipo IS NULL THEN RAISE EXCEPTION 'Conteúdo não pertence à sessão'; END IF;
  -- Retentativas idempotentes: não alteram respostas nem telemetria já gravada.
  IF EXISTS (SELECT 1 FROM public.respostas WHERE participante_id=p_participante AND conteudo_id=p_conteudo) THEN RETURN; END IF;
  PERFORM public.enviar_resposta_v3(p_participante, p_conteudo, p_resposta_ia, p_tempo_ms,
    p_segundos_reproduzidos, p_pedidos_mais);
  IF v_tipo = 'audio' THEN
    v_dur := CASE WHEN p_duracao_audio_s > 0 THEN least(p_duracao_audio_s, 3600) ELSE NULL END;
    v_liberado := CASE WHEN v_dur IS NOT NULL AND p_trecho_liberado_s >= 0
      THEN least(p_trecho_liberado_s, v_dur) ELSE NULL END;
    UPDATE public.respostas r SET
      duracao_audio_s = v_dur,
      trecho_liberado_s = v_liberado,
      repeticoes_audio = least(greatest(coalesce(p_repeticoes_audio, 0), 0), 100)
    WHERE r.participante_id = p_participante AND r.conteudo_id = p_conteudo
      AND EXISTS (SELECT 1 FROM public.participantes p WHERE p.id=p_participante AND NOT p.finalizado);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.enviar_resposta_v4(uuid,uuid,boolean,integer,numeric,integer,numeric,numeric,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enviar_resposta_v4(uuid,uuid,boolean,integer,numeric,integer,numeric,numeric,integer) TO anon, authenticated;

-- Dados identificados por UUID técnico, EXCLUSIVAMENTE para administradores.
-- Não inclui nome, e-mail, URL, nem texto das peças; esses campos não são necessários na análise.
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
       'confianca', p.confianca, 'estimativa', p.estimativa_acertos,
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


-- Controle de pilotos: nenhum dado é apagado. Somente o admin pode marcar/desmarcar.
CREATE OR REPLACE FUNCTION public.admin_classificar_piloto_v4(p_participante uuid, p_excluir boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
BEGIN
  IF NOT public.sou_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE public.participantes SET excluir_analise = COALESCE(p_excluir,false)
  WHERE id=p_participante;
END $$;
REVOKE ALL ON FUNCTION public.admin_classificar_piloto_v4(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_classificar_piloto_v4(uuid,boolean) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
