-- =====================================================================
-- chachafinance — Projetos (quadro estilo Trello + Gantt)
--
-- Cole tudo no Supabase → SQL Editor → Run. Pode rodar mais de uma vez.
-- Só ACRESCENTA tabelas: nada do que já existe é apagado ou alterado
-- (a não ser ligar o aviso de prazos para quem já usa os avisos).
-- =====================================================================

create table if not exists public.quadro_colunas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  ordem      double precision not null default 0,
  concluida  boolean not null default false,   -- cards aqui contam como feitos
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id           uuid primary key default gen_random_uuid(),
  coluna_id    uuid not null references public.quadro_colunas (id) on delete cascade,
  titulo       text not null,
  descricao    text,
  quem         text not null default 'Ambos',
  etiqueta     text,                  -- projeto/assunto: Casa, Faculdade, Viagem…
  inicio       date,
  prazo        date,
  ordem        double precision not null default 0,
  checklist    jsonb not null default '[]',   -- [{ "id", "texto", "feito" }]
  categoria    text,                  -- liga o card aos gastos dessa categoria
  orcamento    numeric,
  concluido_em timestamptz,
  created_at   timestamptz not null default now(),
  constraint cards_datas check (inicio is null or prazo is null or inicio <= prazo)
);
create index if not exists cards_coluna_idx on public.cards (coluna_id);

-- Colunas iniciais (só se o quadro ainda estiver vazio)
insert into public.quadro_colunas (nome, ordem, concluida)
select * from (values ('A fazer', 1000::double precision, false), ('Fazendo', 2000, false), ('Feito', 3000, true)) v
where not exists (select 1 from public.quadro_colunas);

-- Acesso: só o casal (ou qualquer logado, se a Fase 0 ainda não rodou)
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
  foreach t in array array['quadro_colunas','cards'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format('create policy so_o_casal on public.%I for all to authenticated using (%s) with check (%s)', t, regra, regra);
    end if;
  end loop;
end $$;

-- Aviso no celular de card com prazo amanhã (liga para quem já usa os avisos)
do $$
begin
  if to_regclass('public.avisos_config') is not null then
    update public.avisos_config set avisos = array_append(avisos, 'projetos')
    where not ('projetos' = any (avisos));
    alter table public.avisos_config alter column avisos set default '{faturas,contas,agenda,orcamento,resumo,projetos}';
  end if;
end $$;
