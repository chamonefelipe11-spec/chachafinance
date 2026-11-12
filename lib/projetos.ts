// Quadro de projetos: etiquetas, prazos, ordem dos cards e gasto ligado a uma categoria.
import type { Card, ColunaQuadro, Transacao } from "./types";
import type { MapaCategorias } from "./finance";
import { despesasReais } from "./finance";
import { diffDias, somarDiasISO } from "./format";

export const ETIQUETAS_PADRAO: { nome: string; cor: string }[] = [
  { nome: "Casa", cor: "#C9A27E" },
  { nome: "Faculdade", cor: "#8E9BF5" },
  { nome: "Trabalho", cor: "#5FC4D0" },
  { nome: "Viagem", cor: "#6CCB9F" },
  { nome: "Finanças", cor: "#E3B860" },
  { nome: "Saúde", cor: "#EE93BD" },
  { nome: "Pessoal", cor: "#A891F0" },
];

const CORES_EXTRA = ["#F2A65A", "#7FB2FF", "#B5E07A", "#E0848F", "#D79BE8", "#9FD8C4"];

export function corEtiqueta(nome: string | null | undefined): string {
  if (!nome) return "#8F96A3";
  const p = ETIQUETAS_PADRAO.find((e) => e.nome.toLowerCase() === nome.toLowerCase());
  if (p) return p.cor;
  let h = 0;
  for (const ch of nome.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES_EXTRA[h % CORES_EXTRA.length];
}

/** Etiquetas em uso + as padrão, sem repetir. */
export function etiquetasDisponiveis(cards: Card[]): string[] {
  const nomes = new Map<string, string>();
  for (const e of ETIQUETAS_PADRAO) nomes.set(e.nome.toLowerCase(), e.nome);
  for (const c of cards) if (c.etiqueta && !nomes.has(c.etiqueta.toLowerCase())) nomes.set(c.etiqueta.toLowerCase(), c.etiqueta);
  return [...nomes.values()];
}

export const progresso = (c: Card) => ({
  feitos: c.checklist.filter((i) => i.feito).length,
  total: c.checklist.length,
});

export type SituacaoPrazo = "feito" | "atrasado" | "hoje" | "breve" | "ok" | null;

export function cardFeito(c: Card, colunas: ColunaQuadro[]): boolean {
  return !!colunas.find((k) => k.id === c.coluna_id)?.concluida;
}

/** Como está o prazo do card hoje. "breve" = vence em até 3 dias. */
export function situacaoPrazo(c: Card, feito: boolean, hoje: string): SituacaoPrazo {
  if (feito) return "feito";
  if (!c.prazo) return null;
  const d = diffDias(hoje, c.prazo);
  if (d < 0) return "atrasado";
  if (d === 0) return "hoje";
  if (d <= 3) return "breve";
  return "ok";
}

export const COR_SITUACAO: Record<Exclude<SituacaoPrazo, null>, string> = {
  feito: "#7ddba3",
  atrasado: "#f08a7e",
  hoje: "#e9b65c",
  breve: "#e9b65c",
  ok: "#a1a7b3",
};

/** Valor de `ordem` para um card colocado entre dois vizinhos. */
export function ordemEntre(antes?: number, depois?: number): number {
  if (antes === undefined && depois === undefined) return 1000;
  if (antes === undefined) return depois! - 1000;
  if (depois === undefined) return antes + 1000;
  return (antes + depois) / 2;
}

export const cardsDaColuna = (cards: Card[], colunaId: string) =>
  cards.filter((c) => c.coluna_id === colunaId).sort((a, b) => a.ordem - b.ordem);

/** Quanto já foi gasto na categoria ligada ao card, do início (ou da criação) até a conclusão. */
export function gastoDoCard(c: Card, transacoes: Transacao[], cats: MapaCategorias): number | null {
  if (!c.categoria) return null;
  const de = c.inicio || c.created_at?.slice(0, 10) || "0000-00-00";
  const ate = c.concluido_em?.slice(0, 10) || "9999-12-31";
  return despesasReais(transacoes, cats)
    .filter((t) => t.categoria === c.categoria && t.data >= de && t.data <= ate)
    .reduce((a, t) => a + t.valor, 0);
}

/** Início e fim da barra no Gantt (um card só com prazo vira um dia). */
export function intervaloCard(c: Card): { de: string; ate: string } | null {
  const de = c.inicio || c.prazo;
  const ate = c.prazo || c.inicio;
  if (!de || !ate) return null;
  return de <= ate ? { de, ate } : { de: ate, ate: de };
}

/** Move as datas do card: modo "mover" desloca as duas; "inicio"/"fim" esticam uma ponta. */
export function moverDatas(
  c: Card,
  modo: "mover" | "inicio" | "fim",
  dias: number,
): { inicio: string | null; prazo: string | null } {
  const iv = intervaloCard(c);
  if (!iv || !dias) return { inicio: c.inicio, prazo: c.prazo };
  if (modo === "mover")
    return {
      inicio: c.inicio ? somarDiasISO(c.inicio, dias) : null,
      prazo: c.prazo ? somarDiasISO(c.prazo, dias) : null,
    };
  if (modo === "inicio") {
    const novo = somarDiasISO(iv.de, dias);
    return { inicio: novo > iv.ate ? iv.ate : novo, prazo: c.prazo ?? iv.ate };
  }
  const novo = somarDiasISO(iv.ate, dias);
  return { inicio: c.inicio ?? iv.de, prazo: novo < iv.de ? iv.de : novo };
}
