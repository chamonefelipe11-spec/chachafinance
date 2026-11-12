// Leitura de extratos (CSV/OFX) e preparação das linhas para a tela de revisão.
import type { Conta, Quem, Regra, Transacao } from "./types";
import { descricaoBase } from "./finance";
import { dataDeISO, diffDias, somarDiasISO } from "./format";

export type TipoLinha = "despesa" | "receita" | "transferencia";

export interface LinhaBruta {
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number; // com sinal: negativo = saída da conta
  parcela?: { atual: number; total: number } | null;
  /** Conta/cartão identificado na própria linha (mensagens do WhatsApp) */
  conta?: string | null;
  /** O dia não aparece no print (mensagem acima do primeiro "Hoje/Ontem/sábado") */
  dataIncerta?: boolean;
}

export interface LinhaImport {
  chave: string;
  /** Conta ou cartão onde o lançamento entra */
  conta: string;
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
  [/presente|aniversario|natal/, "Presentes"],
  [/compras? (de |da |pra |para )?casa|alimentac/, "Alimentação / Mercado"],
];

/** Categoria provável pelo tipo do benefício (Caju VA → mercado, mobilidade → transporte…). */
function categoriaDoBeneficio(conta: Conta): string | null {
  if (conta.tipo !== "beneficio") return null;
  const n = normalizar(conta.nome);
  if (/mobilidade|transporte/.test(n)) return "Transporte / Uber";
  if (/\bva\b|aliment|mercado/.test(n)) return "Alimentação / Mercado";
  if (/\bvr\b|refei/.test(n)) return "FastFood / iFood";
  if (/cultura/.test(n)) return "Lazer / Passeio";
  return null;
}

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

    if (!aviso && b.dataIncerta) aviso = "Confira a data: o dia não aparece no print";

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
        else if (saida) categoria = categoriaDoBeneficio(conta) || categoria;
        if (!saida && !achou) categoria = "Reembolso";
      }
    }

    return {
      chave: `${i}-${hash}`,
      conta: conta.nome,
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

// ---------------- Texto lido por OCR ou de PDF ----------------

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const IGNORAR_LINHA =
  /\b(saldo|total|limite|dispon[ií]vel|fatura (atual|fechada|aberta|anterior)|pagamento m[ií]nimo|valor (da|total) (fatura|compra)|melhor dia|vencimento|encargos|cet\b|iof previsto|resumo|parcelamento dispon)/i;
const ENTRADA_TEXTO =
  /recebid|dep[oó]sito|sal[aá]rio|estorno|reembolso|resgate|cr[eé]dito de|cashback|rendimento|devolu/i;
// Linhas com data que não é de lançamento (fechamento, vencimento)
const DATA_NAO_E_LANCAMENTO = /fecha|vence|vencimento|fechamento|melhor dia|per[ií]odo|extrato de|\bat[eé]\b.*\d{4}/i;
// Categorias que os apps mostram embaixo do nome (o OCR às vezes come a 1ª letra)
const CATEGORIAS_APP = [
  'supermercado', 'mercado', 'transporte', 'restaurante', 'restaurantes', 'servicos', 'lazer', 'saude', 'educacao', 'casa',
  'vestuario', 'eletronicos', 'outros', 'viagem', 'entretenimento', 'compras', 'assinaturas', 'combustivel', 'farmacia',
  'alimentacao', 'delivery', 'pets', 'beleza', 'academia', 'hospedagem', 'shopping', 'presentes', 'bares', 'cultura',
];
const ehSubtitulo = (t: string) => {
  const n = normalizar(t).replace(/[^a-z0-9/ ]/g, '').trim();
  if (!n) return false;
  if (/^parc(ela)?\s*\d{1,2}\s*(\/|de)\s*\d{1,2}$/.test(n)) return true;
  return CATEGORIAS_APP.some((c) => c === n || (n.length >= 5 && c.endsWith(n)));
};
const GENERICA = /^(compra|compra (aprovada|realizada|efetuada|no d[eé]bito|no cr[eé]dito|d[eé]bito|cr[eé]dito)|aprovad[ao]|pix|pagamento|pagamento aprovado|transa[cç][aã]o|d[eé]bito|cr[eé]dito|recarga mensal)$/i;

const ehDataISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function somarDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Acha uma data na linha e devolve a linha sem ela. */
export function dataDaLinha(linha: string, hoje: string): { data: string; resto: string } | null {
  const ano = Number(hoje.slice(0, 4));
  const ajustar = (d: number, m: number, a?: number) => {
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;
    const montar = (y: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (a) return montar(a < 100 ? 2000 + a : a);
    // Sem ano: o mais recente que não passe de amanhã
    const iso = montar(ano);
    return iso > somarDias(hoje, 1) ? montar(ano - 1) : iso;
  };
  let m = linha.match(/\b(hoje|ontem|anteontem)\b/i);
  if (m) {
    const n = m[1].toLowerCase() === 'hoje' ? 0 : m[1].toLowerCase() === 'ontem' ? -1 : -2;
    return { data: somarDias(hoje, n), resto: linha.replace(m[0], ' ') };
  }
  m = linha.match(/(?:^|\s)([0-9OoIl]{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?(?:\s*(?:de\s+)?(\d{4}))?\b/i);
  if (m) {
    // OCR troca 0 por O e 1 por l
    const dia = Number(m[1].replace(/[Oo]/g, '0').replace(/[Il]/g, '1'));
    const data = ajustar(dia, MESES[m[2].toLowerCase()], m[3] ? Number(m[3]) : undefined);
    if (data) return { data, resto: linha.replace(m[0], ' ') };
  }
  // dd/mm/aaaa em qualquer lugar; dd/mm sem ano só no começo da linha (senão pode ser parcela 3/10)
  m = linha.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/) || linha.match(/^\s*(\d{1,2})[/.](\d{1,2})(?![/.\d])/);
  if (m) {
    const data = ajustar(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined);
    if (data) return { data, resto: linha.replace(m[0], ' ') };
  }
  return null;
}

/** Primeiro valor em reais da linha (com sinal, se houver). */
export function valorDaLinha(linha: string): { valor: number; sinal: 1 | -1 | 0; resto: string } | null {
  const re = /([+\-−–—]+\s*)?(R\s?[$S5]\s*)?([+\-−–—]+\s*)?(\d{1,3}(?:[.\s]\d{3})*|\d+),(\d{2})(?!\d|\s*%)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linha))) {
    const antes = linha.slice(0, m.index);
    if (/\d[/.-]$/.test(antes)) continue; // parte de uma data
    const inteiro = m[4].replace(/[.\s]/g, '');
    const valor = Number(`${inteiro}.${m[5]}`);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    const s = (m[1] || m[3] || '').trim();
    const sinal = s.includes('+') ? 1 : s ? -1 : 0;
    return { valor, sinal: sinal as 1 | -1 | 0, resto: linha.slice(0, m.index) + ' ' + linha.slice(m.index + m[0].length) };
  }
  return null;
}

