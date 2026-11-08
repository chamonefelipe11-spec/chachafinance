'use client';

// Leitura de prints e PDFs no próprio aparelho: nada é enviado para fora.
// Os arquivos do OCR ficam em /public/ocr (copiados por scripts/copiar-ocr.mjs).

type Progresso = (texto: string) => void;

type TesseractWorker = {
  recognize: (img: Blob | HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  setParameters: (p: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

let workerPromessa: Promise<TesseractWorker> | null = null;
let avisarProgresso: Progresso | undefined;

async function obterWorker(): Promise<TesseractWorker> {
  if (!workerPromessa) {
    workerPromessa = (async () => {
      const { createWorker } = await import('tesseract.js');
      const w = (await createWorker('por', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr',
        langPath: '/ocr',
        gzip: true,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') avisarProgresso?.(`${Math.round(m.progress * 100)}%`);
          else if (/loading|initializ/i.test(m.status)) avisarProgresso?.('preparando o leitor…');
        },
      })) as unknown as TesseractWorker;
      // 6 = bloco único: mantém descrição e valor na mesma linha
      await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
      return w;
    })().catch((e) => {
      workerPromessa = null;
      throw e;
    });
  }
  return workerPromessa;
}

export async function encerrarOCR() {
  if (!workerPromessa) return;
  const w = await workerPromessa.catch(() => null);
  workerPromessa = null;
  await w?.terminate();
}

/** Prepara o print para o OCR: aumenta, passa para cinza e inverte se for tema escuro. */
async function prepararImagem(fonte: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  let largura: number, altura: number, desenhar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  if (fonte instanceof HTMLCanvasElement) {
    largura = fonte.width;
    altura = fonte.height;
    desenhar = (ctx, w, h) => ctx.drawImage(fonte, 0, 0, w, h);
  } else {
    const bmp = await createImageBitmap(fonte);
    largura = bmp.width;
    altura = bmp.height;
    desenhar = (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h);
  }
  const escala = Math.min(Math.max(2000 / largura, 1), 3);
  const c = document.createElement('canvas');
  c.width = Math.round(largura * escala);
  c.height = Math.round(altura * escala);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  desenhar(ctx, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let soma = 0;
  for (let i = 0; i < d.length; i += 4) soma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const escuro = soma / (d.length / 4) < 110;
  // Cinza (invertido se o print for de tema escuro) e limiar de Otsu: texto preto em fundo branco
  const cinza = new Uint8Array(d.length / 4);
  const hist = new Array(256).fill(0);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    let y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    if (escuro) y = 255 - y;
    cinza[j] = y;
    hist[y]++;
  }
  const total = cinza.length;
  let somaT = 0;
  for (let t = 0; t < 256; t++) somaT += t * hist[t];
  let somaB = 0, pesoB = 0, melhor = 0, limiar = 160;
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    somaB += t * hist[t];
    const mB = somaB / pesoB, mF = (somaT - somaB) / pesoF;
    const entre = pesoB * pesoF * (mB - mF) * (mB - mF);
    if (entre > melhor) { melhor = entre; limiar = t; }
  }
  // Um pouco acima do limiar: texto cinza-claro (categorias, datas) não some
  limiar = Math.min(limiar + 25, 235);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const y = cinza[j] < limiar ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function textoDeImagem(arquivo: Blob | HTMLCanvasElement, progresso?: Progresso): Promise<string> {
  avisarProgresso = progresso;
  const w = await obterWorker();
  const canvas = await prepararImagem(arquivo);
  const r = await w.recognize(canvas);
  return r.data.text || '';
}

// ---------------- PDF ----------------

type ItemTexto = { str: string; transform: number[]; width: number };
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPagina> };
type PdfPagina = {
  getTextContent: () => Promise<{ items: ItemTexto[] }>;
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }) => { promise: Promise<void> };
};

async function carregarPdfJs(): Promise<PdfJs> {
  const url = '/ocr/pdf.min.mjs';
  const pdfjs = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as PdfJs;
  pdfjs.GlobalWorkerOptions.workerSrc = '/ocr/pdf.worker.min.mjs';
  return pdfjs;
}

/** Junta os pedaços de texto da página em linhas, pela altura em que aparecem. */
function montarLinhas(itens: ItemTexto[]): string {
  const linhas: { y: number; partes: { x: number; fim: number; s: string }[] }[] = [];
  for (const it of itens) {
    if (!it.str?.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let linha = linhas.find((l) => Math.abs(l.y - y) < 3);
    if (!linha) {
      linha = { y, partes: [] };
      linhas.push(linha);
    }
    linha.partes.push({ x, fim: x + (it.width || 0), s: it.str });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map((l) => {
      const ps = l.partes.sort((a, b) => a.x - b.x);
      let txt = '';
      let fim = -Infinity;
      for (const p of ps) {
        txt += txt ? (p.x - fim > 12 ? '   ' : ' ') + p.s : p.s;
        fim = p.fim;
      }
      return txt.replace(/\s+$/, '');
    })
    .join('\n');
}

export async function textoDePDF(arquivo: File, progresso?: Progresso): Promise<string> {
  const pdfjs = await carregarPdfJs();
  const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const partes: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    progresso?.(`página ${n} de ${doc.numPages}`);
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    const texto = montarLinhas(conteudo.items);
    if (texto.replace(/\s/g, '').length > 40) {
      partes.push(texto);
      continue;
    }
    // PDF escaneado (só imagem): desenha a página e passa no OCR
    const vp = pagina.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport: vp, canvas }).promise;
    partes.push(await textoDeImagem(canvas, (p) => progresso?.(`página ${n} de ${doc.numPages}: ${p}`)));
  }
  return partes.join('\n');
}
