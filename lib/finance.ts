import type {
  Acerto,
  Aula,
  Categoria,
  Conta,
  Disciplina,
  FaturaPaga,
  Pessoa,
  Presenca,
  Recorrencia,
  TipoConta,
  Transacao,
} from "./types";
import { NOTA_APROVACAO, NOTA_EXAME } from "./defaults";
import {
  diasNoMes,
  diffDias,
  hojeISO,
  mesAtual,
  somarDiasISO,
  somarMeses,
} from "./format";

export type MapaCategorias = Map<string, Categoria>;

export const mapaCategorias = (cats: Categoria[]): MapaCategorias =>
  new Map(cats.map((c) => [c.nome, c]));

/** Investimento é definido pela categoria (tipo "investimento") ou pela classificação — nunca pela descrição. */
export function ehInvestimento(t: Transacao, cats: MapaCategorias): boolean {
  const cat = cats.get(t.categoria);
  if (cat) return cat.tipo === "investimento";
  return (
    t.tipo_gasto === "Investimento" ||
    (t.categoria || "").toLowerCase().includes("investimento")
  );
}

/** Fixa pela classificação ou, nos lançamentos antigos, pelo sufixo "(Fixo Mês N)" */
export const ehFixa = (t: Transacao) =>
  t.tipo_gasto === "Fixo" || /\(Fixo Mês \d+\)$/.test(t.descricao || "");

export const doMes = (ts: Transacao[], mes: string) =>
  ts.filter((t) => t.data?.startsWith(mes));

export interface Resumo {
  receitas: number;
  despesas: number;
  aportes: number;
  resgates: number;
  saldo: number;
  fixas: number;
  variaveis: number;
}

// Tipo de cada conta (definido pelo app ao carregar), para saber se uma transferência é aporte ou resgate
let tiposConta = new Map<string, TipoConta>();
export const definirContas = (contas: Conta[]) => {
  tiposConta = new Map(contas.map((c) => [c.nome, c.tipo]));
};
const ehContaInvest = (nome?: string | null) =>
  !!nome && tiposConta.get(nome) === "investimento";

export const ehTransferencia = (t: Transacao) => t.tipo === "transferencia";
/** Origem/destino usado nos ajustes de saldo (rendimento, diferença de conferência) */
export const AJUSTE = "Ajuste de saldo";
export const ehPrevisto = (t: Transacao) => t.status === "previsto";
/** Lançamentos que já aconteceram (exclui as contas fixas ainda não pagas) */
export const efetivas = (ts: Transacao[]) => ts.filter((t) => !ehPrevisto(t));

export function resumir(ts: Transacao[], cats: MapaCategorias): Resumo {
  const r: Resumo = {
    receitas: 0,
    despesas: 0,
    aportes: 0,
    resgates: 0,
    saldo: 0,
    fixas: 0,
    variaveis: 0,
  };
  for (const t of ts) {
    if (ehPrevisto(t)) continue;
    const v = Number(t.valor) || 0;
    if (ehTransferencia(t)) {
      if (t.cartao === AJUSTE || t.conta_destino === AJUSTE) continue;
      const daInvest = ehContaInvest(t.cartao);
      const paraInvest = ehContaInvest(t.conta_destino);
      if (paraInvest && !daInvest) r.aportes += v;
      else if (daInvest && !paraInvest) r.resgates += v;
      continue;
    }
    if (ehInvestimento(t, cats)) {
      if (t.tipo === "despesa") r.aportes += v;
      else r.resgates += v;
    } else if (t.tipo === "receita") {
      r.receitas += v;
    } else {
      r.despesas += v;
      if (ehFixa(t)) r.fixas += v;
      else r.variaveis += v;
    }
  }
  r.saldo = r.receitas - r.despesas;
  return r;
}

/** Despesas de consumo já feitas (sem investimentos, transferências ou contas ainda não pagas) */
export const despesasReais = (ts: Transacao[], cats: MapaCategorias) =>
  ts.filter(
    (t) => t.tipo === "despesa" && !ehPrevisto(t) && !ehInvestimento(t, cats),
  );

export interface Fatia {
  nome: string;
  valor: number;
  cor: string;
}

