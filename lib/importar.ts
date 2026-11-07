// Leitura de extratos (CSV/OFX) e preparação das linhas para a tela de revisão.
import type { Conta, Quem, Regra, Transacao } from "./types";
import { descricaoBase } from "./finance";
import { diffDias } from "./format";

export type TipoLinha = "despesa" | "receita" | "transferencia";

export interface LinhaBruta {
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number; // com sinal: negativo = saída da conta
  parcela?: { atual: number; total: number } | null;
}

export interface LinhaImport {
  chave: string;
  incluir: boolean;
  data: string;
  descricao: string;
  valor: number; // sempre positivo
  tipo: TipoLinha;
  categoria: string;
  quem: Quem;
  divisao_pct: number | null;
  conta_destino: string | null;
  /** Só em resgates: a transferência sai da conta de investimento */
  conta_origem: string | null;
  parcela: { atual: number; total: number } | null;
  hash: string;
  aviso: string | null; // "já existe", "regra: ifood" etc.
  origemRegra: string | null;
}

// ---------------- Utilidades de texto e números ----------------

export const normalizar = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Descrição sem números de parcela, datas e códigos, para comparar e criar regras. */
export const chaveDescricao = (s: string) =>
  normalizar(descricaoBase(s))
    .replace(/\b(parc(ela)?\.?\s*)?\d{1,2}\s*\/\s*\d{1,2}\b/g, "")
    .replace(/\d{2,}/g, "")
    .replace(/[*#\-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function lerNumero(txt: string): number {
  let t = String(txt)
    .trim()
    .replace(/[R$\s]/g, "");
  const negativo = /^\(.*\)$/.test(t) || t.startsWith("-") || t.endsWith("-");
  t = t.replace(/[()+-]/g, "");
  if (t.includes(",") && t.lastIndexOf(",") > t.lastIndexOf("."))
    t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const n = parseFloat(t);
  return Number.isFinite(n) ? (negativo ? -n : n) : NaN;
}

export function lerData(
  txt: string,
  anoPadrao = new Date().getFullYear(),
): string | null {
  const t = String(txt).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
  if (m) {
    const ano = m[3]
      ? m[3].length === 2
        ? 2000 + Number(m[3])
        : Number(m[3])
      : anoPadrao;
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export function lerParcela(
  desc: string,
): { atual: number; total: number } | null {
  const m = desc.match(
    /(?:parc(?:ela)?\.?\s*)?\b(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i,
  );
  if (!m) return null;
  const atual = Number(m[1]);
  const total = Number(m[2]);
  return total > 1 && atual >= 1 && atual <= total && total <= 48
    ? { atual, total }
    : null;
}

// ---------------- OFX ----------------

export function lerOFX(texto: string): LinhaBruta[] {
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const campo = (b: string, nome: string) =>
    b.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() || "";
  return blocos
    .map((b) => {
      const descricao = [campo(b, "NAME"), campo(b, "MEMO")]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(" — ");
      return {
        data: lerData(campo(b, "DTPOSTED")) || "",
        descricao: descricao || "Sem descrição",
        valor: lerNumero(campo(b, "TRNAMT")),
        parcela: lerParcela(descricao),
      };
    })
    .filter((l) => l.data && Number.isFinite(l.valor) && l.valor !== 0);
}

// ---------------- CSV ----------------

function separarCSV(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else aspas = !aspas;
    } else if (c === sep && !aspas) {
      out.push(atual);
      atual = "";
    } else atual += c;
  }
  out.push(atual);
  return out.map((s) => s.trim());
}

export function lerCSV(texto: string): LinhaBruta[] {
  const linhas = texto
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (linhas.length < 2) return [];
  // Cabeçalho: a primeira linha que tenha "data"/"date"
  const iCab = Math.max(
    0,
    linhas.findIndex((l) => /data|date/i.test(l)),
  );
  const cab = linhas[iCab];
  const sep =
    (cab.match(/;/g) || []).length > (cab.match(/,/g) || []).length
      ? ";"
      : cab.includes("\t")
        ? "\t"
        : ",";
  const nomes = separarCSV(cab, sep).map(normalizar);
  const achar = (...padroes: RegExp[]) =>
    nomes.findIndex((n) => padroes.some((p) => p.test(n)));
  const iData = achar(/^data|^date|lancamento/);
  const iDesc = achar(
    /descri|title|titulo|historico|estabelecimento|memo|lancamento$|identificacao/,
  );
  const iValor = achar(/^valor|amount|quantia|^value/);
  if (iData < 0 || iValor < 0) return [];
  return linhas
    .slice(iCab + 1)
    .map((l) => {
      const c = separarCSV(l, sep);
      const desc =
        (iDesc >= 0 ? c[iDesc] : "") ||
        c.filter((_, i) => i !== iData && i !== iValor).join(" ");
      return {
        data: lerData(c[iData] || "") || "",
        descricao: desc || "Sem descrição",
        valor: lerNumero(c[iValor] || ""),
        parcela: lerParcela(desc),
      };
    })
    .filter((l) => l.data && Number.isFinite(l.valor) && l.valor !== 0);
}

// ---------------- Classificação ----------------

const PALAVRAS: [RegExp, string][] = [
  [
    /ifood|rappi|ze delivery|mc ?donald|burger|bk |pizza|lanche|outback|starbucks/,
    "FastFood / iFood",
  ],
  [
    /mercad|supermerc|epa|verdemar|carrefour|assai|atacad|bh super|sacolao|padaria|hortifruti|dia /,
    "Alimentação / Mercado",
  ],
  [
    /uber|99 ?(app|pop|taxi)?|taxi|posto|ipiranga|shell|br mania|combust|estacion|sem parar|veloe|metro|onibus|bhbus/,
    "Transporte / Uber",
  ],
  [
    /netflix|spotify|prime video|amazon prime|disney|hbo|max\b|youtube|apple\.com|icloud|google (one|storage)|deezer|globoplay|chatgpt|openai|claude|anthropic/,
    "Assinaturas / Streaming",
  ],
  [
    /farmac|drogaria|araujo|pacheco|raia|drogasil|hospital|clinica|laborat|unimed|consulta/,
    "Saúde / Farmácia",
  ],
  [
    /aluguel|condominio|cemig|copasa|energia|agua|gas\b|internet|vivo|claro|tim\b|oi fibra/,
    "Moradia / Aluguel",
  ],
  [
    /cinema|ingresso|show|bar |restaurante|cerveja|lazer|steam|playstation|xbox|nintendo/,
    "Lazer / Passeio",
  ],
  [/cefet|faculdade|curso|udemy|alura|livraria|livro/, "Educação / EAD"],
  [
    /renner|riachuelo|c&a|zara|shein|shopee|salao|barbearia|cabelo|perfum|boticario|natura/,
    "Roupas / Beleza",
  ],
  [
    /salario|pagamento de salario|folha|proventos|vencimento/,
    "Salário / Renda",
  ],
  [/reembolso|estorno|cashback/, "Reembolso"],
];

const PAGAMENTO_FATURA =
  /pagamento (de )?fatura|pgto fatura|pagto cartao|pagamento cartao|fatura (do )?cartao/;
const PAGAMENTO_RECEBIDO =
  /pagamento recebido|pagamento efetuado|credito de pagamento/;
const APLICACAO =
  /aplicac|aplic\.|investimento|cdb|tesouro|xp invest|resgate|rdb|caixinha/;

export interface Contexto {
  conta: Conta;
  contas: Conta[];
  regras: Regra[];
  transacoes: Transacao[];
  pessoaPadrao: Quem;
}

/** Transforma as linhas lidas em sugestões prontas para revisão. */
export function prepararLinhas(
  brutas: LinhaBruta[],
  ctx: Contexto,
): LinhaImport[] {
  const { conta, contas, regras, transacoes } = ctx;
  const credito = conta.tipo === "credito";
  // No cartão, a maioria das linhas é compra: descobre se o arquivo usa positivo ou negativo para compra
  const positivos = brutas.filter((b) => b.valor > 0).length;
  const compraPositiva = credito && positivos >= brutas.length / 2;

  const hashesExistentes = new Set(
    transacoes.map((t) => t.import_hash).filter(Boolean) as string[],
  );
  const daConta = transacoes.filter(
    (t) => t.cartao === conta.nome || t.conta_destino === conta.nome,
  );
  const historico = new Map<string, Transacao>();
  for (const t of [...transacoes].sort((a, b) => a.data.localeCompare(b.data)))
    historico.set(chaveDescricao(t.descricao), t);
  const cartaoPadrao =
    contas.find((c) => c.tipo === "credito" && c.ativo)?.nome || null;
  const investPadrao =
    contas.find((c) => c.tipo === "investimento" && c.ativo)?.nome || null;

  return brutas.map((b, i) => {
    const saida = credito
      ? compraPositiva
        ? b.valor > 0
        : b.valor < 0
      : b.valor < 0;
    const valor = Math.round(Math.abs(b.valor) * 100) / 100;
    const n = normalizar(b.descricao);
    const ch = chaveDescricao(b.descricao);
    const hash = `${conta.nome}|${b.data}|${valor.toFixed(2)}|${ch}`;

    let tipo: TipoLinha = saida ? "despesa" : "receita";
    let categoria = saida ? "Outros" : "Salário / Renda";
    let quem: Quem = ctx.pessoaPadrao;
    let divisao: number | null = null;
    let destino: string | null = null;
    let origem: string | null = null;
    let incluir = true;
    let aviso: string | null = null;
    let origemRegra: string | null = null;

    // 1) Pagamentos e investimentos viram transferência
    if (credito && !saida && PAGAMENTO_RECEBIDO.test(n)) {
      incluir = false;
      aviso = "Pagamento da fatura: já entra pelo extrato da conta";
    } else if (!credito && saida && PAGAMENTO_FATURA.test(n)) {
      tipo = "transferencia";
      destino =
        contas.find(
          (c) =>
            c.tipo === "credito" &&
            n.includes(normalizar(c.nome.replace(/^cart[aã]o\s+/i, ""))),
        )?.nome || cartaoPadrao;
    } else if (
      !credito &&
      APLICACAO.test(n) &&
      investPadrao &&
      conta.tipo !== "investimento"
    ) {
      tipo = "transferencia";
      if (saida) destino = investPadrao;
      else {
        origem = investPadrao;
        destino = conta.nome;
      }
    }

    // 2) O mesmo lançamento já existe? (importado antes ou digitado à mão)
    if (hashesExistentes.has(hash)) {
      incluir = false;
      aviso = "Já importado antes";
    } else {
      const parecido = daConta.find(
        (t) =>
          Math.abs(t.valor - valor) < 0.01 &&
          Math.abs(diffDias(t.data, b.data)) <= 3 &&
          (!b.parcela ||
            (t.parcela_atual === b.parcela.atual &&
              t.total_parcelas === b.parcela.total)),
      );
      if (parecido) {
        incluir = false;
        aviso = `Parece já lançado: “${parecido.descricao}”`;
      }
    }

    // 3) Categoria: regra > mesmo nome já usado > palavras conhecidas
    if (tipo !== "transferencia") {
      const regra = regras.find(
        (r) => r.contem && n.includes(normalizar(r.contem)),
      );
      const anterior = historico.get(ch);
      if (regra) {
        origemRegra = regra.contem;
        if (regra.ignorar) {
          incluir = false;
          aviso = `Regra: ignorar “${regra.contem}”`;
        }
        if (regra.transferir_para) {
          tipo = "transferencia";
          if (saida) destino = regra.transferir_para;
          else {
            origem = regra.transferir_para;
            destino = conta.nome;
          }
        }
        if (regra.categoria) categoria = regra.categoria;
        if (regra.quem) quem = regra.quem;
        if (regra.divisao_pct) divisao = regra.divisao_pct;
      } else if (anterior && anterior.tipo !== "transferencia") {
        categoria = anterior.categoria;
        quem = anterior.quem;
        divisao = anterior.divisao_pct ?? null;
      } else {
        const achou = PALAVRAS.find(([re]) => re.test(n));
        if (achou && (saida ? achou[1] !== "Salário / Renda" : true))
          categoria = achou[1];
        if (!saida && !achou) categoria = "Reembolso";
      }
    }

    return {
      chave: `${i}-${hash}`,
      incluir,
      data: b.data,
      descricao: b.descricao.replace(/\s+/g, " ").trim(),
      valor,
      tipo,
      categoria: tipo === "transferencia" ? "Transferência" : categoria,
      quem,
      divisao_pct: divisao,
      conta_destino: destino,
      conta_origem: origem,
      parcela: b.parcela || null,
      hash,
      aviso,
      origemRegra,
    };
  });
}

// ---------------- Imagens: reduzir antes de enviar ----------------

export async function reduzirImagem(
  arquivo: File,
  maxLado = 1800,
): Promise<{ base64: string; tipo: string }> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: url.split(",")[1], tipo: "image/jpeg" };
}

export async function lerBase64(arquivo: File): Promise<string> {
  const buf = new Uint8Array(await arquivo.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
