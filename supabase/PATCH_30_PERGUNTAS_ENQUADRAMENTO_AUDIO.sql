-- REAL OU IA?  v3 | Execute no SQL Editor, uma vez, ANTES de publicar o frontend.
-- ADITIVO: não apaga textos, midias, participantes ou respostas anteriores.
create table if not exists public.rodadas_v3 (
 participante_id uuid not null references public.participantes(id) on delete cascade,
 ordem integer not null,
 tipo_rodada text not null check (tipo_rodada in ('individual','comparacao')),
 tipo_midia text not null check (tipo_midia in ('imagem','texto','audio','video')),
 conteudo_id uuid references public.conteudos(id),
 comparacao_id uuid references public.comparacoes(id),
 primeiro_id uuid references public.conteudos(id),
 segundo_id uuid references public.conteudos(id),
 enquadramento text not null check (enquadramento in ('neutro','ia','humano')),
 ordem_aleatoria double precision not null default random(),
 primary key (participante_id, ordem),
 check ((tipo_rodada = 'individual' and conteudo_id is not null and comparacao_id is null)
     or (tipo_rodada = 'comparacao' and comparacao_id is not null and primeiro_id is not null and segundo_id is not null and primeiro_id <> segundo_id))
);
create unique index if not exists rodada_ind_unica_v3 on public.rodadas_v3 (participante_id, conteudo_id) where conteudo_id is not null;
create unique index if not exists rodada_comp_unica_v3 on public.rodadas_v3 (participante_id, comparacao_id) where comparacao_id is not null;
alter table public.rodadas_v3 enable row level security;
revoke all on public.rodadas_v3 from anon, authenticated;

alter table public.respostas add column if not exists segundos_reproduzidos numeric(9,2);
alter table public.respostas add column if not exists pedidos_mais integer;

-- O sorteio e o gabarito ficam inteiramente no servidor. O frontend não lê gabarito nem título interno.
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
    select least(6, count(*)) into v_n_comp from (
      select cp.id from public.comparacoes cp
      join public.conteudos c on c.comparacao_id=cp.id and c.ativo
      join public.gabarito g on g.conteudo_id=c.id
      where cp.ativo
      group by cp.id having count(*)=2
    ) valida;
    v_n_ind := 30 - v_n_comp;
    v_target_ia := (v_n_ind / 2) + case when mod(v_n_ind,2)=1 and random()<0.5 then 1 else 0 end;
    v_target_real := v_n_ind - v_target_ia;
    if (select count(*) from public.conteudos c join public.gabarito g on g.conteudo_id=c.id
       where c.ativo and c.comparacao_id is null and g.eh_ia) < v_target_ia
      or (select count(*) from public.conteudos c join public.gabarito g on g.conteudo_id=c.id
       where c.ativo and c.comparacao_id is null and not g.eh_ia) < v_target_real then
       raise exception 'Conteúdos insuficientes para 30 decisões equilibradas: cadastre mais itens individuais de IA e reais';
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