export function agrupar(
  ts: Transacao[],
  chave: (t: Transacao) => string,
  cor: (nome: string) => string,
): Fatia[] {
  const m = new Map<string, number>();
  for (const t of ts) {
    const k = chave(t) || "Sem categoria";
    m.set(k, (m.get(k) || 0) + Number(t.valor));
  }
  return [...m.entries()]
    .map(([nome, valor]) => ({ nome, valor, cor: cor(nome) }))
    .sort((a, b) => b.valor - a.valor);
}

export function ultimosMeses(mesFinal: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarMeses(mesFinal, i - n + 1));
}

/** Projeção de gasto até o fim do mês corrente no ritmo atual (só gastos variáveis escalam). */
export function projecaoMes(
  ts: Transacao[],
  cats: MapaCategorias,
  mes: string,
): number | null {
  if (mes !== mesAtual()) return null;
  const hoje = hojeISO();
  const dia = Number(hoje.slice(8, 10));
  const total = diasNoMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)));
  const desp = despesasReais(doMes(ts, mes), cats);
  const fixas = desp.filter(ehFixa).reduce((a, t) => a + Number(t.valor), 0);
  const variaveisAteHoje = desp
    .filter((t) => !ehFixa(t) && t.data <= hoje)
    .reduce((a, t) => a + Number(t.valor), 0);
  const variaveisFuturas = desp
    .filter((t) => !ehFixa(t) && t.data > hoje)
    .reduce((a, t) => a + Number(t.valor), 0);
  const aPagar = doMes(ts, mes)
    .filter(
      (t) => ehPrevisto(t) && t.tipo === "despesa" && !ehInvestimento(t, cats),
    )
    .reduce((a, t) => a + Number(t.valor), 0);
  return (
    fixas +
    aPagar +
    variaveisFuturas +
    (variaveisAteHoje / Math.max(dia, 1)) * total
  );
}

// ---------------- Faturas de cartão ----------------

const pad = (n: number) => String(n).padStart(2, "0");

export const cartaoConfigurado = (c: Conta) =>
  c.tipo === "credito" && !!c.dia_fechamento && !!c.dia_vencimento;

/** Mês (YYYY-MM) em que fecha a fatura que recebe uma compra feita em `data`. */
export function referenciaFatura(data: string, conta: Conta): string {
  const dia = Number(data.slice(8, 10));
  const mes = data.slice(0, 7);
  return dia >= (conta.dia_fechamento || 1) ? somarMeses(mes, 1) : mes;
}

function diaNoMes(mes: string, dia: number) {
  const max = diasNoMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)));
  return `${mes}-${pad(Math.min(dia, max))}`;
}

export const fechamentoFatura = (ref: string, conta: Conta) =>
  diaNoMes(ref, conta.dia_fechamento || 1);

export function vencimentoFatura(ref: string, conta: Conta): string {
  const fech = conta.dia_fechamento || 1;
  const venc = conta.dia_vencimento || 10;
  return diaNoMes(venc > fech ? ref : somarMeses(ref, 1), venc);
}

export type StatusFatura = "aberta" | "fechada" | "vencida" | "paga" | "futura";

export interface Fatura {
  referencia: string;
  fechamento: string;
  vencimento: string;
  total: number;
  itens: Transacao[];
  status: StatusFatura;
  pagamento?: FaturaPaga;
}

export function faturasDoCartao(
  ts: Transacao[],
  conta: Conta,
  pagas: FaturaPaga[],
): Fatura[] {
  if (!cartaoConfigurado(conta)) return [];
  const hoje = hojeISO();
  const refAtual = referenciaFatura(hoje, conta);
  const m = new Map<string, Transacao[]>();
  for (const t of ts) {
    if (t.cartao !== conta.nome || t.tipo !== "despesa") continue;
    const ref = referenciaFatura(t.data, conta);
    if (!m.has(ref)) m.set(ref, []);
    m.get(ref)!.push(t);
  }
  if (!m.has(refAtual)) m.set(refAtual, []);
  return [...m.entries()]
    .map(([ref, itens]) => {
      const fechamento = fechamentoFatura(ref, conta);
      const vencimento = vencimentoFatura(ref, conta);
      const pagamento = pagas.find(
        (p) => p.conta === conta.nome && p.referencia === ref,
      );
      const total = itens.reduce((a, t) => a + Number(t.valor), 0);
      let status: StatusFatura;
      if (pagamento) status = "paga";
      else if (ref === refAtual) status = "aberta";
      else if (ref > refAtual) status = "futura";
      // Atraso só é destacado nos 10 dias após o vencimento; faturas antigas sem marcação contam como fechadas
      else
        status =
          hoje > vencimento && hoje <= somarDiasISO(vencimento, 10)
            ? "vencida"
            : "fechada";
      return {
        referencia: ref,
        fechamento,
        vencimento,
        total,
        itens: itens.sort((a, b) => b.data.localeCompare(a.data)),
        status,
        pagamento,
      };
    })
    .sort((a, b) => b.referencia.localeCompare(a.referencia));
}

