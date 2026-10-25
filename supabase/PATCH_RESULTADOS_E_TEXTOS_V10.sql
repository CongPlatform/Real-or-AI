-- REAL OU IA? v10. Execute depois do esquema e dos patches v3 e v6.
-- Instalação não exclui nada. Evita expor gabarito antes da conclusão.
BEGIN;
CREATE OR REPLACE FUNCTION public.resultado_detalhado_v10(p_participante uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.participantes p WHERE p.id=p_participante AND p.finalizado)
 THEN RAISE EXCEPTION 'Resultados disponíveis somente após concluir o teste'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(x.obj ORDER BY x.ordem,x.item_ordem) FROM (
 SELECT r.ordem,1 item_ordem,jsonb_build_object('id',c.id,'tipo',c.tipo,'url',c.url,'texto',c.texto,
 'resposta_ia',a.resposta_ia,'eh_ia',g.eh_ia,'acertou',a.acertou,'comparacao',false) obj
 FROM public.respostas a JOIN public.rodadas_v3 r ON r.participante_id=a.participante_id AND r.conteudo_id=a.conteudo_id
 JOIN public.conteudos c ON c.id=a.conteudo_id JOIN public.gabarito g ON g.conteudo_id=c.id
 WHERE a.participante_id=p_participante
 UNION ALL
 SELECT r.ordem,CASE WHEN r.primeiro_id=a.conteudo_id THEN 1 ELSE 2 END,
 jsonb_build_object('id',c.id,'tipo',c.tipo,'url',c.url,'texto',c.texto,
 'resposta_ia',a.resposta_ia,'eh_ia',g.eh_ia,'acertou',a.acertou,'comparacao',true)
 FROM public.respostas_comp_itens_v6 a JOIN public.rodadas_v3 r
 ON r.participante_id=a.participante_id AND r.comparacao_id=a.comparacao_id
 JOIN public.conteudos c ON c.id=a.conteudo_id JOIN public.gabarito g ON g.conteudo_id=c.id
 WHERE a.participante_id=p_participante
 )x),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.resultado_detalhado_v10(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resultado_detalhado_v10(uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_excluir_textos_v10(p_classe text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ids uuid[]; v_comp uuid[]; v_total integer;
BEGIN
 IF NOT public.sou_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 IF p_classe NOT IN ('todos','ia','humano') THEN RAISE EXCEPTION 'Filtro inválido'; END IF;
 SELECT array_agg(c.id) INTO v_ids FROM public.conteudos c JOIN public.gabarito g ON g.conteudo_id=c.id
 WHERE c.tipo='texto' AND (p_classe='todos' OR (p_classe='ia' AND g.eh_ia) OR (p_classe='humano' AND NOT g.eh_ia));
 IF COALESCE(array_length(v_ids,1),0)=0 THEN RETURN 0; END IF;
 IF EXISTS (SELECT 1 FROM public.rodadas_v3 r WHERE r.conteudo_id=ANY(v_ids)
 OR r.primeiro_id=ANY(v_ids) OR r.segundo_id=ANY(v_ids))
 OR EXISTS(SELECT 1 FROM public.respostas a WHERE a.conteudo_id=ANY(v_ids))
 OR EXISTS(SELECT 1 FROM public.respostas_comp_itens_v6 a WHERE a.conteudo_id=ANY(v_ids))
 THEN RAISE EXCEPTION 'Há testes/respostas vinculados. Faça backup e limpe as sessões de teste antes de apagar os textos.'; END IF;
 SELECT array_agg(DISTINCT c.comparacao_id) INTO v_comp FROM public.conteudos c WHERE c.id=ANY(v_ids) AND c.comparacao_id IS NOT NULL;
 -- Não apague conteúdos da outra classe em pares mistos: só retire o par completo quando p_classe=todos.
 IF p_classe<>'todos' AND EXISTS(SELECT 1 FROM public.conteudos c WHERE c.comparacao_id=ANY(v_comp) AND NOT c.id=ANY(v_ids))
 THEN RAISE EXCEPTION 'Existem comparações mistas. Exclua os pares no Admin antes de excluir esta classe.'; END IF;
 IF EXISTS(SELECT 1 FROM public.respostas_comp rc WHERE rc.comparacao_id=ANY(v_comp))
 THEN RAISE EXCEPTION 'Há respostas de comparação vinculadas. Limpe as sessões de teste antes de excluir.'; END IF;
 v_total:=cardinality(v_ids);
 DELETE FROM public.conteudos WHERE id=ANY(v_ids);
 IF COALESCE(array_length(v_comp,1),0)>0 THEN DELETE FROM public.comparacoes WHERE id=ANY(v_comp)
 AND NOT EXISTS (SELECT 1 FROM public.conteudos c WHERE c.comparacao_id=public.comparacoes.id); END IF;
 RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.admin_excluir_textos_v10(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_excluir_textos_v10(text) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
