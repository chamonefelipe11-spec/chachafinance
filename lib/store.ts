"use client";

import { useCallback, useState } from "react";
import { supabase } from "./supabase";
import { CATEGORIAS_PADRAO, CONTAS_PADRAO } from "./defaults";
import type {
  Acerto,
  Aula,
  Card,
  Categoria,
  ColunaQuadro,
  Conta,
  Disciplina,
  Evento,
  FaturaPaga,
  Importacao,
  Meta,
  Presenca,
  Recorrencia,
  Regra,
  Transacao,
} from "./types";
import { avisar } from "./toast";

export interface Dados {
  transacoes: Transacao[];
  contas: Conta[];
  categorias: Categoria[];
  metas: Meta[];
  acertos: Acerto[];
  faturasPagas: FaturaPaga[];
  disciplinas: Disciplina[];
  eventos: Evento[];
  recorrencias: Recorrencia[];
  regras: Regra[];
  importacoes: Importacao[];
  aulas: Aula[];
  presencas: Presenca[];
  colunasQuadro: ColunaQuadro[];
  cards: Card[];
}

const VAZIO: Dados = {
  transacoes: [],
  contas: CONTAS_PADRAO,
  categorias: CATEGORIAS_PADRAO,
  metas: [],
  acertos: [],
  faturasPagas: [],
  disciplinas: [],
  eventos: [],
  recorrencias: [],
  regras: [],
  importacoes: [],
  aulas: [],
  presencas: [],
  colunasQuadro: [],
  cards: [],
};

const num = (v: unknown) =>
  v === null || v === undefined || v === "" ? null : Number(v);

function normalizarTransacao(t: Record<string, unknown>): Transacao {
  const tipo =
    t.tipo === "receita" || t.tipo === "transferencia" ? t.tipo : "despesa";
  return {
    ...(t as unknown as Transacao),
    id: String(t.id),
    valor: Number(t.valor) || 0,
    descricao:
      (t.descricao as string) || (t.categoria as string) || "Sem descrição",
    categoria:
      (t.categoria as string) ||
      (tipo === "transferencia" ? "Transferência" : "Outros"),
    cartao: (t.cartao as string) || "Conta Corrente / Pix",
    quem: ((t.quem as string) || "Ambos") as Transacao["quem"],
    tipo,
    tipo_gasto: (t.tipo_gasto as string) || "Variável",
    parcela_atual: num(t.parcela_atual),
    total_parcelas: num(t.total_parcelas),
    divisao_pct: num(t.divisao_pct),
    status: t.status === "previsto" ? "previsto" : "pago",
  };
}

function normalizarCard(c: Card): Card {
  return {
    ...c,
    id: String(c.id),
    coluna_id: String(c.coluna_id),
    quem: (c.quem || "Ambos") as Card["quem"],
    ordem: Number(c.ordem) || 0,
    inicio: c.inicio ? String(c.inicio).slice(0, 10) : null,
    prazo: c.prazo ? String(c.prazo).slice(0, 10) : null,
    orcamento: num(c.orcamento),
    checklist: Array.isArray(c.checklist) ? c.checklist : [],
  };
}

/** Todas as tabelas que vieram depois da v1 (criadas pelos arquivos em supabase/). */
export const TABELAS_NOVAS = [
  "contas",
  "categorias",
  "metas",
  "acertos",
  "faturas_pagas",
  "recorrencias",
  "regras",
  "importacoes",
  "aulas",
  "presencas",
  "quadro_colunas",
  "cards",
] as const;

/** Tabelas do quadro de projetos (supabase/projetos.sql) */
export const TABELAS_PROJETOS = ["quadro_colunas", "cards"];

/** Lê a tabela inteira, de 1000 em 1000 (o Supabase devolve no máximo 1000 linhas por pedido). */
export async function lerTudo<T>(
  tabela: string,
  ordem?: { coluna: string; crescente?: boolean },
): Promise<{ data: T[]; error: { message: string } | null }> {
  const todos: T[] = [];
  const passo = 1000;
  for (let de = 0; de < 200_000; de += passo) {
    let q = supabase.from(tabela).select("*");
    if (ordem)
      q = q.order(ordem.coluna, { ascending: ordem.crescente ?? true });
    q = q.order("id", { ascending: true }).range(de, de + passo - 1);
    const { data, error } = await q;
    if (error) return { data: todos, error };
    todos.push(...((data as T[]) || []));
    if (!data || data.length < passo) break;
  }
  return { data: todos, error: null };
}

