# chachafinance

Finanças, faculdade e agenda do Chamone e da Letícia. Next.js 16 + Supabase.

## Atualizando para a v2

1. **Rode a migração no Supabase.** Abra *SQL Editor*, cole o conteúdo de
   [`supabase/migracao.sql`](supabase/migracao.sql) e clique em **Run**. Ela só
   adiciona coisas (tabelas `contas`, `categorias`, `metas`, `acertos`,
   `faturas_pagas` e duas colunas em `financas`); nenhum dado existente é apagado.
   Pode rodar de novo sem problema.
2. **Desligue o cadastro público** em *Authentication → Sign In / Providers →
   Allow new users to sign up*. A tela de “criar conta” saiu do app, mas o
   Supabase ainda aceitaria cadastros pela API, e qualquer usuário logado
   enxerga os dados.
3. **Configure os cartões** no app, em *Contas e categorias*: informe o dia de
   fechamento e de vencimento do Nubank e do Intercred (e o limite, se quiser).
4. `npm install` e publique como antes.

Sem a migração o app continua abrindo com a lista padrão de contas e categorias,
mas cartões, orçamento, metas e acerto ficam indisponíveis (aparece um aviso).

## Rodando localmente

```bash
cp .env.example .env.local   # preencha URL e chave anon do Supabase
npm install
npm run dev
```

Atalho no computador: tecla **n** abre um novo lançamento.

## Estrutura

```
app/page.tsx            login, carregamento e navegação
app/globals.css         paleta (grafite, papel, cor de cada pessoa)
components/             Shell (menu), ui (botões, campos, folhas), formulários
views/                  uma tela por seção
lib/finance.ts          contas: resumo do mês, faturas, acerto do casal, notas
lib/store.ts            leitura/escrita no Supabase
lib/format.ts           dinheiro e datas (sempre no fuso local)
supabase/migracao.sql   tabelas novas
```

## Regras de cálculo

- **Investimentos** são reconhecidos pela categoria (tipo “investimento”) ou pela
  classificação “Investimento”. Não ficam no saldo do mês; aparecem como aporte.
- **Fatura**: compras a partir do dia de fechamento caem na fatura do mês seguinte.
  Parcelas futuras já entram nas próximas faturas.
- **Acerto do casal**: despesa paga por um com “Dividir com…” ligado gera dívida
  do outro na porcentagem escolhida. Gastos da conta conjunta não geram dívida.
- **Parcelas e recorrências** guardam um `grupo_id`; dá para editar ou apagar
  “este e os próximos” ou a série inteira.
- **Faculdade**: nota em branco = prova pendente. O app calcula quanto falta para
  60 (aprovação) e 40 (exame especial).
