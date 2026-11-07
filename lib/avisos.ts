// Monta os avisos do dia e o resumo do mês (roda no servidor, no cron diário).
import type {
  Acerto,
  Categoria,
  Conta,
  Disciplina,
  Evento,
  FaturaPaga,
  Meta,
  Pessoa,
  Transacao,
} from "./types";
import {
  agrupar,
  cartaoConfigurado,
  despesasReais,
  doMes,
  faturasDoCartao,
  mapaCategorias,
  provasMarcadas,
  resumir,
  saldoCasal,
} from "./finance";
import { dinheiro, nomeMes, somarDiasISO, somarMeses } from "./format";

export const TIPOS_AVISO = [
  { id: "faturas", nome: "Fatura vencendo amanhã" },
  { id: "contas", nome: "Conta fixa vencendo amanhã" },
  { id: "agenda", nome: "Provas e compromissos de amanhã" },
  { id: "orcamento", nome: "Categoria passando de 90% do limite" },
  { id: "resumo", nome: "Resumo do mês, todo dia 1º" },
] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number]["id"];

export interface DadosAviso {
  transacoes: Transacao[];
  contas: Conta[];
  categorias: Categoria[];
  faturasPagas: FaturaPaga[];
  disciplinas: Disciplina[];
  eventos: Evento[];
  acertos: Acerto[];
  metas: Meta[];
}

export interface Mensagem {
  tipo: TipoAviso;
  titulo: string;
  corpo: string;
  url: string;
  /** null = para os dois */
  para: Pessoa | null;
}

/** Data de hoje em Brasília (o servidor da Vercel roda em UTC). */
export function hojeBrasilia(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function montarAvisos(d: DadosAviso, hoje: string): Mensagem[] {
  const amanha = somarDiasISO(hoje, 1);
  const cats = mapaCategorias(d.categorias);
  const msgs: Mensagem[] = [];

  // Faturas que vencem amanhã
  for (const c of d.contas.filter(cartaoConfigurado)) {
    for (const f of faturasDoCartao(d.transacoes, c, d.faturasPagas)) {
      if (!f.pagamento && f.total > 0 && f.vencimento === amanha) {
        msgs.push({
          tipo: "faturas",
          titulo: `Fatura ${c.nome.replace(/^Cartão\s+/i, "")} vence amanhã`,
          corpo: dinheiro(f.total),
          url: "/#cartoes",
          para: null,
        });
      }
    }
  }

  // Contas fixas ainda não pagas que vencem amanhã (ou já venceram hoje)
  const pendentes = d.transacoes.filter(
    (t) =>
      t.status === "previsto" &&
      t.tipo === "despesa" &&
      (t.data === amanha || t.data === hoje),
  );
  for (const t of pendentes) {
    msgs.push({
      tipo: "contas",
      titulo:
        t.data === hoje
          ? `${t.descricao} vence hoje`
          : `${t.descricao} vence amanhã`,
      corpo: `${dinheiro(t.valor)} · ${t.cartao}`,
      url: "/#contasfixas",
      para: t.quem === "Ambos" ? null : (t.quem as Pessoa),
    });
  }

  // Provas e compromissos de amanhã
  for (const p of provasMarcadas(d.disciplinas)) {
    if (p.data === amanha)
      msgs.push({
        tipo: "agenda",
        titulo: `Prova amanhã: ${p.titulo}`,
        corpo: "Boa prova!",
        url: "/#faculdade",
        para: p.quem,
      });
  }
  for (const e of d.eventos) {
    if (!e.concluido && e.data === amanha) {
      msgs.push({
        tipo: "agenda",
        titulo: `Amanhã: ${e.titulo}`,
        corpo: [e.hora?.slice(0, 5), e.categoria].filter(Boolean).join(" · "),
        url: "/#agenda",
        para: e.quem === "Ambos" ? null : (e.quem as Pessoa),
      });
    }
  }

  // Orçamento: avisa só no dia em que a categoria passa de 90%
  const mes = hoje.slice(0, 7);
  const doMesAteHoje = doMes(d.transacoes, mes).filter((t) => t.data <= hoje);
  const ateOntem = doMesAteHoje.filter((t) => t.data < hoje);
  for (const c of d.categorias.filter((c) => (c.orcamento || 0) > 0)) {
    const lim = c.orcamento!;
    const agora = despesasReais(doMesAteHoje, cats)
      .filter((t) => t.categoria === c.nome)
      .reduce((a, t) => a + t.valor, 0);
    const antes = despesasReais(ateOntem, cats)
      .filter((t) => t.categoria === c.nome)
      .reduce((a, t) => a + t.valor, 0);
    if (agora >= lim * 0.9 && antes < lim * 0.9) {
      msgs.push({
        tipo: "orcamento",
        titulo: `${c.nome}: ${Math.round((agora / lim) * 100)}% do limite`,
        corpo: `${dinheiro(agora)} de ${dinheiro(lim)} em ${nomeMes(mes)}`,
        url: "/#orcamento",
        para: null,
      });
    }
  }

  // Dia 1º: resumo do mês que acabou
  if (hoje.endsWith("-01"))
    msgs.push(resumoDoMes(d, somarMeses(mes, -1), hoje));

  return msgs;
}

export function resumoDoMes(
  d: DadosAviso,
  mes: string,
  hoje: string,
): Mensagem {
  const cats = mapaCategorias(d.categorias);
  const doM = doMes(d.transacoes, mes);
  const r = resumir(doM, cats);
  const ant = resumir(doMes(d.transacoes, somarMeses(mes, -1)), cats);
  const top = agrupar(
    despesasReais(doM, cats),
    (t) => t.categoria,
    () => "",
  ).slice(0, 3);
  const estouradas = d.categorias.filter(
    (c) =>
      c.orcamento &&
      despesasReais(doM, cats)
        .filter((t) => t.categoria === c.nome)
        .reduce((a, t) => a + t.valor, 0) > c.orcamento,
  );
  const casal = saldoCasal(d.transacoes, d.acertos, hoje);
  const linhas = [
    `Entrou ${dinheiro(r.receitas)}, saiu ${dinheiro(r.despesas)}: ${r.saldo >= 0 ? "sobrou" : "faltou"} ${dinheiro(Math.abs(r.saldo))}.`,
    ant.despesas > 0
      ? `Gastos ${r.despesas <= ant.despesas ? "abaixo" : "acima"} do mês anterior em ${dinheiro(Math.abs(r.despesas - ant.despesas))}.`
      : "",
    top.length
      ? `Mais pesaram: ${top.map((t) => `${t.nome} (${dinheiro(t.valor)})`).join(", ")}.`
      : "",
    estouradas.length
      ? `Passaram do limite: ${estouradas.map((c) => c.nome).join(", ")}.`
      : "",
    r.aportes - r.resgates > 0
      ? `Investido: ${dinheiro(r.aportes - r.resgates)}.`
      : "",
    casal.devedor
      ? `Acerto: ${casal.devedor} deve ${dinheiro(casal.valor)} para ${casal.credor}.`
      : "Acerto do casal: tudo zerado.",
  ].filter(Boolean);
  return {
    tipo: "resumo",
    titulo: `Resumo de ${nomeMes(mes)}`,
    corpo: linhas.join(" "),
    url: "/#analises",
    para: null,
  };
}
