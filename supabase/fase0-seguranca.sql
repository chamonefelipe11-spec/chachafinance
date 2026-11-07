-- =====================================================================
-- chachafinance — Fase 0: só vocês dois acessam o banco
--
-- Rode em DUAS etapas no Supabase → SQL Editor.
-- Nada aqui apaga ou altera lançamentos, notas ou compromissos: só troca
-- QUEM pode ler e gravar. Se algo sumir da tela, rode fase0-desfazer.sql.
-- =====================================================================


-- ---------------------------------------------------------------------
-- ETAPA 1 — DIAGNÓSTICO (só lê). Selecione este bloco e clique em Run.
-- Confira na última tabela: devem aparecer SÓ os e-mails de vocês dois.
-- Se aparecer outro e-mail, apague esse usuário em Authentication → Users
-- antes da etapa 2.
-- ---------------------------------------------------------------------

select c.relname as tabela, c.relrowsecurity as rls_ligado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

select tablename as tabela, policyname as regra, roles as para_quem, cmd as acao, qual as condicao
from pg_policies where schemaname = 'public'
order by 1, 2;

select email, created_at as criado_em, last_sign_in_at as ultimo_login
from auth.users order by created_at;


-- ---------------------------------------------------------------------
-- ETAPA 2 — APLICAR. Selecione daqui até o fim e clique em Run.
-- ---------------------------------------------------------------------

-- Quem pode entrar: os e-mails que já existem no login do app
create table if not exists public.membros (
  email text primary key,
  nome  text,
  created_at timestamptz not null default now()
);
alter table public.membros enable row level security;  -- sem regras: ninguém lê pela API

insert into public.membros (email)
select lower(email) from auth.users where email is not null
on conflict (email) do nothing;

-- Confere o e-mail de quem está logado
create or replace function public.eh_do_casal()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membros
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.eh_do_casal() from public, anon;
grant execute on function public.eh_do_casal() to authenticated;

-- Troca as regras de todas as tabelas do app por "só o casal"
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'financas','disciplinas','agenda',
    'contas','categorias','metas','acertos','faturas_pagas',
    'recorrencias','importacoes','regras','avisos_config','push_inscricoes','aulas','presencas'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format(
      'create policy so_o_casal on public.%I for all to authenticated using (public.eh_do_casal()) with check (public.eh_do_casal())',
      t
    );
  end loop;
end $$;

-- Resultado: cada tabela deve aparecer com a regra so_o_casal
select tablename as tabela, policyname as regra from pg_policies
where schemaname = 'public' order by 1;

-- Depois: Authentication → Sign In / Providers → desmarque "Allow new users to sign up".
-- Para incluir alguém no futuro: insert into public.membros (email) values ('email@exemplo.com');
