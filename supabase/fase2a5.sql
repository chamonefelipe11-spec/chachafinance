-- =====================================================================
-- chachafinance — v3 (Fases 2 a 5): saldo real, transferências, contas fixas,
-- importação, avisos e grade da faculdade.
--
-- Cole tudo no Supabase → SQL Editor → Run. Pode rodar mais de uma vez.
-- Só ACRESCENTA colunas e tabelas: nenhum lançamento, nota ou compromisso
-- é apagado ou alterado. (Baixe um backup antes, em Ajustes → Backup.)
-- =====================================================================

-- ---------- Fase 2: transferências, contas fixas e saldo ----------
alter table public.financas add column if not exists conta_destino  text;
alter table public.financas add column if not exists status         text not null default 'pago';
alter table public.financas add column if not exists recorrencia_id uuid;
alter table public.financas add column if not exists competencia    text;   -- YYYY-MM da conta fixa

-- O tipo passa a aceitar 'transferencia' (troca só a regra de validação, se existir)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.financas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ~* '\mtipo\M' and pg_get_constraintdef(oid) !~* 'tipo_gasto'
  loop
    execute format('alter table public.financas drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'public.financas'::regclass and conname = 'financas_tipo_valido') then
    alter table public.financas add constraint financas_tipo_valido check (tipo in ('despesa','receita','transferencia'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.financas'::regclass and conname = 'financas_status_valido') then
    alter table public.financas add constraint financas_status_valido check (status in ('pago','previsto'));
  end if;
  -- Um lançamento por conta fixa por mês (evita duplicar quando os dois abrem o app)
  if not exists (select 1 from pg_constraint where conrelid = 'public.financas'::regclass and conname = 'financas_recorrencia_mes') then
    alter table public.financas add constraint financas_recorrencia_mes unique (recorrencia_id, competencia);
  end if;
end $$;

alter table if exists public.contas add column if not exists saldo_inicial    numeric;
alter table if exists public.contas add column if not exists saldo_inicial_em date;

alter table if exists public.faturas_pagas add column if not exists transacao_id text; -- a transferência que pagou a fatura

create table if not exists public.recorrencias (
  id          uuid primary key default gen_random_uuid(),
  descricao   text not null,
  valor       numeric not null check (valor > 0),
  tipo        text not null default 'despesa' check (tipo in ('despesa','receita')),
  categoria   text not null,
  cartao      text not null,
  quem        text not null default 'Ambos',
  divisao_pct numeric,
  dia         int not null check (dia between 1 and 31),
  inicio      text not null,          -- YYYY-MM
  fim         text,                   -- YYYY-MM (null = sem fim)
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Meses de uma conta fixa que foram apagados de propósito (não são recriados)
alter table public.recorrencias add column if not exists pulados text[] not null default '{}';

-- ---------- Fase 3: importação ----------
alter table public.financas add column if not exists import_hash   text;
alter table public.financas add column if not exists importacao_id uuid;
create index if not exists financas_import_hash_idx on public.financas (import_hash);
create index if not exists financas_importacao_idx  on public.financas (importacao_id);

create table if not exists public.importacoes (
  id         uuid primary key default gen_random_uuid(),
  origem     text not null,
  conta      text not null,
  arquivo    text,
  qtd        int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.regras (
  id              uuid primary key default gen_random_uuid(),
  contem          text not null,
  categoria       text,
  quem            text,
  divisao_pct     numeric,
  transferir_para text,
  ignorar         boolean not null default false,
  ordem           int not null default 0,
  created_at      timestamptz not null default now()
);

-- ---------- Fase 4: avisos ----------
create table if not exists public.avisos_config (
  email         text primary key,
  pessoa        text,
  push          boolean not null default false,
  email_ativo   boolean not null default false,
  email_destino text,
  avisos        text[] not null default '{faturas,contas,agenda,orcamento,resumo}',
  updated_at    timestamptz not null default now()
);

create table if not exists public.push_inscricoes (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- ---------- Fase 5: faculdade ----------
alter table public.disciplinas add column if not exists carga_horaria int;
alter table public.disciplinas add column if not exists data_p1 date;
alter table public.disciplinas add column if not exists data_p2 date;
alter table public.disciplinas add column if not exists data_p3 date;

create table if not exists public.aulas (
  id            uuid primary key default gen_random_uuid(),
  disciplina_id text not null,
  dia_semana    int not null check (dia_semana between 0 and 6),  -- 0 = domingo
  inicio        text not null,   -- HH:MM
  fim           text not null,
  sala          text,
  peso          int not null default 1,  -- faltas que um encontro vale
  created_at    timestamptz not null default now()
);

create table if not exists public.presencas (
  id            uuid primary key default gen_random_uuid(),
  disciplina_id text not null,
  aula_id       uuid,
  data          date not null,
  presente      boolean not null,
  peso          int not null default 1,
  created_at    timestamptz not null default now()
);
create unique index if not exists presencas_aula_dia on public.presencas (aula_id, data) where aula_id is not null;

-- ---------- Acesso: só o casal (ou qualquer logado, se a Fase 0 ainda não rodou) ----------
do $$
declare
  t text;
  regra text;
begin
  if exists (select 1 from pg_proc where proname = 'eh_do_casal') then
    regra := 'public.eh_do_casal()';
  else
    regra := 'true';
  end if;
  foreach t in array array['recorrencias','importacoes','regras','avisos_config','push_inscricoes','aulas','presencas'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format('create policy so_o_casal on public.%I for all to authenticated using (%s) with check (%s)', t, regra, regra);
    end if;
  end loop;
end $$;