export function useDados() {
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [faltando, setFaltando] = useState<string[]>([]);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    const [
      fin,
      disc,
      ag,
      contas,
      cats,
      metas,
      acertos,
      pagas,
      recs,
      regras,
      imps,
      aulas,
      pres,
      cols,
      cards,
    ] = await Promise.all([
      lerTudo<Record<string, unknown>>("financas", {
        coluna: "data",
        crescente: false,
      }),
      lerTudo<Disciplina>("disciplinas", {
        coluna: "created_at",
        crescente: false,
      }),
      lerTudo<Evento>("agenda", { coluna: "data" }),
      lerTudo<Conta>("contas", { coluna: "ordem" }),
      lerTudo<Categoria>("categorias", { coluna: "ordem" }),
      lerTudo<Meta>("metas", { coluna: "created_at" }),
      lerTudo<Acerto>("acertos", { coluna: "data", crescente: false }),
      lerTudo<FaturaPaga>("faturas_pagas"),
      lerTudo<Recorrencia>("recorrencias", { coluna: "dia" }),
      lerTudo<Regra>("regras", { coluna: "ordem" }),
      lerTudo<Importacao>("importacoes", {
        coluna: "created_at",
        crescente: false,
      }),
      lerTudo<Aula>("aulas", { coluna: "dia_semana" }),
      lerTudo<Presenca>("presencas", { coluna: "data", crescente: false }),
      lerTudo<ColunaQuadro>("quadro_colunas", { coluna: "ordem" }),
      lerTudo<Card>("cards", { coluna: "ordem" }),
    ]);

    const falta: string[] = [];
    const opcional = <T>(
      nome: string,
      r: { data: T[]; error: unknown },
      padrao: T[] = [],
    ): T[] => {
      if (r.error) {
        falta.push(nome);
        return padrao;
      }
      return r.data.length ? r.data : padrao;
    };

    if (fin.error)
      avisar(`Não consegui ler os lançamentos: ${fin.error.message}`, "erro");
    const id = <T extends { id: unknown }>(x: T) => ({
      ...x,
      id: String(x.id),
    });

    setDados({
      transacoes: fin.data
        .map(normalizarTransacao)
        .sort((a, b) => b.data.localeCompare(a.data)),
      disciplinas: disc.data.map(id),
      eventos: ag.data.map(id),
      contas: opcional("contas", contas, CONTAS_PADRAO).map((c) => ({
        ...id(c),
        limite: num(c.limite),
        saldo_inicial: num(c.saldo_inicial),
      })),
      categorias: opcional("categorias", cats, CATEGORIAS_PADRAO).map((c) => ({
        ...id(c),
        orcamento: num(c.orcamento),
      })),
      metas: opcional("metas", metas).map((m) => ({
        ...id(m),
        valor_alvo: Number(m.valor_alvo),
        valor_atual: Number(m.valor_atual),
      })),
      acertos: opcional("acertos", acertos).map((a) => ({
        ...id(a),
        valor: Number(a.valor),
      })),
      faturasPagas: opcional("faturas_pagas", pagas).map((p) => ({
        ...id(p),
        valor: Number(p.valor),
      })),
      recorrencias: opcional("recorrencias", recs).map((r) => ({
        ...id(r),
        valor: Number(r.valor),
        divisao_pct: num(r.divisao_pct),
        dia: Number(r.dia),
      })),
      regras: opcional("regras", regras).map((r) => ({
        ...id(r),
        divisao_pct: num(r.divisao_pct),
      })),
      importacoes: opcional("importacoes", imps)
        .map(id)
        .sort((a, b) =>
          String(b.created_at).localeCompare(String(a.created_at)),
        ),
      aulas: opcional("aulas", aulas).map((a) => ({
        ...id(a),
        disciplina_id: String(a.disciplina_id),
        dia_semana: Number(a.dia_semana),
        peso: Number(a.peso) || 1,
      })),
      presencas: opcional("presencas", pres).map((p) => ({
        ...id(p),
        disciplina_id: String(p.disciplina_id),
        peso: Number(p.peso) || 1,
      })),
      colunasQuadro: opcional("quadro_colunas", cols).map((c) => ({
        ...id(c),
        ordem: Number(c.ordem) || 0,
        concluida: !!c.concluida,
      })),
      cards: opcional("cards", cards).map(normalizarCard),
    });
    setFaltando(falta);
    setCarregando(false);
  }, []);

  const limpar = useCallback(() => setDados(VAZIO), []);

  return { dados, carregando, faltando, carregar, limpar };
}

