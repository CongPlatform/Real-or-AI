-- PATCH v19: configurações e grupos de quatro, preservação de dados anteriores.
BEGIN;
CREATE TABLE IF NOT EXISTS public.configuracao_teste_v19 (modo text primary key check (modo in ('completo','reduzido')), individuais integer not null check(individuais between 0 and 200), comparacoes integer not null check(comparacoes between 0 and 200), ativo boolean not null default true, check(individuais+comparacoes between 1 and 400));
INSERT INTO public.configuracao_teste_v19 VALUES ('completo',20,20,true),('reduzido',10,10,true) ON CONFLICT(modo) DO NOTHING;
ALTER TABLE public.configuracao_teste_v19 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.configuracao_teste_v19 FROM PUBLIC,anon,authenticated;
ALTER TABLE public.participantes ADD COLUMN IF NOT EXISTS modo_teste text;
ALTER TABLE public.participantes DROP CONSTRAINT IF EXISTS participantes_modo_teste_v19_ck;
ALTER TABLE public.participantes ADD CONSTRAINT participantes_modo_teste_v19_ck CHECK (modo_teste is null OR modo_teste IN ('completo','reduzido'));
ALTER TABLE public.participantes DROP CONSTRAINT IF EXISTS participantes_estimativa_base_decisoes_check;
ALTER TABLE public.participantes ADD CONSTRAINT participantes_estimativa_base_decisoes_check CHECK(estimativa_base_decisoes BETWEEN 1 AND 400);
CREATE OR REPLACE FUNCTION public.configuracoes_teste_v19() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('modo',modo,'individuais',individuais,'comparacoes',comparacoes,'ativo',ativo) ORDER BY modo),'[]'::jsonb) FROM public.configuracao_teste_v19 $$;
REVOKE ALL ON FUNCTION public.configuracoes_teste_v19() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configuracoes_teste_v19() TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_salvar_configuracoes_v19(p_config jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r jsonb; n int:=0;
BEGIN
 IF NOT public.sou_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF jsonb_typeof(p_config)<>'array' OR jsonb_array_length(p_config)<>2 THEN RAISE EXCEPTION 'Envie duas configurações'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_config) LOOP
   UPDATE public.configuracao_teste_v19 SET individuais=(r->>'individuais')::int,comparacoes=(r->>'comparacoes')::int,ativo=(r->>'ativo')::boolean WHERE modo=r->>'modo';
   IF NOT FOUND THEN RAISE EXCEPTION 'Modo inválido'; END IF;
   n:=n+1;
 END LOOP;
 IF n<>2 OR (SELECT count(DISTINCT value->>'modo') FROM jsonb_array_elements(p_config))<>2 THEN RAISE EXCEPTION 'Modos duplicados'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_salvar_configuracoes_v19(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_salvar_configuracoes_v19(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.selecionar_modo_v19(p_participante uuid,p_modo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.configuracao_teste_v19 WHERE modo=p_modo AND ativo) THEN RAISE EXCEPTION 'Modo indisponível'; END IF;
 UPDATE public.participantes p SET modo_teste=p_modo WHERE p.id=p_participante AND NOT p.finalizado AND NOT EXISTS (SELECT 1 FROM public.rodadas_v3 r WHERE r.participante_id=p.id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Sessão já iniciada ou inválida'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.selecionar_modo_v19(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.selecionar_modo_v19(uuid,text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_arquivar_grupo_v19(p_tipo text,p_codigo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.sou_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 UPDATE public.comparacoes SET ativo=false,codigo_importacao=coalesce(codigo_importacao,'SEM_CODIGO')||'-ARQUIVO-'||substr(id::text,1,8)
 WHERE tipo=p_tipo AND codigo_importacao=p_codigo;
END $$;
REVOKE ALL ON FUNCTION public.admin_arquivar_grupo_v19(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_arquivar_grupo_v19(text,text) TO authenticated;
create or replace function public.obter_teste_v3(p_participante uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n_comp int; v_n_ind int; v_target_ia int; v_target_real int;
  v_ia int := 0; v_real int := 0; v_seq int := 0; v_comp_n int := 0;
  v_base int; v_lote int; v_limite int; v_offset int := floor(random()*3)::int;
  v_tipo text; v_classe boolean; v_row record; v_comp record;
  v_modo text; v_primeiro uuid; v_segundo uuid; v_data jsonb; v_cenario integer;
begin
  perform 1 from public.participantes where id=p_participante and not finalizado for update;
  if not found then raise exception 'Participante não encontrado ou teste já finalizado'; end if;
  if not exists (select 1 from public.rodadas_v3 where participante_id=p_participante) then
    select count(*) into v_n_comp from (
      select cp.id from public.comparacoes cp
      join public.conteudos c on c.comparacao_id=cp.id and c.ativo
      join public.gabarito g on g.conteudo_id=c.id
      where cp.ativo
      group by cp.id having count(*) between 2 and 4
    ) valida;
    select coalesce(modo_teste,'completo') into v_modo from public.participantes where id=p_participante;
    select individuais,comparacoes into v_n_ind,v_n_comp from public.configuracao_teste_v19 where modo=v_modo and ativo;
    if not found then raise exception 'Modalidade de teste indisponível'; end if;
    if (select count(*) from (select cp.id from public.comparacoes cp join public.conteudos c on c.comparacao_id=cp.id and c.ativo join public.gabarito g on g.conteudo_id=c.id where cp.ativo group by cp.id having count(*) between 2 and 4) q) < v_n_comp then
      raise exception 'Grupos disponíveis insuficientes para % comparações', v_n_comp;
    end if;
    v_target_ia := (v_n_ind / 2) + case when mod(v_n_ind,2)=1 and random()<0.5 then 1 else 0 end;
    v_target_real := v_n_ind - v_target_ia;
    if (select count(*) from public.conteudos c join public.gabarito g on g.conteudo_id=c.id
       where c.ativo and c.comparacao_id is null and g.eh_ia) < v_target_ia
      or (select count(*) from public.conteudos c join public.gabarito g on g.conteudo_id=c.id
       where c.ativo and c.comparacao_id is null and not g.eh_ia) < v_target_real then
       raise exception 'Conteúdos insuficientes para 20 perguntas individuais equilibradas: cadastre mais itens individuais de IA e reais';
    end if;

    -- Cotas iguais por modalidade, sempre que houver estoque nas duas classes.
    v_base := v_n_ind / 8;
    foreach v_tipo in array array['imagem','texto','audio','video'] loop
      foreach v_classe in array array[true,false] loop
        v_limite := least(v_base,case when v_classe then v_target_ia-v_ia else v_target_real-v_real end);
        for v_row in
          select c.id from public.conteudos c join public.gabarito g on g.conteudo_id=c.id
          where c.ativo and c.comparacao_id is null and c.tipo=v_tipo and g.eh_ia=v_classe
           and not exists(select 1 from public.rodadas_v3 r where r.participante_id=p_participante and r.conteudo_id=c.id)
          order by (select count(*) from public.rodadas_v3 r where r.conteudo_id=c.id),random() limit v_limite
        loop
          v_seq:=v_seq+1;
          insert into public.rodadas_v3(participante_id,ordem,tipo_rodada,tipo_midia,conteudo_id,enquadramento)
          values (p_participante,v_seq,'individual',v_tipo,v_row.id,
            (array['neutro','ia','humano'])[1+mod(v_seq+v_offset,3)]);
          if v_classe then v_ia:=v_ia+1; else v_real:=v_real+1; end if;
        end loop;
      end loop;
    end loop;

    -- Reposição por modalidades com estoque, mantendo equilíbrio IA/real estrito.
    while v_ia < v_target_ia or v_real < v_target_real loop
      v_classe := v_ia < v_target_ia;
      select c.id,c.tipo into v_row
      from public.conteudos c join public.gabarito g on g.conteudo_id=c.id
      where c.ativo and c.comparacao_id is null and g.eh_ia=v_classe
       and not exists(select 1 from public.rodadas_v3 r where r.participante_id=p_participante and r.conteudo_id=c.id)
      order by (select count(*) from public.rodadas_v3 r where r.participante_id=p_participante and r.tipo_midia=c.tipo),
               (select count(*) from public.rodadas_v3 r where r.conteudo_id=c.id),random()
      limit 1;
      if not found then raise exception 'Estoque insuficiente para completar a sessão'; end if;
      v_seq:=v_seq+1;
      insert into public.rodadas_v3(participante_id,ordem,tipo_rodada,tipo_midia,conteudo_id,enquadramento)
      values(p_participante,v_seq,'individual',v_row.tipo,v_row.id,(array['neutro','ia','humano'])[1+mod(v_seq+v_offset,3)]);
      if v_classe then v_ia:=v_ia+1; else v_real:=v_real+1; end if;
    end loop;

    -- Sorteio: cada grupo representa UMA decisão; dentre 2–4 peças, quaisquer duas distintas.
    for v_comp in
      select cp.id,cp.tipo from public.comparacoes cp
      join public.conteudos c on c.comparacao_id=cp.id and c.ativo
      join public.gabarito g on g.conteudo_id=c.id
      where cp.ativo
      group by cp.id,cp.tipo having count(*) between 2 and 4
      order by random() limit v_n_comp
    loop
      select x.id into v_primeiro from public.conteudos x join public.gabarito g on g.conteudo_id=x.id
        where x.comparacao_id=v_comp.id and x.ativo order by random() limit 1;
      select x.id into v_segundo from public.conteudos x join public.gabarito g on g.conteudo_id=x.id
        where x.comparacao_id=v_comp.id and x.ativo and x.id<>v_primeiro order by random() limit 1;
      v_seq:=v_seq+1; v_comp_n:=v_comp_n+1;
      insert into public.rodadas_v3(participante_id,ordem,tipo_rodada,tipo_midia,comparacao_id,primeiro_id,segundo_id,enquadramento)
      values(p_participante,v_seq,'comparacao',v_comp.tipo,v_comp.id,v_primeiro,v_segundo,
        (array['neutro','ia','humano'])[1+mod(v_comp_n+v_offset,3)]);
    end loop;
    if v_comp_n<>v_n_comp or v_seq<>v_n_ind+v_n_comp then
      raise exception 'Sorteio incompleto: % individuais, % comparações',v_seq-v_comp_n,v_comp_n;
    end if;
  end if;

  select coalesce(jsonb_agg(
    case when r.tipo_rodada='individual' then
      jsonb_build_object('kind','individual','id',c.id,'tipo',c.tipo,'url',c.url,'texto',c.texto,
                         'enquadramento',r.enquadramento,'respondida', exists(select 1 from public.respostas a where a.participante_id=p_participante and a.conteudo_id=c.id))
    else
      jsonb_build_object('kind','comparacao','id',r.comparacao_id,'tipo',r.tipo_midia,'enquadramento',r.enquadramento,
        'conteudos',jsonb_build_array(
           jsonb_build_object('id',c1.id,'tipo',c1.tipo,'url',c1.url,'texto',c1.texto),
           jsonb_build_object('id',c2.id,'tipo',c2.tipo,'url',c2.url,'texto',c2.texto)),
        'respondida',exists(select 1 from public.respostas_comp a where a.participante_id=p_participante and a.comparacao_id=r.comparacao_id))
    end order by case when r.tipo_rodada='individual' then 0 else 1 end, r.ordem_aleatoria
  ),'[]'::jsonb) into v_data
  from public.rodadas_v3 r
  left join public.conteudos c on c.id=r.conteudo_id
  left join public.conteudos c1 on c1.id=r.primeiro_id
  left join public.conteudos c2 on c2.id=r.segundo_id
  where r.participante_id=p_participante;
  return v_data;
end $$;


create or replace function public.finalizar_participante_v3(p_participante uuid,p_estimativa int)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tot int; v_resp int; v_ind int; v_comp int; v_result jsonb;
begin
 select count(*),count(*) filter(where tipo_rodada='individual'),count(*) filter(where tipo_rodada='comparacao')
   into v_tot,v_ind,v_comp from public.rodadas_v3 where participante_id=p_participante;
 select count(*) into v_resp from public.rodadas_v3 r where r.participante_id=p_participante
   and ((r.tipo_rodada='individual' and exists(select 1 from public.respostas a where a.participante_id=p_participante and a.conteudo_id=r.conteudo_id))
     or (r.tipo_rodada='comparacao' and exists(select 1 from public.respostas_comp a where a.participante_id=p_participante and a.comparacao_id=r.comparacao_id)));
 if v_tot<1 or v_resp<>v_tot then
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

-- Uma resposta avalia SOMENTE os dois itens sorteados, jamais os quatro do grupo.
CREATE OR REPLACE FUNCTION public.enviar_comparacao_v3(p_participante uuid,p_comparacao uuid,p_marcados uuid[],p_tempo_ms int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a uuid; b uuid; n int; v_ok int; v_ia int; v_marc int;
BEGIN
 SELECT r.primeiro_id,r.segundo_id INTO a,b FROM public.rodadas_v3 r
 JOIN public.participantes p ON p.id=r.participante_id AND NOT p.finalizado
 WHERE r.participante_id=p_participante AND r.comparacao_id=p_comparacao AND r.tipo_rodada='comparacao';
 IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'Comparação inválida para a sessão'; END IF;
 IF coalesce(array_length(p_marcados,1),0)<> (SELECT count(DISTINCT x) FROM unnest(coalesce(p_marcados,'{}'::uuid[])) x)
 OR EXISTS(SELECT 1 FROM unnest(coalesce(p_marcados,'{}'::uuid[])) x WHERE x NOT IN(a,b)) THEN
  RAISE EXCEPTION 'Seleção de conteúdos inválida'; END IF;
 SELECT count(*),count(*) FILTER(WHERE (c.id=ANY(coalesce(p_marcados,'{}'::uuid[])))=g.eh_ia),
 count(*) FILTER(WHERE g.eh_ia),count(*) FILTER(WHERE c.id=ANY(coalesce(p_marcados,'{}'::uuid[])))
 INTO n,v_ok,v_ia,v_marc FROM public.conteudos c JOIN public.gabarito g ON g.conteudo_id=c.id
 WHERE c.id IN(a,b) AND c.comparacao_id=p_comparacao;
 IF n<>2 THEN RAISE EXCEPTION 'Duas peças com gabarito são necessárias'; END IF;
 INSERT INTO public.respostas_comp(participante_id,comparacao_id,n_itens,n_reais_ia,n_marcados_ia,acertos_itens,acertou,tempo_ms)
 VALUES(p_participante,p_comparacao,n,v_ia,v_marc,v_ok,v_ok=n,least(greatest(coalesce(p_tempo_ms,0),0),600000))
 ON CONFLICT(participante_id,comparacao_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.enviar_comparacao_v3(uuid,uuid,uuid[],integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enviar_comparacao_v3(uuid,uuid,uuid[],integer) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.obter_teste_v3(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_teste_v3(uuid) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.finalizar_participante_v3(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalizar_participante_v3(uuid,integer) TO anon,authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