/** A fatura que importa agora: a fechada que ainda vai vencer, senão a aberta. */
export function faturaEmFoco(faturas: Fatura[]): Fatura | undefined {
  const hoje = hojeISO();
  return (
    faturas.find((f) => f.status === "fechada" && f.vencimento >= hoje) ||
    faturas.find((f) => f.status === "aberta")
  );
}

// ---------------- Acerto do casal ----------------

export const outraPessoa = (p: Pessoa): Pessoa =>
  p === "Chamone" ? "Letícia" : "Chamone";

export interface ItemAcerto {
  transacao: Transacao;
  pagou: Pessoa;
  parteOutro: number;
}

export interface SaldoCasal {
  /** positivo = Letícia deve para Chamone; negativo = Chamone deve para Letícia */
  saldo: number;
  devedor: Pessoa | null;
  credor: Pessoa | null;
  valor: number;
  itens: ItemAcerto[];
}

export function itensDivididos(ts: Transacao[]): ItemAcerto[] {
  return ts
    .filter(
      (t) =>
        t.tipo === "despesa" &&
        !ehPrevisto(t) &&
        (t.quem === "Chamone" || t.quem === "Letícia") &&
        (t.divisao_pct ?? 0) > 0,
    )
    .map((t) => ({
      transacao: t,
      pagou: t.quem as Pessoa,
      parteOutro: (Number(t.valor) * Number(t.divisao_pct)) / 100,
    }));
}

export function saldoCasal(
  ts: Transacao[],
  acertos: Acerto[],
  ate = hojeISO(),
): SaldoCasal {
  const itens = itensDivididos(ts.filter((t) => t.data <= ate));
  let saldo = 0;
  for (const i of itens)
    saldo += i.pagou === "Chamone" ? i.parteOutro : -i.parteOutro;
  for (const a of acertos)
    saldo += a.de === "Letícia" ? -Number(a.valor) : Number(a.valor);
  saldo = Math.round(saldo * 100) / 100;
  const valor = Math.abs(saldo);
  if (valor < 0.01)
    return { saldo: 0, devedor: null, credor: null, valor: 0, itens };
  return {
    saldo,
    devedor: saldo > 0 ? "Letícia" : "Chamone",
    credor: saldo > 0 ? "Chamone" : "Letícia",
    valor,
    itens,
  };
}

/** Quanto do gasto do mês "pesa" para cada pessoa, considerando divisões e gastos "Ambos" meio a meio. */
export function custoPorPessoa(ts: Transacao[], cats: MapaCategorias) {
  const r = { Chamone: 0, Letícia: 0 } as Record<Pessoa, number>;
  for (const t of despesasReais(ts, cats)) {
    const v = Number(t.valor);
    if (t.quem === "Ambos") {
      r.Chamone += v / 2;
      r["Letícia"] += v / 2;
    } else {
      const p = (t.quem as Pessoa) || "Chamone";
      const outro = (v * (Number(t.divisao_pct) || 0)) / 100;
      r[p] += v - outro;
      r[outraPessoa(p)] += outro;
    }
  }
  return r;
}

// ---------------- Parcelamentos ----------------

export const descricaoBase = (d: string) =>
  (d || "").replace(/\s*\((\d+\/\d+|Fixo Mês \d+)\)\s*$/, "").trim();

/** Outras transações do mesmo parcelamento/recorrência (por grupo_id, ou heurística para dados antigos). */
export function irmaos(t: Transacao, todas: Transacao[]): Transacao[] {
  if (t.grupo_id)
    return todas
      .filter((x) => x.grupo_id === t.grupo_id)
      .sort((a, b) => a.data.localeCompare(b.data));
  if ((t.total_parcelas || 1) <= 1 && !/\(Fixo Mês \d+\)$/.test(t.descricao))
    return [t];
  const base = descricaoBase(t.descricao);
  return todas
    .filter(
      (x) =>
        descricaoBase(x.descricao) === base &&
        Number(x.valor) === Number(t.valor) &&
        x.cartao === t.cartao &&
        x.categoria === t.categoria &&
        (x.total_parcelas || 1) === (t.total_parcelas || 1),
    )
    .sort((a, b) => a.data.localeCompare(b.data));
}

