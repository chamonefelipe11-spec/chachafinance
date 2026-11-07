-- =====================================================================
-- chachafinance — desfaz a Fase 0 (só se algo sumir da tela)
-- Volta para "qualquer usuário logado acessa tudo". Não mexe nos dados.
-- =====================================================================

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
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format(
      'create policy logado_acessa on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
