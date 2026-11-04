-- ============================================================
-- REAL OU IA? — rode este arquivo INTEIRO de uma vez no SQL Editor
-- Pode rodar por cima da versão anterior: não apaga nada que já existe.
-- ============================================================
create extension if not exists pgcrypto;

-- ---------- TABELAS ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- uma "comparação" = rodada com 2 conteúdos do mesmo tipo
create table if not exists public.comparacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('imagem','audio','texto','video')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.conteudos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('imagem','audio','texto','video')),
  titulo text,
  url text,
  texto text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  check ((tipo = 'texto' and texto is not null) or (tipo <> 'texto' and url is not null))
);
-- conteudos.comparacao_id nulo = conteúdo individual; preenchido = item de uma comparação
alter table public.conteudos add column if not exists comparacao_id uuid references public.comparacoes(id) on delete cascade;
alter table public.conteudos add column if not exists posicao int;

-- o gabarito fica separado: participantes NUNCA conseguem ler
create table if not exists public.gabarito (
  conteudo_id uuid primary key references public.conteudos(id) on delete cascade,
  eh_ia boolean not null
);

create table if not exists public.participantes (
  id uuid primary key default gen_random_uuid(),
  faixa_etaria text,
  genero text,
  escolaridade text,
  freq_ia text,
  usos_ia text[] not null default '{}',
  confianca int check (confianca between 1 and 5),
  estimativa_acertos int check (estimativa_acertos >= 0),
  finalizado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.respostas (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.participantes(id) on delete cascade,
  conteudo_id uuid not null references public.conteudos(id) on delete cascade,
  resposta_ia boolean not null,
  acertou boolean not null,
  tempo_ms int,
  created_at timestamptz not null default now(),
  unique (participante_id, conteudo_id)
);
create index if not exists respostas_participante_idx on public.respostas(participante_id);

create table if not exists public.respostas_comp (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.participantes(id) on delete cascade,
  comparacao_id uuid not null references public.comparacoes(id) on delete cascade,
  n_itens int not null,
  n_reais_ia int not null,      -- quantos itens eram IA de verdade (0, 1 ou 2)
  n_marcados_ia int not null,   -- quantos a pessoa marcou como IA
  acertos_itens int not null,   -- itens classificados corretamente
  acertou boolean not null,     -- acertou todos os itens da rodada
  tempo_ms int,
  created_at timestamptz not null default now(),
  unique (participante_id, comparacao_id)
);
create index if not exists respostas_comp_participante_idx on public.respostas_comp(participante_id);

-- quais itens a pessoa marcou como IA (permite recalcular quando o gabarito for corrigido)
alter table public.respostas_comp add column if not exists marcados uuid[];

-- histórico de correções de gabarito (nada é apagado; dá para desfazer mudando de novo)
create table if not exists public.correcoes_gabarito (
  id uuid primary key default gen_random_uuid(),
  conteudo_id uuid references public.conteudos(id) on delete set null,
  de_eh_ia boolean,
  para_eh_ia boolean,
  respostas_afetadas int not null default 0,
  respostas_alteradas int not null default 0,
  por uuid,
  em timestamptz not null default now()
);

-- ---------- ADMIN ----------
create or replace function public.sou_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- RLS ----------
alter table public.admins enable row level security;
alter table public.comparacoes enable row level security;
alter table public.conteudos enable row level security;
alter table public.gabarito enable row level security;
alter table public.participantes enable row level security;
alter table public.respostas enable row level security;
alter table public.respostas_comp enable row level security;
alter table public.correcoes_gabarito enable row level security;

drop policy if exists "admins le o proprio" on public.admins;
create policy "admins le o proprio" on public.admins for select using (user_id = auth.uid());

drop policy if exists "ler comparacoes" on public.comparacoes;
create policy "ler comparacoes" on public.comparacoes for select using (ativo or public.sou_admin());
drop policy if exists "admin escreve comparacoes" on public.comparacoes;
create policy "admin escreve comparacoes" on public.comparacoes for all using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists "ler conteudos" on public.conteudos;
create policy "ler conteudos" on public.conteudos for select using (ativo or public.sou_admin());
drop policy if exists "admin escreve conteudos" on public.conteudos;
create policy "admin escreve conteudos" on public.conteudos for all using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists "admin gabarito" on public.gabarito;
create policy "admin gabarito" on public.gabarito for all using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists "admin le participantes" on public.participantes;
create policy "admin le participantes" on public.participantes for select using (public.sou_admin());
drop policy if exists "admin apaga participantes" on public.participantes;
create policy "admin apaga participantes" on public.participantes for delete using (public.sou_admin());

drop policy if exists "admin le respostas" on public.respostas;
create policy "admin le respostas" on public.respostas for select using (public.sou_admin());
drop policy if exists "admin le respostas_comp" on public.respostas_comp;
create policy "admin le respostas_comp" on public.respostas_comp for select using (public.sou_admin());
drop policy if exists "admin le correcoes" on public.correcoes_gabarito;
create policy "admin le correcoes" on public.correcoes_gabarito for select using (public.sou_admin());

-- participante (anon) NÃO enxerga o nome interno do conteúdo (poderia entregar a resposta)
revoke select on public.conteudos from anon;
grant select (id, tipo, url, texto, ativo, comparacao_id, created_at) on public.conteudos to anon;

-- ---------- FUNÇÕES PÚBLICAS (o participante só escreve por aqui) ----------
create or replace function public.registrar_participante(
  p_faixa text, p_genero text, p_escolaridade text, p_freq text, p_usos text[], p_confianca int
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.participantes (faixa_etaria, genero, escolaridade, freq_ia, usos_ia, confianca)
  values (p_faixa, p_genero, p_escolaridade, p_freq, coalesce(p_usos, '{}'), p_confianca)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.enviar_resposta(
  p_participante uuid, p_conteudo uuid, p_resposta_ia boolean, p_tempo_ms int
) returns void language plpgsql security definer set search_path = public as $$
declare v_eh boolean;
begin
  select g.eh_ia into v_eh
    from public.gabarito g join public.conteudos c on c.id = g.conteudo_id
   where g.conteudo_id = p_conteudo and c.comparacao_id is null;
  if v_eh is null then raise exception 'conteudo invalido'; end if;
  if not exists (select 1 from public.participantes where id = p_participante and not finalizado) then
    raise exception 'participante invalido';
  end if;
  insert into public.respostas (participante_id, conteudo_id, resposta_ia, acertou, tempo_ms)
  values (p_participante, p_conteudo, p_resposta_ia, p_resposta_ia = v_eh, least(greatest(coalesce(p_tempo_ms, 0), 0), 600000))
  on conflict (participante_id, conteudo_id) do nothing;
end $$;

-- p_marcados = ids dos itens que a pessoa marcou como IA (a ordem na tela não importa)
create or replace function public.enviar_comparacao(
  p_participante uuid, p_comparacao uuid, p_marcados uuid[], p_tempo_ms int
) returns void language plpgsql security definer set search_path = public as $$
declare v_n int; v_ok int; v_ia int; v_marc int; v_ids uuid[];
begin
  if not exists (select 1 from public.participantes where id = p_participante and not finalizado) then
    raise exception 'participante invalido';
  end if;
  select count(*),
         count(*) filter (where (c.id = any(coalesce(p_marcados, '{}'::uuid[]))) = g.eh_ia),
         count(*) filter (where g.eh_ia),
         count(*) filter (where c.id = any(coalesce(p_marcados, '{}'::uuid[]))),
         coalesce(array_agg(c.id) filter (where c.id = any(coalesce(p_marcados, '{}'::uuid[]))), '{}'::uuid[])
    into v_n, v_ok, v_ia, v_marc, v_ids
    from public.conteudos c join public.gabarito g on g.conteudo_id = c.id
   where c.comparacao_id = p_comparacao;
  if v_n = 0 then raise exception 'comparacao invalida'; end if;
  insert into public.respostas_comp (participante_id, comparacao_id, n_itens, n_reais_ia, n_marcados_ia, acertos_itens, acertou, tempo_ms, marcados)
  values (p_participante, p_comparacao, v_n, v_ia, v_marc, v_ok, v_ok = v_n, least(greatest(coalesce(p_tempo_ms, 0), 0), 600000), v_ids)
  on conflict (participante_id, comparacao_id) do nothing;
end $$;

create or replace function public.finalizar_participante(p_participante uuid, p_estimativa int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  update public.participantes
     set finalizado = true, estimativa_acertos = greatest(p_estimativa, 0)
   where id = p_participante and not finalizado;

  select jsonb_build_object(
    'total',  (select count(*) from public.respostas where participante_id = p_participante),
    'acertos',(select count(*) from public.respostas where participante_id = p_participante and acertou),
    'por_tipo', coalesce((
      select jsonb_object_agg(tipo, jsonb_build_object('total', t, 'acertos', a))
      from (select c.tipo, count(*) t, count(*) filter (where r2.acertou) a
              from public.respostas r2 join public.conteudos c on c.id = r2.conteudo_id
             where r2.participante_id = p_participante group by c.tipo) x
    ), '{}'::jsonb),
    'comp', jsonb_build_object(
      'total',  (select count(*) from public.respostas_comp where participante_id = p_participante),
      'acertos',(select count(*) from public.respostas_comp where participante_id = p_participante and acertou))
  ) into r;
  return r;
end $$;

-- ---------- FUNÇÕES DO ADMIN ----------
-- recalcula as rodadas de comparação de uma comparação (só as que guardaram os itens marcados)
create or replace function public.recalcular_comparacao(p_comp uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  with novo as (
    select rc.id, count(*) n, count(*) filter (where g.eh_ia) n_ia,
           count(*) filter (where (c.id = any(rc.marcados)) = g.eh_ia) ok
      from public.respostas_comp rc
      join public.conteudos c on c.comparacao_id = rc.comparacao_id
      join public.gabarito g on g.conteudo_id = c.id
     where rc.comparacao_id = p_comp and rc.marcados is not null
     group by rc.id
  ), up as (
    update public.respostas_comp rc
       set n_reais_ia = novo.n_ia, acertos_itens = novo.ok, acertou = (novo.ok = novo.n)
      from novo
     where rc.id = novo.id
       and (rc.n_reais_ia, rc.acertos_itens, rc.acertou) is distinct from (novo.n_ia, novo.ok, (novo.ok = novo.n))
    returning 1
  )
  select count(*) into v from up;
  return v;
end $$;
revoke execute on function public.recalcular_comparacao(uuid) from public, anon, authenticated;

-- corrige a origem (IA ou real) de UM conteúdo e recalcula as respostas já dadas
create or replace function public.corrigir_origem(p_conteudo uuid, p_eh_ia boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old boolean; v_comp uuid; v_afet int := 0; v_alt int := 0; v_leg int := 0;
begin
  if not public.sou_admin() then raise exception 'acesso negado'; end if;
  select g.eh_ia, c.comparacao_id into v_old, v_comp
    from public.gabarito g join public.conteudos c on c.id = g.conteudo_id
   where g.conteudo_id = p_conteudo;
  if not found then raise exception 'conteudo sem gabarito'; end if;
  if v_old = p_eh_ia then return jsonb_build_object('alterado', false, 'respostas', 0, 'mudaram', 0, 'comp_legadas', 0); end if;

  update public.gabarito set eh_ia = p_eh_ia where conteudo_id = p_conteudo;

  if v_comp is null then
    select count(*), count(*) filter (where acertou <> (resposta_ia = p_eh_ia))
      into v_afet, v_alt from public.respostas where conteudo_id = p_conteudo;
    update public.respostas set acertou = (resposta_ia = p_eh_ia) where conteudo_id = p_conteudo;
  else
    v_alt := public.recalcular_comparacao(v_comp);
    select count(*) filter (where marcados is not null), count(*) filter (where marcados is null)
      into v_afet, v_leg from public.respostas_comp where comparacao_id = v_comp;
  end if;

  insert into public.correcoes_gabarito (conteudo_id, de_eh_ia, para_eh_ia, respostas_afetadas, respostas_alteradas, por)
  values (p_conteudo, v_old, p_eh_ia, v_afet, v_alt, auth.uid());
  return jsonb_build_object('alterado', true, 'respostas', v_afet, 'mudaram', v_alt, 'comp_legadas', v_leg);
end $$;

-- recalcula TODAS as respostas a partir do gabarito atual (idempotente, não apaga nada)
create or replace function public.recalcular_respostas() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ind int; v_cmp int; v_leg int;
begin
  if not public.sou_admin() then raise exception 'acesso negado'; end if;
  with up as (
    update public.respostas r set acertou = (r.resposta_ia = g.eh_ia)
      from public.gabarito g
     where g.conteudo_id = r.conteudo_id and r.acertou <> (r.resposta_ia = g.eh_ia)
    returning 1)
  select count(*) into v_ind from up;
  select coalesce(sum(public.recalcular_comparacao(id)), 0)::int into v_cmp from public.comparacoes;
  select count(*) into v_leg from public.respostas_comp where marcados is null;
  return jsonb_build_object('individuais_corrigidas', v_ind, 'comparacoes_corrigidas', v_cmp, 'comparacoes_legadas', v_leg);
end $$;

create or replace function public.admin_dados() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.sou_admin() then raise exception 'acesso negado'; end if;
  return jsonb_build_object(
    'participantes', coalesce((select jsonb_agg(to_jsonb(p)) from public.participantes p), '[]'::jsonb),
    'respostas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'participante_id', r.participante_id, 'conteudo_id', r.conteudo_id, 'tipo', c.tipo,
        'eh_ia', g.eh_ia, 'resposta_ia', r.resposta_ia, 'acertou', r.acertou, 'tempo_ms', r.tempo_ms))
      from public.respostas r
      join public.conteudos c on c.id = r.conteudo_id
      join public.gabarito g on g.conteudo_id = r.conteudo_id
    ), '[]'::jsonb),
    'resp_comp', coalesce((
      select jsonb_agg(jsonb_build_object(
        'participante_id', rc.participante_id, 'comparacao_id', rc.comparacao_id, 'tipo', cp.tipo,
        'n_itens', rc.n_itens, 'n_reais_ia', rc.n_reais_ia, 'n_marcados_ia', rc.n_marcados_ia,
        'acertos_itens', rc.acertos_itens, 'acertou', rc.acertou, 'tempo_ms', rc.tempo_ms, 'marcados', rc.marcados))
      from public.respostas_comp rc join public.comparacoes cp on cp.id = rc.comparacao_id
    ), '[]'::jsonb),
    'comparacoes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'ativo', ativo) order by created_at) from public.comparacoes), '[]'::jsonb),
    'conteudos', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'tipo', c.tipo, 'titulo', c.titulo, 'eh_ia', g.eh_ia,
                       'ativo', c.ativo, 'comparacao_id', c.comparacao_id, 'posicao', c.posicao,
                       'url', c.url, 'texto', c.texto) order by c.created_at)
      from public.conteudos c left join public.gabarito g on g.conteudo_id = c.id
    ), '[]'::jsonb),
    'correcoes', coalesce((
      select jsonb_agg(jsonb_build_object('em', x.em, 'conteudo_id', x.conteudo_id, 'de', x.de_eh_ia, 'para', x.para_eh_ia,
                       'afetadas', x.respostas_afetadas, 'alteradas', x.respostas_alteradas) order by x.em desc)
      from (select * from public.correcoes_gabarito order by em desc limit 50) x
    ), '[]'::jsonb)
  );