// ---------------- Faculdade ----------------

export interface Situacao {
  media: number; // pontos já garantidos (escala 0–100)
  mediaFeitas: number; // média só das provas feitas
  pendentes: number[]; // índices (1..3) das provas sem nota
  precisaAprovar: number | null; // média necessária nas provas pendentes para 60
  precisaExame: number | null;
  status:
    "aprovado" | "exame" | "reprovado-nota" | "reprovado-faltas" | "andamento";
  riscoFaltas: boolean;
}

export function situacaoDisciplina(
  d: Disciplina,
  faltas = Number(d.faltas) || 0,
): Situacao {
  const n = Math.min(Math.max(Number(d.qtd_provas) || 2, 1), 3);
  const notas = [d.nota_p1, d.nota_p2, d.nota_p3].slice(0, n);
  const pesos = [d.peso_p1, d.peso_p2, d.peso_p3]
    .slice(0, n)
    .map((p) => Number(p) || 1);
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  let feito = 0;
  let pesoFeito = 0;
  const pendentes: number[] = [];
  notas.forEach((nota, i) => {
    if (nota === null || nota === undefined || Number.isNaN(Number(nota)))
      pendentes.push(i + 1);
    else {
      feito += Number(nota) * pesos[i];
      pesoFeito += pesos[i];
    }
  });
  const pesoPendente = somaPesos - pesoFeito;
  const media = feito / (somaPesos || 1);
  const mediaFeitas = pesoFeito ? feito / pesoFeito : 0;
  const precisa = (alvo: number) =>
    pesoPendente > 0
      ? Math.max(0, (alvo * somaPesos - feito) / pesoPendente)
      : null;
  const reprovadoFaltas = faltas > Number(d.max_faltas);
  const riscoFaltas = faltas >= Number(d.max_faltas) * 0.75;
  let status: Situacao["status"];
  if (reprovadoFaltas) status = "reprovado-faltas";
  else if (pendentes.length)
    status = media >= NOTA_APROVACAO ? "aprovado" : "andamento";
  else if (media >= NOTA_APROVACAO) status = "aprovado";
  else if (media >= NOTA_EXAME) status = "exame";
  else status = "reprovado-nota";
  return {
    media,
    mediaFeitas,
    pendentes,
    precisaAprovar: precisa(NOTA_APROVACAO),
    precisaExame: precisa(NOTA_EXAME),
    status,
    riscoFaltas,
  };
}

// ---------------- Saldos e patrimônio ----------------

/**
 * Efeito de um lançamento no saldo de uma conta. Cartão de crédito usa a mesma regra:
 * compras deixam o saldo negativo (dívida) e o pagamento da fatura (transferência) zera.
 */
export function efeitoNaConta(
  t: Transacao,
  conta: string,
  cats: MapaCategorias,
): number {
  if (ehPrevisto(t)) return 0;
  const v = Number(t.valor) || 0;
  if (ehTransferencia(t)) {
    let e = 0;
    if (t.cartao === conta) e -= v;
    if (t.conta_destino === conta) e += v;
    return e;
  }
  if (t.cartao !== conta) return 0;
  // Lançamentos antigos de aporte: "despesa" de investimento lançada na própria conta de investimento
  if (t.tipo === "despesa" && ehInvestimento(t, cats) && ehContaInvest(conta))
    return v;
  return t.tipo === "receita" ? v : -v;
}

export const temSaldo = (c: Conta) =>
  c.saldo_inicial !== null &&
  c.saldo_inicial !== undefined &&
  !!c.saldo_inicial_em;

/** Saldo da conta ao fim do dia `ate` (padrão: hoje). null = conta sem saldo inicial informado. */
export function saldoConta(
  c: Conta,
  ts: Transacao[],
  cats: MapaCategorias,
  ate = hojeISO(),
): number | null {
  if (!temSaldo(c)) return null;
  let s = Number(c.saldo_inicial) || 0;
  for (const t of ts) {
    if (t.data > c.saldo_inicial_em! && t.data <= ate)
      s += efeitoNaConta(t, c.nome, cats);
  }
  return Math.round(s * 100) / 100;
}