// ---------------- Escrita ----------------

type Linha = Record<string, unknown>;

/** Nome da coluna que o Supabase diz não existir (banco ainda sem a migração mais nova). */
function colunaInexistente(msg: string): string | null {
  const m =
    msg.match(/Could not find the '([^']+)' column/i) ||
    msg.match(/column "?([a-z_]+)"? of relation .* does not exist/i);
  return m ? m[1] : null;
}
const erroDeTabela = (msg: string) =>
  /relation .* does not exist|Could not find the table/i.test(msg);

function tratarErro(tabela: string, msg: string) {
  if (erroDeTabela(msg))
    avisar(
      `A tabela "${tabela}" ainda não existe. Rode o SQL mais novo da pasta supabase/ no Supabase.`,
      "erro",
    );
  else if (/value too long for type character varying/i.test(msg))
    avisar(
      'O banco limita o tamanho desse campo. Rode supabase/correcao-tamanho.sql no SQL Editor do Supabase e tente de novo.',
      "erro",
    );
  else avisar(`Não foi possível salvar: ${msg}`, "erro");
}

const semColuna = (linhas: Linha[], col: string) =>
  linhas.map((l) => {
    const c = { ...l };
    delete c[col];
    return c;
  });

/** Repete a operação removendo colunas que o banco ainda não tem (até 6 vezes). */
async function tentar(
  tabela: string,
  linhas: Linha[],
  fazer: (l: Linha[]) => PromiseLike<{ error: { message: string } | null }>,
): Promise<boolean> {
  let atual = linhas;
  const tiradas: string[] = [];
  for (let i = 0; i < 6; i++) {
    const { error } = await fazer(atual);
    if (!error) {
      if (tiradas.length)
        avisar(
          `Salvo sem ${tiradas.join(", ")}: rode o SQL mais novo no Supabase para usar tudo.`,
          "aviso",
        );
      return true;
    }
    const col = colunaInexistente(error.message);
    if (!col || !atual.some((l) => col in l)) {
      tratarErro(tabela, error.message);
      return false;
    }
    tiradas.push(col);
    atual = semColuna(atual, col);
  }
  return false;
}

export const db = {
  inserir(tabela: string, linhas: Linha | Linha[]): Promise<boolean> {
    const lista = Array.isArray(linhas) ? linhas : [linhas];
    return tentar(tabela, lista, (l) => supabase.from(tabela).insert(l));
  },

  /** Insere e devolve as linhas criadas (com id). */
  async inserirDevolvendo<T>(
    tabela: string,
    linhas: Linha | Linha[],
  ): Promise<T[] | null> {
    const lista = Array.isArray(linhas) ? linhas : [linhas];
    let criadas: T[] | null = null;
    const ok = await tentar(tabela, lista, async (l) => {
      const r = await supabase.from(tabela).insert(l).select();
      criadas = (r.data as T[]) || null;
      return r;
    });
    return ok ? criadas || [] : null;
  },

  upsert(tabela: string, linhas: Linha[], onConflict = "id"): Promise<boolean> {
    return tentar(tabela, linhas, (l) =>
      supabase.from(tabela).upsert(l, { onConflict }),
    );
  },

  atualizar(
    tabela: string,
    ids: string | string[],
    valores: Linha,
  ): Promise<boolean> {
    const lista = Array.isArray(ids) ? ids : [ids];
    return tentar(tabela, [valores], (l) =>
      supabase.from(tabela).update(l[0]).in("id", lista),
    );
  },

  /** `opcional`: tabela/coluna que pode ainda não existir no banco (aí não é erro). */
  async atualizarOnde(
    tabela: string,
    coluna: string,
    valorAtual: string,
    valores: Linha,
    opcional = false,
  ): Promise<boolean> {
    const { error } = await supabase
      .from(tabela)
      .update(valores)
      .eq(coluna, valorAtual);
    if (error && opcional && (erroDeTabela(error.message) || colunaInexistente(error.message) || /column .* does not exist/i.test(error.message)))
      return true;
    if (error) tratarErro(tabela, error.message);
    return !error;
  },

  async remover(tabela: string, ids: string | string[]): Promise<boolean> {
    const lista = Array.isArray(ids) ? ids : [ids];
    for (let i = 0; i < lista.length; i += 200) {
      const { error } = await supabase
        .from(tabela)
        .delete()
        .in("id", lista.slice(i, i + 200));
      if (error) {
        tratarErro(tabela, error.message);
        return false;
      }
    }
    return true;
  },
};
