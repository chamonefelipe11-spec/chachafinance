-- =====================================================================
-- chachafinance — migração v2
-- Cole tudo no Supabase → SQL Editor → Run. Pode rodar mais de uma vez:
-- nada é apagado e os dados atuais de financas/disciplinas/agenda ficam iguais.
-- =====================================================================

-- 1) Colunas novas em lançamentos -------------------------------------
alter table public.financas add column if not exists grupo_id uuid;          -- agrupa parcelas/recorrências
alter table public.financas add column if not exists divisao_pct numeric;    -- % que cabe ao outro (acerto do casal)
create index if not exists financas_data_idx  on public.financas (data);
create index if not exists financas_grupo_idx on public.financas (grupo_id);

-- Notas vazias passam a ser "pendente" (null) em vez de 0
alter table public.disciplinas alter column nota_p1 drop not null;
alter table public.disciplinas alter column nota_p2 drop not null;
alter table public.disciplinas alter column nota_p3 drop not null;

-- Agenda: permite editar e guardar sem horário
alter table public.agenda alter column hora drop not null;

-- 2) Contas e cartões ---------------------------------------------------
create table if not exists public.contas (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null unique,
  tipo            text not null default 'corrente' check (tipo in ('corrente','credito','beneficio','investimento')),
  cor             text not null default '#8F96A3',
  dia_fechamento  int  check (dia_fechamento between 1 and 31),
  dia_vencimento  int  check (dia_vencimento between 1 and 31),
  limite          numeric,
  ativo           boolean not null default true,
  ordem           int not null default 0,
  created_at      timestamptz not null default now()
);

insert into public.contas (nome, tipo, cor, ordem) values
  ('Conta Corrente / Pix', 'corrente',     '#6CCB9F', 0),
  ('Banco Inter',          'corrente',     '#F2A65A', 1),
  ('XP Investimentos',     'investimento', '#6FC3E8', 2),
  ('Cartão Nubank',        'credito',      '#A891F0', 3),
  ('Cartão Intercred',     'credito',      '#E3B860', 4),
  ('Caju VA',              'beneficio',    '#F08A7E', 5),
  ('Caju VR',              'beneficio',    '#EE9F7A', 6),
  ('Caju Cultura',         'beneficio',    '#D79BE8', 7),
  ('Caju Mobilidade',      'beneficio',    '#7FA7E8', 8),
  ('VR Padrão',            'beneficio',    '#EE93BD', 9)
on conflict (nome) do nothing;

-- 3) Categorias (com orçamento mensal opcional) -------------------------
create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  tipo       text not null default 'despesa' check (tipo in ('despesa','receita','investimento')),
  cor        text not null default '#8F96A3',
  orcamento  numeric,                       -- limite por mês (null = sem limite)
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.categorias (nome, tipo, cor, ordem) values
  ('Alimentação / Mercado',   'despesa',      '#E3B860', 0),
  ('FastFood / iFood',        'despesa',      '#F08A7E', 1),
  ('Moradia / Aluguel',       'despesa',      '#7FA7E8', 2),
  ('Casa / Manutenção',       'despesa',      '#C9A27E', 3),
  ('Transporte / Uber',       'despesa',      '#6CCB9F', 4),
  ('Assinaturas / Streaming', 'despesa',      '#A891F0', 5),
  ('Saúde / Farmácia',        'despesa',      '#EE93BD', 6),
  ('Lazer / Passeio',         'despesa',      '#5FC4D0', 7),
  ('Educação / EAD',          'despesa',      '#8E9BF5', 8),
  ('Roupas / Beleza',         'despesa',      '#D79BE8', 9),
  ('Presentes',               'despesa',      '#E0848F', 10),
  ('Imprevistos',             'despesa',      '#F2A65A', 11),
  ('Outros',                  'despesa',      '#8F96A3', 12),
  ('Salário / Renda',         'receita',      '#7DDBA3', 13),
  ('Freela / Extra',          'receita',      '#B5E07A', 14),
  ('Reembolso',               'receita',      '#9FD8C4', 15),
  ('Investimentos (CDB/XP)',  'investimento', '#6FC3E8', 16)
on conflict (nome) do nothing;

-- 4) Metas / caixinhas --------------------------------------------------
create table if not exists public.metas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  valor_alvo  numeric not null check (valor_alvo > 0),
  valor_atual numeric not null default 0,
  prazo       date,
  cor         text not null default '#7FB2FF',
  quem        text not null default 'Ambos',
  created_at  timestamptz not null default now()
);

-- 5) Acertos entre o casal (quando um paga o outro) ---------------------
create table if not exists public.acertos (
  id         uuid primary key default gen_random_uuid(),
  de         text not null,
  para       text not null,
  valor      numeric not null check (valor > 0),
  data       date not null default current_date,
  obs        text,
  created_at timestamptz not null default now()
);

-- 6) Faturas marcadas como pagas ----------------------------------------
create table if not exists public.faturas_pagas (
  id         uuid primary key default gen_random_uuid(),
  conta      text not null,
  referencia text not null,            -- YYYY-MM do fechamento
  pago_em    date not null default current_date,
  valor      numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (conta, referencia)
);

-- 7) Segurança: só usuários logados acessam as tabelas novas ------------
alter table public.contas        enable row level security;
alter table public.categorias    enable row level security;
alter table public.metas         enable row level security;
alter table public.acertos       enable row level security;
alter table public.faturas_pagas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['contas','categorias','metas','acertos','faturas_pagas'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'casal_acesso_total') then
      execute format('create policy casal_acesso_total on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- IMPORTANTE: como qualquer usuário logado enxerga tudo, desligue o cadastro público:
-- Supabase → Authentication → Sign In / Providers → desmarque "Allow new users to sign up".