export function patrimonio(
  contas: Conta[],
  ts: Transacao[],
  cats: MapaCategorias,
  ate = hojeISO(),
) {
  let total = 0;
  const porTipo: Record<TipoConta, number> = {
    corrente: 0,
    credito: 0,
    beneficio: 0,
    investimento: 0,
  };
  for (const c of contas) {
    if (!c.saldo_inicial_em || c.saldo_inicial_em > ate) continue;
    const s = saldoConta(c, ts, cats, ate);
    if (s === null) continue;
    total += s;
    porTipo[c.tipo] += s;
  }
  return { total: Math.round(total * 100) / 100, porTipo };
}

// ---------------- Contas fixas (recorrências) ----------------

export function recorrenciaNoMes(r: Recorrencia, mes: string): boolean {
  return r.ativo && r.inicio <= mes && (!r.fim || r.fim >= mes);
}

export function dataNoMes(mes: string, dia: number): string {
  const max = diasNoMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)));
  return `${mes}-${pad(Math.min(Math.max(dia, 1), max))}`;
}

/** Lançamentos que faltam gerar (mês atual e o próximo) para as contas fixas ativas. */
export function previstosFaltando(
  recs: Recorrencia[],
  ts: Transacao[],
  contas: Conta[],
  hoje = hojeISO(),
) {
  const existentes = new Set(
    ts
      .filter((t) => t.recorrencia_id)
      .map((t) => `${t.recorrencia_id}|${t.competencia}`),
  );
  const meses = [hoje.slice(0, 7), somarMeses(hoje.slice(0, 7), 1)];
  const novas: Record<string, unknown>[] = [];
  for (const r of recs) {
    for (const m of meses) {
      if (!recorrenciaNoMes(r, m) || existentes.has(`${r.id}|${m}`) || (r.pulados || []).includes(m)) continue;
      const conta = contas.find((c) => c.nome === r.cartao);
      // Cartão e vale debitam sozinhos; conta corrente e receitas esperam confirmação
      const automatico =
        r.tipo === "despesa" &&
        (conta?.tipo === "credito" || conta?.tipo === "beneficio");
      novas.push({
        descricao: r.descricao,
        valor: r.valor,
        tipo: r.tipo,
        categoria: r.categoria,
        cartao: r.cartao,
        quem: r.quem,
        divisao_pct: r.divisao_pct,
        tipo_gasto: "Fixo",
        data: dataNoMes(m, r.dia),
        parcela_atual: 1,
        total_parcelas: 1,
        recorrencia_id: r.id,
        competencia: m,
        status: automatico ? "pago" : "previsto",
      });
    }
  }
  return novas;
}

// ---------------- Presença ----------------

/** Faltas de uma disciplina: marcadas por aula quando existem, senão o número digitado. */
export function faltasDaDisciplina(
  d: Disciplina,
  presencas: Presenca[],
): { faltas: number; porAula: boolean } {
  const minhas = presencas.filter((p) => p.disciplina_id === d.id);
  if (!minhas.length) return { faltas: Number(d.faltas) || 0, porAula: false };
  return {
    faltas: minhas
      .filter((p) => !p.presente)
      .reduce((a, p) => a + (Number(p.peso) || 1), 0),
    porAula: true,
  };
}

export const aulasDoDia = (aulas: Aula[], data: string) => {
  const dow = new Date(`${data}T12:00:00`).getDay();
  return aulas
    .filter((a) => a.dia_semana === dow)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
};

export const diasAte = (data: string) => diffDias(hojeISO(), data);

/** Provas com data marcada e nota ainda em branco */
export function provasMarcadas(
  ds: Disciplina[],
): { data: string; titulo: string; quem: Pessoa; disciplina: Disciplina }[] {
  const r: {
    data: string;
    titulo: string;
    quem: Pessoa;
    disciplina: Disciplina;
  }[] = [];
  for (const d of ds) {
    const n = Math.min(Math.max(Number(d.qtd_provas) || 2, 1), 3);
    const provas: [string | null | undefined, number | null][] = [
      [d.data_p1, d.nota_p1],
      [d.data_p2, d.nota_p2],
      [d.data_p3, d.nota_p3],
    ];
    provas.slice(0, n).forEach(([data, nota], i) => {
      if (data && (nota === null || nota === undefined))
        r.push({
          data,
          titulo: `P${i + 1} de ${d.nome}`,
          quem: (d.aluno || "Chamone") as Pessoa,
          disciplina: d,
        });
    });
  }
  return r;
}
