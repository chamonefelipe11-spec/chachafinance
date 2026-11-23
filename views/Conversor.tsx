"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardCopy,
  Download,
  FileText,
  ScanText,
  Server,
  Share2,
  Trash2,
} from "lucide-react";
import { Botao, Cabecalho, Campo, Entrada, Painel, cx } from "@/components/ui";
import { textoDePDF } from "@/lib/ocr";
import { avisar } from "@/lib/toast";

// Converte documentos em Markdown para mandar ao Claude gastando menos tokens.
// A conversão roda no serverchacha (MarkItDown), acessado pelo Tailscale direto do aparelho:
// o arquivo não passa pela Vercel nem pelo Supabase. PDFs também podem ser lidos no próprio
// aparelho (pdf.js + OCR), quando o servidor está fora de alcance ou o PDF é escaneado.

const CHAVE_SERVIDOR = "chacha-conversor-url";
const PADRAO = process.env.NEXT_PUBLIC_CONVERSOR_URL || "";
const ACEITOS =
  ".pdf,.docx,.pptx,.xlsx,.xls,.html,.htm,.csv,.json,.xml,.txt,.md,.epub,.zip";

type Estado = "testando" | "online" | "offline" | "sem-endereco";

type Resultado = {
  id: number;
  arquivo: File;
  status: "convertendo" | "pronto" | "erro";
  origem?: "servidor" | "aparelho";
  progresso?: string;
  nome: string;
  markdown: string;
  paginas?: number | null;
  tokens?: number;
  kb: number;
  aviso?: string | null;
  erro?: string;
};

const ehPDF = (f: File) =>
  f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
const nomeMd = (f: File) => f.name.replace(/\.[^.]+$/, "") + ".md";
const tokens = (t: string) => Math.max(1, Math.round(t.length / 4));
const num = (n: number) => n.toLocaleString("pt-BR");

function lerServidorSalvo() {
  try {
    return localStorage.getItem(CHAVE_SERVIDOR) || PADRAO;
  } catch {
    return PADRAO;
  }
}

