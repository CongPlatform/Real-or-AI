-- REAL OU IA? | Protocolo v12: 40 decisões = 20 individuais + 20 comparações
-- EXECUTAR UMA VEZ no Supabase SQL Editor antes de publicar o frontend atualizado.
-- NÃO apaga nem modifica participantes, conteúdos, comparações ou respostas já existentes.
-- Sessões antigas de 30 decisões permanecem recuperáveis; as novas exigem 20 pares válidos.
BEGIN;

create or replace function public.obter_teste_v3(p_participante uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n_comp int; v_n_ind int; v_target_ia int; v_target_real int;
  v_ia int := 0; v_real int := 0; v_seq int := 0; v_comp_n int := 0;
  v_base int; v_lote int; v_limite int; v_offset int := floor(random()*3)::int;
  v_tipo text; v_classe boolean; v_row record; v_comp record;
  v_primeiro uuid; v_segundo uuid; v_data jsonb; v_cenario integer;
begin
  perform 1 from public.participantes where id=p_participante and not finalizado for update;
  if not found then raise exception 'Participante não encontrado ou teste já finalizado'; end if;
  if not exists (select 1 from public.rodadas_v3 where participante_id=p_participante) then
    select count(*) into v_n_comp from (
      select cp.id from public.comparacoes cp
      join public.conteudos c on c.comparacao_id=cp.id and c.ativo
      join public.gabarito g on g.conteudo_id=c.id
      where cp.ativo
      group by cp.id having count(*)=2
    ) valida;
    if v_n_comp < 20 then
      raise exception 'Para iniciar o novo teste, cadastre pelo menos 20 comparações válidas (duas peças ativas por comparação). Disponíveis: %', v_n_comp;
    end if;
    v_n_comp := 20;
    v_n_ind := 20;
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

    -- Equilibra cenários: 0, 1 e 2 itens de IA por comparação, quando disponíveis.
    -- A pergunta jamais revela ou sugere quantos são IA.
    for v_cenario in 0..2 loop
      for v_comp in
        select cp.id,cp.tipo from public.comparacoes cp
        join public.conteudos c on c.comparacao_id=cp.id and c.ativo
        join public.gabarito g on g.conteudo_id=c.id
        where cp.ativo
        group by cp.id,cp.tipo
        having count(*)=2 and sum(case when g.eh_ia then 1 else 0 end)=v_cenario
        order by (select count(*) from public.rodadas_v3 r where r.participante_id=p_participante and r.tipo_midia=cp.tipo),random()
        limit ((v_n_comp+2)/3)
      loop
        exit when v_comp_n>=v_n_comp;
        select x.id into v_primeiro from public.conteudos x where x.comparacao_id=v_comp.id and x.ativo order by random() limit 1;
        select x.id into v_segundo from public.conteudos x where x.comparacao_id=v_comp.id and x.ativo and x.id<>v_primeiro limit 1;
        v_seq:=v_seq+1; v_comp_n:=v_comp_n+1;
        insert into public.rodadas_v3(participante_id,ordem,tipo_rodada,tipo_midia,comparacao_id,primeiro_id,segundo_id,enquadramento)
        values(p_participante,v_seq,'comparacao',v_comp.tipo,v_comp.id,v_primeiro,v_segundo,
          (array['neutro','ia','humano'])[1+mod(v_comp_n+v_offset,3)]);
      end loop;
    end loop;
    if v_comp_n<v_n_comp then
      for v_comp in
        select cp.id,cp.tipo from public.comparacoes cp
        join public.conteudos c on c.comparacao_id=cp.id and c.ativo
        join public.gabarito g on g.conteudo_id=c.id
        where cp.ativo and not exists(select 1 from public.rodadas_v3 r where r.participante_id=p_participante and r.comparacao_id=cp.id)
        group by cp.id,cp.tipo having count(*)=2
        order by (select count(*) from public.rodadas_v3 r where r.participante_id=p_participante and r.tipo_midia=cp.tipo),random()
        limit (v_n_comp-v_comp_n)
      loop
        select x.id into v_primeiro from public.conteudos x where x.comparacao_id=v_comp.id and x.ativo order by random() limit 1;
        select x.id into v_segundo from public.conteudos x where x.comparacao_id=v_comp.id and x.ativo and x.id<>v_primeiro limit 1;
        v_seq:=v_seq+1; v_comp_n:=v_comp_n+1;
        insert into public.rodadas_v3(participante_id,ordem,tipo_rodada,tipo_midia,comparacao_id,primeiro_id,segundo_id,enquadramento)
        values(p_participante,v_seq,'comparacao',v_comp.tipo,v_comp.id,v_primeiro,v_segundo,
         (array['neutro','ia','humano'])[1+mod(v_comp_n+v_offset,3)]);
      end loop;
    end if;
    if v_comp_n <> 20 or v_seq <> 40 then
      raise exception 'Sorteio incompleto: % individuais, % comparações. Verifique os pares cadastrados.', v_seq-v_comp_n, v_comp_n;
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
declare v_tot int; v_resp int; v_ind int; v_comp int;
begin
 select count(*),count(*) filter(where tipo_rodada='individual'),count(*) filter(where tipo_rodada='comparacao')
   into v_tot,v_ind,v_comp from public.rodadas_v3 where participante_id=p_participante;
 select count(*) into v_resp from public.rodadas_v3 r where r.participante_id=p_participante
   and ((r.tipo_rodada='individual' and exists(select 1 from public.respostas a where a.participante_id=p_participante and a.conteudo_id=r.conteudo_id))
     or (r.tipo_rodada='comparacao' and exists(select 1 from public.respostas_comp a where a.participante_id=p_participante and a.comparacao_id=r.comparacao_id)));
 if v_tot not in (30,40) or v_resp<>v_tot or (v_tot=40 and (v_ind<>20 or v_comp<>20)) then
   raise exception 'Teste incompleto ou protocolo incorreto: % respostas de % decisões (% individuais, % comparações)', v_resp,v_tot,v_ind,v_comp;
 end if;
 return public.finalizar_participante(p_participante,p_estimativa);
end $$;
grant execute on function public.finalizar_participante_v3(uuid,integer) to anon, authenticated;


NOTIFY pgrst, 'reload schema';
COMMIT;
