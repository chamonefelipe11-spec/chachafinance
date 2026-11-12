# chachafinance

Finanças, faculdade e agenda do Chamone e da Letícia. Next.js 16 + Supabase, publicado na Vercel.

## Banco (Supabase → SQL Editor), nesta ordem

1. `supabase/migracao.sql` — contas, categorias, metas, acerto, faturas (v2).
2. `supabase/fase0-seguranca.sql` — só os logins do casal acessam (rode a etapa 1, confira os e-mails, depois a etapa 2).
3. `supabase/fase2a5.sql` — transferências, saldo, contas fixas, importação, avisos, grade da faculdade.
4. `supabase/projetos.sql` — quadro de projetos (cards e Gantt).
5. `supabase/correcao-tamanho.sql` — tira o limite de 10 letras de `financas.tipo` (sem ele, transferências,
   pagar fatura e ajuste de saldo dão "value too long for type character varying(10)").

Todos só acrescentam tabelas/colunas e podem ser rodados de novo. `fase0-desfazer.sql` volta a regra de acesso antiga.
Desligue o cadastro público em *Authentication → Sign In / Providers → Allow new users to sign up*.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Nome | Tipo | Para quê |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config | conexão do app |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Config | notificações no celular |
| `VAPID_PRIVATE_KEY` | Secret | notificações no celular |
| `CRON_SECRET` | Secret | protege o lembrete diário (`vercel.json`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | o lembrete diário lê o banco (aceita `sb_secret_…`) |

Depois de mudar variáveis, faça **Redeploy**.

Backup semanal (GitHub → Settings → Secrets → Actions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_SENHA`.
O arquivo fica em Actions → Backup semanal → execução → Artifacts, e é restaurado em Ajustes → Backup.

## Importação

CSV e OFX são lidos no navegador. PDFs usam o texto embutido (pdf.js); prints e PDFs escaneados passam por OCR
(tesseract.js, português) também no navegador — nada sai do aparelho. Os arquivos do leitor são copiados para
`public/ocr` por `scripts/copiar-ocr.mjs` antes do build.

## Rodando localmente

```bash
cp .env.example .env.local   # URL e chave anon do Supabase
npm install
npm run dev
```

Atalho no computador: tecla **n** abre um novo lançamento.

## Estrutura

```
app/page.tsx              login, carregamento e navegação
app/api/cron/avisos       lembrete diário (Vercel Cron) por notificação
components/               Shell (menu), ui, formulários, painéis de ajustes
views/                    uma tela por seção
lib/finance.ts            resumo do mês, faturas, saldos, contas fixas, acerto, notas
lib/importar.ts           CSV, OFX, texto de OCR/PDF → lançamentos para revisão
lib/ocr.ts                OCR e leitura de PDF no navegador
lib/store.ts              leitura (paginada) e escrita no Supabase
lib/projetos.ts           quadro: etiquetas, prazos, ordem dos cards, datas do Gantt
lib/backup.ts             backup e restauração (mesmo formato do backup semanal)
supabase/                 SQLs
```

## Regras de cálculo

- **Investimentos**: categoria do tipo investimento, ou transferência para a conta de investimento.
- **Transferências** (pagar fatura, aplicar na XP) não contam como gasto nem renda.
- **Contas fixas** geram o lançamento do mês atual e do próximo; no cartão/vale entram pagas, na conta ficam "a pagar".
- **Fatura**: compras a partir do dia de fechamento caem na fatura seguinte.
- **Acerto do casal**: despesa paga por um com "Dividir com…" gera dívida do outro; conta conjunta não gera.
- **Projetos**: cards numa coluna marcada como "concluídos" contam como feitos; o Gantt usa início e prazo
  (só um dos dois vira barra de um dia). "Acompanhar gastos" soma a categoria escolhida desde o início do card.
- **Faculdade**: nota em branco = prova pendente; faltas vêm das aulas marcadas quando existem.
