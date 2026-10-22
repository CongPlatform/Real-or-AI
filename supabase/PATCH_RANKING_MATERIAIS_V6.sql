-- REAL OU IA? | Dashboard v6 — votos individuais por peça, inclusive nas comparações.
-- Execute APÓS PATCH_30_PERGUNTAS_ENQUADRAMENTO_AUDIO.sql e PATCH_ESTATISTICAS_V4.sql.
-- A instalação NÃO apaga dados. Registros antigos de comparações só tinham totais
-- agregados: os votos em cada peça NÃO podem ser reconstruídos retrospectivamente.
BEGIN;

CREATE TABLE IF NOT EXISTS public.respostas_comp_itens_v6 (
  participante_id uuid NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  comparacao_id uuid NOT NULL,
  conteudo_id uuid NOT NULL REFERENCES public.conteudos(id) ON DELETE CASCADE,
  resposta_ia boolean NOT NULL,
  acertou boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participante_id, comparacao_id, conteudo_id),
  CONSTRAINT respostas_comp_itens_v6_pai_fkey
    FOREIGN KEY (participante_id, comparacao_id)
    REFERENCES public.respostas_comp(participante_id, comparacao_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS respostas_comp_itens_v6_conteudo_idx
  ON public.respostas_comp_itens_v6(conteudo_id);
ALTER TABLE public.respostas_comp_itens_v6 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.respostas_comp_itens_v6 FROM PUBLIC, anon, authenticated;

-- Substitui apenas a RPC de comparação v3, mantendo contrato e pontuação originais.
-- A linha agregada de respostas_comp continua sendo gravada normalmente.
CREATE OR REPLACE FUNCTION public.enviar_comparacao_v3(
 p_participante uuid,p_comparacao uuid,p_marcados uuid[],p_tempo_ms int
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_primeiro uuid; v_segundo uuid;
BEGIN
  -- Bloqueia a sessão durante a submissão para prevenir gravações concorrentes.
  PERFORM 1 FROM public.participantes p WHERE p.id=p_participante FOR UPDATE;
  SELECT r.primeiro_id,r.segundo_id INTO v_primeiro,v_segundo
  FROM public.rodadas_v3 r
  WHERE r.participante_id=p_participante AND r.comparacao_id=p_comparacao
    AND r.tipo_rodada='comparacao';
  IF v_primeiro IS NULL OR v_segundo IS NULL THEN
    RAISE EXCEPTION 'Comparação não pertence à sessão';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(p_marcados,'{}'::uuid[])) marcado(id)
    WHERE marcado.id IS NULL OR marcado.id NOT IN (v_primeiro,v_segundo)
  ) THEN RAISE EXCEPTION 'Seleção inválida'; END IF;
  -- Resposta já registrada: não recriar votos a partir de uma eventual nova escolha.
  IF EXISTS (SELECT 1 FROM public.respostas_comp c
    WHERE c.participante_id=p_participante AND c.comparacao_id=p_comparacao) THEN
    RETURN;
  END IF;
  PERFORM public.enviar_comparacao(p_participante,p_comparacao,p_marcados,p_tempo_ms);
  INSERT INTO public.respostas_comp_itens_v6
    (participante_id,comparacao_id,conteudo_id,resposta_ia,acertou)
  SELECT p_participante,p_comparacao,c.id,
    c.id=ANY(coalesce(p_marcados,'{}'::uuid[])),
    (c.id=ANY(coalesce(p_marcados,'{}'::uuid[])))=g.eh_ia
  FROM public.conteudos c
  JOIN public.gabarito g ON g.conteudo_id=c.id
  WHERE c.id IN (v_primeiro,v_segundo) AND c.comparacao_id=p_comparacao
  ON CONFLICT (participante_id,comparacao_id,conteudo_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.enviar_comparacao_v3(uuid,uuid,uuid[],int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enviar_comparacao_v3(uuid,uuid,uuid[],int) TO anon,authenticated;

-- O participante não tem acesso a esta tabela nem a estes gabaritos.
CREATE OR REPLACE FUNCTION public.admin_respostas_itens_comp_v6()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.sou_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'participante_id',r.participante_id,
    'comparacao_id',r.comparacao_id,
    'conteudo_id',r.conteudo_id,
    'resposta_ia',r.resposta_ia,
    'acertou',r.acertou,
    'data',r.created_at
  ) ORDER BY r.created_at) FROM public.respostas_comp_itens_v6 r),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.admin_respostas_itens_comp_v6() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_respostas_itens_comp_v6() TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
