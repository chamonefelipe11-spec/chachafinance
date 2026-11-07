const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const brlCompacto = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

// "Ocultar valores": quando ligado, todo valor em reais vira bolinhas
let ocultar = false;
export const definirOcultar = (v: boolean) => {
  ocultar = v;
};
export const valoresOcultos = () => ocultar;
const OCULTO = "R$ ••••";

export const dinheiro = (v: number) =>
  ocultar ? OCULTO : brl.format(Number.isFinite(v) ? v : 0);
/** "R$ 1.234" sem centavos, para eixos e textos curtos */
export const dinheiroCurto = (v: number) =>
  ocultar ? OCULTO : `R$ ${brlCompacto.format(Math.round(v))}`;

/** Converte "1.234,56", "1234.56" ou "12,5" em número. */
export function lerValor(txt: string): number {
  const limpo = String(txt)
    .trim()
    .replace(/[^\d,.-]/g, "");
  if (!limpo) return NaN;
  if (limpo.includes(","))
    return parseFloat(limpo.replace(/\./g, "").replace(",", "."));
  return parseFloat(limpo);
}

export const valorParaCampo = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? ""
    : String(v).replace(".", ",");

// ---------- Datas (sempre no fuso local, nunca via toISOString) ----------

const pad = (n: number) => String(n).padStart(2, "0");

export const isoDeData = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hojeISO = () => isoDeData(new Date());
export const mesAtual = () => hojeISO().slice(0, 7);

export function dataDeISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

export const diasNoMes = (ano: number, mes1a12: number) =>
  new Date(ano, mes1a12, 0).getDate();

/** Soma meses mantendo o dia, mas sem "pular" mês (31/01 + 1 → 28/02). */
export function somarMesesISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, diasNoMes(ny, nm)))}`;
}

export function somarMeses(mes: string, n: number): string {
  return somarMesesISO(`${mes}-01`, n).slice(0, 7);
}

export function somarDiasISO(iso: string, n: number): string {
  const d = dataDeISO(iso);
  d.setDate(d.getDate() + n);
  return isoDeData(d);
}

export const diffDias = (a: string, b: string) =>
  Math.round((dataDeISO(b).getTime() - dataDeISO(a).getTime()) / 86_400_000);

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const DIAS_SEMANA = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

export const nomeMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1];
export const nomeMesCurto = (mes: string) =>
  MESES_CURTOS[Number(mes.slice(5, 7)) - 1];
export const rotuloMes = (mes: string) => `${nomeMes(mes)} ${mes.slice(0, 4)}`;
export const rotuloMesCurto = (mes: string) =>
  `${nomeMesCurto(mes)}/${mes.slice(2, 4)}`;

export const dataCurta = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const dataBR = (iso: string) => iso.split("-").reverse().join("/");

export function dataAmigavel(iso: string): string {
  const hoje = hojeISO();
  const diff = diffDias(hoje, iso);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  const d = dataDeISO(iso);
  const base = `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES_CURTOS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear()
    ? base
    : `${base} de ${d.getFullYear()}`;
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function gerarId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