async function comPrazo(url: string, init: RequestInit = {}, ms = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export default function Conversor() {
  const [servidor, setServidor] = useState(PADRAO);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(PADRAO);
  const [estado, setEstado] = useState<Estado>("testando");
  const [itens, setItens] = useState<Resultado[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const base = servidor.replace(/\/+$/, "");

  // O endereço fica salvo por aparelho; só dá para ler depois de montar a tela
  useEffect(() => {
    const salvo = lerServidorSalvo();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setServidor(salvo);
    setRascunho(salvo);
  }, []);

  const testar = useCallback(async () => {
    if (!base) return setEstado("sem-endereco");
    setEstado("testando");
    try {
      const r = await comPrazo(`${base}/saude`);
      setEstado(r.ok ? "online" : "offline");
    } catch {
      setEstado("offline");
    }
  }, [base]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    testar();
  }, [testar]);

  function salvarServidor() {
    const v = rascunho.trim().replace(/\/+$/, "");
    if (v && !/^https?:\/\//.test(v))
      return avisar("O endereço precisa começar com https://", "erro");
    try {
      localStorage.setItem(CHAVE_SERVIDOR, v);
    } catch {}
    setServidor(v);
    setEditando(false);
  }

  const atualizar = (id: number, p: Partial<Resultado>) =>
    setItens((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));

  async function noAparelho(id: number, f: File) {
    atualizar(id, {
      status: "convertendo",
      progresso: "lendo no aparelho…",
      aviso: null,
    });
    try {
      const texto = (
        await textoDePDF(f, (p) => atualizar(id, { progresso: p }))
      ).trim();
      const md = texto ? texto + "\n" : "";
      atualizar(id, {
        status: "pronto",
        origem: "aparelho",
        markdown: md,
        tokens: tokens(md),
        progresso: undefined,
        aviso: md
          ? null
          : "Não encontrei texto neste PDF. Mande o arquivo original para o Claude.",
      });
    } catch (e) {
      atualizar(id, {
        status: "erro",
        erro: `Não consegui ler o PDF no aparelho: ${(e as Error).message}`,
      });
    }
  }

  async function noServidor(id: number, f: File) {
    const form = new FormData();
    form.append("file", f);
    const r = await comPrazo(
      `${base}/api/convert`,
      { method: "POST", body: form },
      180000,
    );
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || `Erro ${r.status} no servidor`);
    atualizar(id, {
      status: "pronto",
      origem: "servidor",
      markdown: d.markdown,
      paginas: d.paginas,
      tokens: d.tokens_estimados,
      aviso: d.aviso,
    });
  }

  async function converter(f: File) {
    const id = ++seq.current;
    setItens((l) => [
      {
        id,
        arquivo: f,
        status: "convertendo",
        nome: nomeMd(f),
        markdown: "",
        kb: Math.round((f.size / 1024) * 10) / 10,
      },
      ...l,
    ]);
    if (estado === "online") {
      try {
        await noServidor(id, f);
        return;
      } catch (e) {
        if (!ehPDF(f))
          return atualizar(id, { status: "erro", erro: (e as Error).message });
        // PDF: tenta no aparelho antes de desistir
      }
    }
    if (ehPDF(f)) return noAparelho(id, f);
    atualizar(id, {
      status: "erro",
      erro:
        "Word, PowerPoint e Excel precisam do servidor. Ligue o Tailscale e tente de novo.",
    });
  }

  function receber(lista: FileList | null) {
    if (!lista?.length) return;
    [...lista].forEach(converter);
  }

  return (
    <>
      <Cabecalho
        titulo="Conversor"
        sub="PDF, Word, PowerPoint e Excel em Markdown. Mande o .md para o Claude no lugar do original e gaste menos tokens."
      />

      <Painel corpo={false} className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5 text-sm">
            <span
              className={cx(
                "h-2 w-2 shrink-0 rounded-full",
                estado === "online" && "bg-entrada",
                estado === "offline" && "bg-alerta",
                estado === "testando" && "animate-pulse bg-fraco",
                estado === "sem-endereco" && "bg-fraco",
              )}
            />
            <span className="min-w-0 text-suave">
              {estado === "online" && "Servidor conectado."}
              {estado === "testando" && "Procurando o servidor…"}
              {estado === "offline" &&
                "Servidor fora de alcance (o Tailscale está ligado?). PDFs serão lidos no aparelho."}
              {estado === "sem-endereco" &&
                "Sem servidor configurado neste aparelho. PDFs serão lidos no aparelho."}
            </span>
          </div>
          <div className="flex gap-2">
            {estado === "offline" && (
              <Botao tamanho="sm" variante="fantasma" onClick={testar}>
                Tentar de novo
              </Botao>
            )}
            <Botao
              tamanho="sm"
              variante="fantasma"
              icone={<Server className="h-4 w-4" />}
              onClick={() => {
                setRascunho(servidor);
                setEditando((v) => !v);
              }}
            >
              Servidor
            </Botao>
          </div>
        </div>
        {editando && (
          <div className="flex flex-wrap items-end gap-2 border-t border-linha-suave px-5 py-4">
            <Campo rotulo="Endereço do conversor" className="min-w-0 flex-1">
              <Entrada
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                placeholder="https://serverchacha.xxxx.ts.net:10000"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </Campo>
            <Botao variante="primario" onClick={salvarServidor}>
              Salvar
            </Botao>
          </div>
        )}
      </Painel>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          receber(e.dataTransfer.files);
        }}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition-colors",
          arrastando
            ? "border-papel bg-elevado"
            : "border-linha bg-painel hover:border-[#3a404d]",
        )}
      >
        <FileText className="mb-3 h-7 w-7 text-fraco" />
        <span className="text-[15px] font-medium text-texto">
          Escolher arquivos
        </span>
        <span className="mt-1 text-sm text-suave">
          ou arraste aqui · PDF, DOCX, PPTX, XLSX, HTML, CSV, EPUB
        </span>
        <input
          ref={entrada}
          type="file"
          multiple
          accept={ACEITOS}
          className="hidden"
          onChange={(e) => {
            receber(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <div className="mt-4 space-y-3">
        {itens.map((i) => (
          <ItemResultado
            key={i.id}
            item={i}
            aoOCR={() => noAparelho(i.id, i.arquivo)}
            aoRemover={() => setItens((l) => l.filter((x) => x.id !== i.id))}
          />
        ))}
      </div>
    </>
  );
}

function ItemResultado({
  item,
  aoOCR,
  aoRemover,
}: {
  item: Resultado;
  aoOCR: () => void;
  aoRemover: () => void;
}) {
  const [previa, setPrevia] = useState(false);
  const arquivoMd = () =>
    new File([item.markdown], item.nome, { type: "text/markdown" });
  const podeCompartilhar =
    typeof navigator !== "undefined" &&
    !!navigator.canShare?.({ files: [arquivoMd()] });

  function baixar() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(arquivoMd());
    a.download = item.nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(item.markdown);
      avisar("Texto copiado.");
    } catch {
      avisar("Não consegui copiar. Use Baixar .md.", "erro");
    }
  }

  const detalhes = [
    item.paginas
      ? `${num(item.paginas)} ${item.paginas === 1 ? "página" : "páginas"}`
      : null,
    `${num(item.kb)} KB no original`,
    item.tokens != null ? `~${num(item.tokens)} tokens no .md` : null,
    item.origem === "aparelho" ? "lido no aparelho" : null,
  ].filter(Boolean);

  return (
    <Painel corpo={false}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[15px] font-medium break-all text-texto">
            {item.arquivo.name}
          </p>
          <button
            type="button"
            aria-label="Remover da lista"
            onClick={aoRemover}
            className="shrink-0 cursor-pointer p-1 text-fraco hover:text-texto"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {item.status === "convertendo" && (
          <p className="mt-1.5 flex items-center gap-2 text-sm text-suave">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-linha border-t-papel" />
            {item.progresso || "convertendo…"}
          </p>
        )}

        {item.status === "erro" && (
          <p className="mt-1.5 text-sm text-saida">{item.erro}</p>
        )}

        {item.status === "pronto" && (
          <>
            <p className="mt-1 text-[13px] text-suave">
              {detalhes.join(" · ")}
            </p>
            {item.aviso && (
              <div className="mt-3 rounded-xl border border-alerta/30 bg-alerta/8 px-3.5 py-2.5 text-sm text-texto">
                {item.aviso}
                {ehPDF(item.arquivo) && item.origem === "servidor" && (
                  <div className="mt-2">
                    <Botao
                      tamanho="sm"
                      icone={<ScanText className="h-4 w-4" />}
                      onClick={aoOCR}
                    >
                      Ler com OCR no aparelho
                    </Botao>
                  </div>
                )}
              </div>
            )}
            {item.markdown && (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {podeCompartilhar && (
                    <Botao
                      tamanho="sm"
                      variante="primario"
                      icone={<Share2 className="h-4 w-4" />}
                      onClick={() =>
                        navigator
                          .share({ files: [arquivoMd()] })
                          .catch(() => {})
                      }
                    >
                      Compartilhar
                    </Botao>
                  )}
                  <Botao
                    tamanho="sm"
                    variante={podeCompartilhar ? "secundario" : "primario"}
                    icone={<Download className="h-4 w-4" />}
                    onClick={baixar}
                  >
                    Baixar .md
                  </Botao>
                  <Botao
                    tamanho="sm"
                    icone={<ClipboardCopy className="h-4 w-4" />}
                    onClick={copiar}
                  >
                    Copiar
                  </Botao>
                  <Botao
                    tamanho="sm"
                    variante="fantasma"
                    onClick={() => setPrevia((v) => !v)}
                  >
                    {previa ? "Esconder prévia" : "Ver prévia"}
                  </Botao>
                </div>
                {previa && (
                  <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-fundo p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-suave">
                    {item.markdown.slice(0, 6000)}
                    {item.markdown.length > 6000 ? "\n\n[…]" : ""}
                  </pre>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Painel>
  );
}
