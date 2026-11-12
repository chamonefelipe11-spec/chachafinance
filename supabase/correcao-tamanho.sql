-- =====================================================================
-- chachafinance — correção: campos de texto com tamanho máximo
--
-- A tabela financas foi criada com "tipo" limitado a 10 letras, e
-- "transferencia" tem 13. Por isso transferências, pagar fatura e ajuste
-- de saldo davam "value too long for type character varying(10)".
--
-- Isto só AUMENTA o limite (vira texto sem limite) nas tabelas do app.
-- Nenhum dado é apagado ou alterado. Pode rodar mais de uma vez.
-- =====================================================================

do $$
declare
  c record;
begin
  for c in
    select table_name, column_name, character_maximum_length
    from information_schema.columns
    where table_schema = 'public'
      and data_type = 'character varying'
      and character_maximum_length is not null
      and table_name in (
        'financas', 'disciplinas', 'agenda', 'contas', 'categorias', 'metas', 'acertos',
        'faturas_pagas', 'recorrencias', 'regras', 'importacoes', 'aulas', 'presencas',
        'avisos_config', 'push_inscricoes', 'quadro_colunas', 'cards'
      )
  loop
    begin
      execute format('alter table public.%I alter column %I type text', c.table_name, c.column_name);
      raise notice 'public.%.% (varchar(%)) agora é text', c.table_name, c.column_name, c.character_maximum_length;
    exception when others then
      -- Ex.: uma "view" criada à mão usa a coluna. As outras colunas seguem sendo corrigidas.
      raise warning 'Não consegui mudar public.%.%: %', c.table_name, c.column_name, sqlerrm;
    end;
  end loop;
end $$;

-- Confere: não deve sobrar nenhuma linha aqui
select table_name, column_name, character_maximum_length
from information_schema.columns
where table_schema = 'public' and data_type = 'character varying' and character_maximum_length is not null
  and table_name in ('financas', 'disciplinas', 'agenda', 'contas', 'categorias', 'metas', 'acertos',
                     'faturas_pagas', 'recorrencias', 'regras', 'importacoes', 'aulas', 'presencas',
                     'avisos_config', 'push_inscricoes', 'quadro_colunas', 'cards');