-- Só aceita resposta para um item previamente sorteado àquele participante.
create or replace function public.enviar_resposta_v3(
  p_participante uuid,p_conteudo uuid,p_resposta_ia boolean,p_tempo_ms int,
  p_segundos_reproduzidos numeric,p_pedidos_mais integer
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_eh boolean;
begin
  if not exists(select 1 from public.rodadas_v3 r where r.participante_id=p_participante and r.conteudo_id=p_conteudo and r.tipo_rodada='individual')
  then raise exception 'Item não pertence ao teste sorteado'; end if;
  if not exists(select 1 from public.participantes p where p.id=p_participante and not p.finalizado)
  then raise exception 'Teste já finalizado'; end if;
  select g.eh_ia into v_eh from public.gabarito g where g.conteudo_id=p_conteudo;
  if v_eh is null then raise exception 'Gabarito ausente'; end if;
  insert into public.respostas(participante_id,conteudo_id,resposta_ia,acertou,tempo_ms,segundos_reproduzidos,pedidos_mais)
  values(p_participante,p_conteudo,p_resposta_ia,p_resposta_ia=v_eh,
   least(greatest(coalesce(p_tempo_ms,0),0),3600000),
   least(greatest(coalesce(p_segundos_reproduzidos,0),0),3600),
   least(greatest(coalesce(p_pedidos_mais,0),0),100))
  on conflict(participante_id,conteudo_id) do nothing;
end $$;

create or replace function public.enviar_comparacao_v3(
 p_participante uuid,p_comparacao uuid,p_marcados uuid[],p_tempo_ms int
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.rodadas_v3 r where r.participante_id=p_participante and r.comparacao_id=p_comparacao and r.tipo_rodada='comparacao')
  then raise exception 'Comparação não pertence à sessão'; end if;
  if exists(select 1 from unnest(coalesce(p_marcados,'{}'::uuid[])) x
           where not exists(select 1 from public.conteudos c where c.id=x and c.comparacao_id=p_comparacao))
  then raise exception 'Seleção inválida'; end if;
  perform public.enviar_comparacao(p_participante,p_comparacao,p_marcados,p_tempo_ms);
end $$;

create or replace function public.admin_metricas_v3() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.sou_admin() then raise exception 'Acesso negado'; end if;
 return jsonb_build_object(
  'individuais',coalesce((select jsonb_agg(jsonb_build_object(
    'participante_id',a.participante_id,'conteudo_id',a.conteudo_id,'tipo',r.tipo_midia,
    'enquadramento',r.enquadramento,'era_ia',g.eh_ia,'resposta_ia',a.resposta_ia,'acertou',a.acertou,
    'tempo_ms',a.tempo_ms,'segundos_reproduzidos',a.segundos_reproduzidos,'pedidos_mais',a.pedidos_mais))
    from public.respostas a join public.rodadas_v3 r on r.participante_id=a.participante_id and r.conteudo_id=a.conteudo_id
    join public.gabarito g on g.conteudo_id=a.conteudo_id), '[]'::jsonb),
  'comparacoes',coalesce((select jsonb_agg(jsonb_build_object(
    'participante_id',a.participante_id,'comparacao_id',a.comparacao_id,'tipo',r.tipo_midia,
    'enquadramento',r.enquadramento,'acertou',a.acertou,'tempo_ms',a.tempo_ms,
    'n_reais_ia',a.n_reais_ia,'n_marcados_ia',a.n_marcados_ia))
    from public.respostas_comp a join public.rodadas_v3 r on r.participante_id=a.participante_id and r.comparacao_id=a.comparacao_id), '[]'::jsonb));
end $$;

grant execute on function public.obter_teste_v3(uuid) to anon, authenticated;
grant execute on function public.enviar_resposta_v3(uuid,uuid,boolean,int,numeric,integer) to anon, authenticated;
grant execute on function public.enviar_comparacao_v3(uuid,uuid,uuid[],int) to anon, authenticated;
revoke execute on function public.admin_metricas_v3() from public, anon;
grant execute on function public.admin_metricas_v3() to authenticated;

-- Impede finalizar um teste incompleto e protege a integridade dos totais.
create or replace function public.finalizar_participante_v3(p_participante uuid,p_estimativa int)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tot int; v_resp int;
begin
 select count(*) into v_tot from public.rodadas_v3 where participante_id=p_participante;
 select count(*) into v_resp from public.rodadas_v3 r where r.participante_id=p_participante
   and ((r.tipo_rodada='individual' and exists(select 1 from public.respostas a where a.participante_id=p_participante and a.conteudo_id=r.conteudo_id))
     or (r.tipo_rodada='comparacao' and exists(select 1 from public.respostas_comp a where a.participante_id=p_participante and a.comparacao_id=r.comparacao_id)));
 if v_tot<>30 or v_resp<>30 then raise exception 'Ainda existem decisões não respondidas no teste: % de 30', v_resp; end if;
 return public.finalizar_participante(p_participante,p_estimativa);
end $$;
grant execute on function public.finalizar_participante_v3(uuid,integer) to anon, authenticated;

-- Atualiza o catálogo de funções expostas pelo Supabase/PostgREST.
notify pgrst, 'reload schema';