const limparDescricao = (s: string) =>
  s
    .replace(/[+\-−–]?\s*R\s?[$S5]\s*[+\-−–]?\s*(\d{1,3}(?:[.\s]\d{3})*|\d+),\d{2}/g, ' ') // outros valores (ex.: saldo)
    .replace(/(^|\s)(\d{1,3}(?:\.\d{3})*|\d+),\d{2}(?=\s|$)/g, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\bàs\b|\bas\b(?=\s*$)/gi, ' ')
    .replace(/R\s?[$S5]/g, ' ')
    .replace(/^[\s\-–—•·|:>*]+|[\s\-–—•·|:>*]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * Transforma o texto de um print ou PDF de extrato/fatura em lançamentos.
 * Convenção de sinal igual à dos arquivos: no cartão, compra = positivo; na conta, saída = negativo.
 */
export function lerTextoExtrato(texto: string, tipoConta: Conta['tipo'], hoje: string): LinhaBruta[] {
  const out: LinhaBruta[] = [];
  let dataAtual: string | null = null;
  // Linhas só de texto desde o último lançamento (nome do estabelecimento, categoria…)
  let soTexto: string[] = [];
  const credito = tipoConta === 'credito';
  // Último lançamento cujo nome veio na mesma linha do valor: a parcela pode vir na linha de baixo
  let ultimoNaLinha: LinhaBruta | null = null;

  for (const bruta of texto.split(/\r?\n/)) {
    let linha = bruta.replace(/\s+/g, ' ').trim();
    if (linha.length < 2) continue;
    const d = dataDaLinha(linha, hoje);
    if (d && ehDataISO(d.data) && !DATA_NAO_E_LANCAMENTO.test(linha)) {
      dataAtual = d.data;
      linha = d.resto.trim();
      soTexto = [];
      ultimoNaLinha = null;
    }
    const v = valorDaLinha(linha);
    if (!v) {
      const t = limparDescricao(linha);
      const parc = lerParcela(t);
      if (parc && !soTexto.length && ultimoNaLinha && !ultimoNaLinha.parcela) {
        ultimoNaLinha.descricao = `${ultimoNaLinha.descricao} ${parc.atual}/${parc.total}`;
        ultimoNaLinha.parcela = parc;
        ultimoNaLinha = null;
        continue;
      }
      if (t.length >= 3 && /[a-zA-ZÀ-ú]{2}/.test(t) && !IGNORAR_LINHA.test(t)) soTexto.push(t);
      continue;
    }
    ultimoNaLinha = null;
    if (IGNORAR_LINHA.test(linha)) {
      soTexto = [];
      continue;
    }
    const t = limparDescricao(v.resto);
    // Nome do estabelecimento: o texto da própria linha, a não ser que seja só a categoria/parcela;
    // aí vale a última linha de texto antes do valor que não seja genérica nem categoria
    const anteriores = soTexto.filter((x) => !GENERICA.test(x) && !ehSubtitulo(x));
    const semNome = t.length < 3 || !/[a-zA-ZÀ-ú]{2}/.test(t) || GENERICA.test(t) || ehSubtitulo(t);
    let descricao = semNome ? anteriores[anteriores.length - 1] || t : t;
    const parcelaTexto = [t, ...soTexto].find((x) => lerParcela(x));
    if (parcelaTexto && !lerParcela(descricao)) descricao = `${descricao} ${parcelaTexto.match(/\d{1,2}\s*(?:\/|de)\s*\d{1,2}/)?.[0] || ''}`.trim();
    soTexto = [];
    if (!descricao || !dataAtual) continue;
    // Na fatura do cartão, o sinal de menos marca crédito (pagamento, estorno); na conta, marca saída
    const entrada = credito
      ? v.sinal === -1 || ENTRADA_TEXTO.test(descricao)
      : v.sinal === 1 || (v.sinal === 0 && ENTRADA_TEXTO.test(descricao));
    const valor = credito ? (entrada ? -v.valor : v.valor) : entrada ? v.valor : -v.valor;
    const item: LinhaBruta = { data: dataAtual, descricao, valor, parcela: lerParcela(descricao) };
    out.push(item);
    if (!semNome) ultimoNaLinha = item;
  }
  return out;
}

/** Junta lançamentos lidos de prints que se sobrepõem (o mesmo item em dois prints). */
export function semRepetidosEntrePrints(grupos: LinhaBruta[][]): LinhaBruta[] {
  const vistos = new Map<string, number>();
  const out: LinhaBruta[] = [];
  for (const g of grupos) {
    const contagem = new Map<string, number>();
    for (const l of g) {
      const k = `${l.data}|${l.valor}|${normalizar(l.descricao).slice(0, 12)}`;
      const n = (contagem.get(k) || 0) + 1;
      contagem.set(k, n);
      // Só entra se este print tiver mais ocorrências do que as já vistas em prints anteriores
      if (n > (vistos.get(k) || 0)) out.push(l);
    }
    for (const [k, n] of contagem) vistos.set(k, Math.max(vistos.get(k) || 0, n));
  }
  return out;
}

// ---------------- Mensagens do WhatsApp ("-24,89 caju") ----------------

const DIAS_SEMANA_WPP = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

/** Mensagem curta de gasto: começa com sinal (ou R$) e valor; a hora do WhatsApp fica no fim. */
// O OCR às vezes troca o "-" por aspas ou til
const MSG_GASTO =
  /^([+\-−–—~“”"'‘’`´]+)?\s*(?:r\s?[$s5]\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d/])\s*(.*)$/i;
// Hora da mensagem no fim ("12:32", ou "1232" quando o OCR perde os dois-pontos) e os tiques de lida
const HORA_FIM =
  /\s*(?:editad[ao]\s*)?\b(?:(?:[01]\d|2[0-3])[0-5]\d|(?:[01]?\d|2[0-3])\s?[:.;,\- ]\s?[0-5]\d)\b[\s yv/&,.;:'"✓✔*\-]{0,6}$/i;
// Linha só com a hora (e os tiques, que o OCR lê como letras soltas): o balão acabou
const SO_HORA =
  /^(?:editad[ao]\s*)?(?:(?:[01]\d|2[0-3])[0-5]\d|(?:[01]?\d|2[0-3])\s?[:.;,\- ]\s?[0-5]\d)\d?(?:[^a-zA-ZÀ-ú0-9]{0,4}[a-zA-Z]{0,2}){0,2}[^a-zA-ZÀ-ú0-9]{0,4}$/i;
const sinalDeMenos = (s: string) => /[\-−–—~“”"'‘’`´]/.test(s);

/** O print pega outras janelas ao lado: blocos separados por muitos espaços são tratados à parte. */
const pedacosDaLinha = (bruta: string) =>
  bruta
    .split(/\s{3,}|\t+/)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/** O dia que um separador do WhatsApp ("Hoje", "Ontem", "sábado", "12/11/2026") representa. */
export function dataDoSeparador(linha: string, ref: string): string | null {
  const n = normalizar(linha).replace(/[^a-z0-9/ -]/g, "").trim();
  if (!n || n.length > 24) return null;
  if (n === "hoje") return ref;
  if (n === "ontem") return somarDiasISO(ref, -1);
  const dia = DIAS_SEMANA_WPP.findIndex((d) => n === d || n === `${d}-feira` || n === `${d} feira` || n === `${d}feira`);
  if (dia >= 0) {
    // O WhatsApp usa o nome do dia para a última semana (antes de ontem)
    for (let k = 2; k <= 7; k++) {
      const d = somarDiasISO(ref, -k);
      if (dataDeISO(d).getDay() === dia) return d;
    }
  }
  const m = n.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return ehDataISO(iso) ? iso : null;
  }
  return null;
}

/** Quantas linhas parecem mensagens de gasto: decide se o print é de conversa. */
export function pareceWhatsApp(texto: string): boolean {
  const linhas = texto.split(/\r?\n/).flatMap(pedacosDaLinha);
  let comHora = 0;
  let comSinal = 0;
  for (const l of linhas) {
    const m = l.match(MSG_GASTO);
    if (!m || !/[a-zA-ZÀ-ú]{3}/.test(m[3] || "")) continue;
    if ((m[1] || /^r\s?[$s5]/i.test(l)) && HORA_FIM.test(m[3] || "")) comHora++;
    if (m[1]) comSinal++;
  }
  const separadores = linhas.filter((l) => /^(hoje|ontem)$/i.test(l) || /feira$|^s[aá]bado$|^domingo$/i.test(l)).length;
  return comHora >= 2 || (comHora >= 1 && separadores >= 1) || (comSinal >= 2 && separadores >= 1);
}

/**
 * Erro de digitação ou de OCR: letras trocadas, sobrando, faltando ou invertidas
 * ("caiu" ≈ "caju", "intecerd" ≈ "intercred"). Palavras longas aceitam 2 erros; médias, 1.
 */
function quaseIgual(a: string, b: string): boolean {
  if (a === b) return true;
  const max = Math.min(a.length, b.length) >= 7 ? 2 : Math.min(a.length, b.length) >= 4 ? 1 : 0;
  if (!max || Math.abs(a.length - b.length) > max) return false;
  if (a[0] !== b[0]) return false; // a primeira letra quase sempre sai certa
  // Distância de Damerau-Levenshtein (inversão de duas letras conta como 1 erro)
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length] <= max;
}

/** Troca palavras quase iguais ao nome de uma conta pelo nome certo ("caiu" → "caju"). */
function corrigirNomesDeConta(texto: string, contas: Conta[]): string {
  const tokens = new Set(
    contas.flatMap((c) => normalizar(c.nome).split(/[^a-z0-9]+/)).filter((t) => t.length >= 4 && !GENERICAS_CONTA.has(t)),
  );
  return texto.replace(/[A-Za-zÀ-ú]{4,}/g, (w) => {
    const n = normalizar(w);
    if (tokens.has(n)) return w;
    const certo = [...tokens].find((t) => quaseIgual(n, t));
    return certo || w;
  });
}

const PALAVRAS_SUBCONTA: [RegExp, RegExp][] = [
  [/aliment|mercado|\bva\b/, /\bva\b|aliment/],
  [/refeic|almoc|\bvr\b|restaurante|marmit/, /\bvr\b|refei/],
  [/bhbus|onibus|metro|move\b|\bmob\b|mobilidade|uber|\b99\b|gasolina|combust|transporte/, /mobilidade|transporte/],
  [/cultura|cinema|livro|teatro/, /cultura/],
];
const GENERICAS_CONTA = new Set(["cartao", "conta", "corrente", "banco", "pix", "investimentos", "padrao"]);

/**
 * Descobre de qual conta é a mensagem pelas palavras dela ("caju alimentação" → Caju VA,
 * "intercred" → Cartão Intercred, "débito" → conta corrente). Sem pista, fica a conta escolhida.
 */
export function contaDaMensagem(texto: string, contas: Conta[], padrao: string, uso: Map<string, number>): string {
  const n = ` ${normalizar(texto)} `;
  const palavras = n.split(/[^a-z0-9]+/).filter(Boolean);
  const ativas = contas.filter((c) => c.ativo !== false);
  let melhor: { nome: string; pontos: number } | null = null;
  for (const c of ativas) {
    const tokens = normalizar(c.nome).split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !GENERICAS_CONTA.has(t));
    let pontos = tokens.filter((t) => palavras.some((p) => quaseIgual(p, t))).length * 10;
    if (!pontos) continue;
    for (const [palavra, nomeConta] of PALAVRAS_SUBCONTA)
      if (palavra.test(n) && nomeConta.test(normalizar(c.nome))) pontos += 5;
    pontos += Math.min(uso.get(c.nome) || 0, 9) / 10; // desempate: a conta mais usada
    if (c.nome === padrao) pontos += 0.05;
    if (!melhor || pontos > melhor.pontos) melhor = { nome: c.nome, pontos };
  }
  if (melhor) return melhor.nome;
  if (/\b(debito|pix|transferencia|ted)\b/.test(n)) {
    const corrente = ativas.filter((c) => c.tipo === "corrente");
    return (
      corrente.find((c) => c.nome === padrao)?.nome ||
      [...corrente].sort((a, b) => (uso.get(b.nome) || 0) - (uso.get(a.nome) || 0))[0]?.nome ||
      padrao
    );
  }
  return padrao;
}

/**
 * Lê prints de uma conversa em que os gastos são anotados como mensagens:
 * "-24,89 caju", "-R$44,97 intercred", "-109,98 (2x54,98) presente".
 * `ref` é o dia em que o print foi tirado (o "Hoje" da conversa).
 */
export function lerMensagensWhatsApp(
  texto: string,
  ref: string,
  contas: Conta[],
  contaPadrao: string,
  transacoes: Transacao[] = [],
): LinhaBruta[] {
  const uso = new Map<string, number>();
  const desde = somarDiasISO(ref, -90);
  for (const t of transacoes) if (t.data >= desde) uso.set(t.cartao, (uso.get(t.cartao) || 0) + 1);

  const out: LinhaBruta[] = [];
  let data: string | null = null;
  let primeiroSeparador: string | null = null;
  const tokensConta = new Set(
    contas.flatMap((c) => normalizar(c.nome).split(/[^a-z0-9]+/)).filter((t) => t.length >= 3 && !GENERICAS_CONTA.has(t)),
  );
  const pedacos = texto.split(/\r?\n/).flatMap(pedacosDaLinha);
  for (let i = 0; i < pedacos.length; i++) {
    const linha = pedacos[i];
    const sep = dataDoSeparador(linha, ref);
    if (sep) {
      data = sep;
      primeiroSeparador ??= sep;
      continue;
    }
    const m = linha.match(MSG_GASTO);
    if (!m) continue;
    const temSinal = !!m[1] || /^r\s?[$s5]/i.test(linha);
    const temHora = HORA_FIM.test(m[3] || "");
    // O OCR pode perder o "-": aí vale se a hora vier logo depois, ou se a 1ª palavra for uma conta (caju…)
    const horaEmSeguida = SO_HORA.test(pedacos[i + 1] || "");
    const primeira = normalizar((m[3] || "").split(/\s+/)[0] || "");
    const comecaComConta = [...tokensConta].some((t) => quaseIgual(primeira, t));
    if (!temSinal && !temHora && !horaEmSeguida && !comecaComConta) continue;
    let resto = (m[3] || "").replace(HORA_FIM, "").trim();
    resto = resto.replace(/\beditad[ao]\b/gi, "").replace(/[✓✔√]+/g, "").trim();
    // Data escrita na própria mensagem ("-6,11 caju 03/11")
    let dataPropria: string | null = null;
    const dm = resto.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (dm && Number(dm[1]) <= 31 && Number(dm[2]) <= 12) {
      let ano = dm[3] ? (dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : ref.slice(0, 4);
      let iso = `${ano}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      if (!dm[3] && iso > ref) {
        ano = String(Number(ano) - 1);
        iso = `${ano}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      }
      if (ehDataISO(iso)) {
        dataPropria = iso;
        resto = resto.replace(dm[0], " ").replace(/\s+/g, " ").trim();
      }
    }
    // Restos de hora ou de tique que o OCR deixou no fim ("caju 9.5, ,")
    resto = resto.replace(/(?<=[a-zA-ZÀ-ú)])\s+[\d\s.,:;'"/|&yv]*$/i, "").trim();
    if (!/[a-zA-ZÀ-ú]{3}/.test(resto)) continue;
    const bruto = m[2];
    let valor = bruto.includes(",")
      ? Number(bruto.replace(/\./g, "").replace(",", "."))
      : /^\d{1,3}(\.\d{3})+$/.test(bruto)
        ? Number(bruto.replace(/\./g, ""))
        : Number(bruto);
    if (!(valor > 0)) continue;
    // "(2x54,98)": compra parcelada; entra a parcela, e as próximas podem ser criadas
    let parcela: LinhaBruta["parcela"] = null;
    const px = resto.match(/\(?\s*(\d{1,2})\s*x\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*\)?/i);
    if (px && Number(px[1]) >= 2) {
      const vp = Number(px[2].replace(",", "."));
      if (vp > 0 && Math.abs(vp * Number(px[1]) - valor) <= Math.max(1, valor * 0.02)) {
        parcela = { atual: 1, total: Number(px[1]) };
        valor = vp;
      }
      resto = resto.replace(px[0], " ").replace(/\s+/g, " ").trim();
    }
    resto = corrigirNomesDeConta(resto, contas);
    const entrada = /\+/.test(m[1] || "") && !sinalDeMenos(m[1] || "");
    const conta = contaDaMensagem(resto, contas, contaPadrao, uso);
    const descricao = resto.charAt(0).toUpperCase() + resto.slice(1);
    out.push({
      data: dataPropria || data || "",
      descricao,
      valor: entrada ? valor : -valor,
      parcela,
      conta,
    });
  }
  // Mensagens antes do primeiro separador de dia: provavelmente do dia anterior a ele
  for (const l of out)
    if (!l.data) {
      l.data = primeiroSeparador ? somarDiasISO(primeiroSeparador, -1) : ref;
      l.dataIncerta = true;
    }
  return out;
}