end $$;

grant execute on function public.sou_admin() to anon, authenticated;
grant execute on function public.registrar_participante(text,text,text,text,text[],int) to anon, authenticated;
grant execute on function public.enviar_resposta(uuid,uuid,boolean,int) to anon, authenticated;
grant execute on function public.enviar_comparacao(uuid,uuid,uuid[],int) to anon, authenticated;
grant execute on function public.finalizar_participante(uuid,int) to anon, authenticated;
revoke execute on function public.admin_dados() from anon;
revoke execute on function public.corrigir_origem(uuid,boolean) from anon;
grant execute on function public.corrigir_origem(uuid,boolean) to authenticated;
revoke execute on function public.recalcular_respostas() from anon;
grant execute on function public.recalcular_respostas() to authenticated;
grant execute on function public.admin_dados() to authenticated;

-- ---------- TEMPO REAL (admin vê as respostas chegando) ----------
do $$ begin alter publication supabase_realtime add table public.respostas;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.respostas_comp;
exception when duplicate_object then null; end $$;

-- ---------- STORAGE (fotos, áudios e vídeos) ----------
insert into storage.buckets (id, name, public) values ('midia', 'midia', true) on conflict (id) do nothing;
drop policy if exists "admin envia midia" on storage.objects;
create policy "admin envia midia" on storage.objects for insert to authenticated
  with check (bucket_id = 'midia' and public.sou_admin());
drop policy if exists "admin apaga midia" on storage.objects;
create policy "admin apaga midia" on storage.objects for delete to authenticated
  using (bucket_id = 'midia' and public.sou_admin());

-- ---------- SEU ADMIN: TROQUE O E-MAIL ABAIXO ----------
insert into public.admins (user_id)
select id from auth.users where email = 'TROQUE-AQUI@seuemail.com'
on conflict do nothing;
