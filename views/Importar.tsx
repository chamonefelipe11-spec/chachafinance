"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, FileUp, Undo2, Wand2 } from "lucide-react";
import { useApp } from "@/components/contexto";
import {
  Alternar,
  Botao,
  Cabecalho,
  Campo,
  Entrada,
  Folha,
  Painel,
  Segmentado,
  Seletor,
  confirmar,
  cx,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/store";
import { avisar } from "@/lib/toast";
import {
  dataBR,
  dinheiro,
  gerarId,
  hojeISO,
  lerValor,
  somarMesesISO,
} from "@/lib/format";
import { descricaoBase } from "@/lib/finance";
import {
  chaveDescricao,
  lerBase64,
  lerCSV,
  lerData,
  lerOFX,
  prepararLinhas,
  reduzirImagem,
  type LinhaBruta,
  type LinhaImport,
  type TipoLinha,
} from "@/lib/importar";
import type { Quem } from "@/lib/types";

type Etapa = "escolher" | "lendo" | "revisar";

export default function Importar() {
  const { dados, faltando, recarregar } = useApp();
  const contas = dados.contas.filter((c) => c.ativo);
  const [conta, setConta] = useState(
    contas.find((c) => c.tipo === "credito")?.nome || contas[0]?.nome || "",
  );
  const [pessoa, setPessoa] = useState<Quem>("Chamone");
  const [etapa, setEtapa] = useState<Etapa>("escolher");
  const [linhas, setLinhas] = useState<LinhaImport[]>([]);
  const [arquivos, setArquivos] = useState<string[]>([]);
  const [observacao, setObservacao] = useState<string | null>(null);
  const [criarFuturas, setCriarFuturas] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [regraDe, setRegraDe] = useState<LinhaImport | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const contaObj = dados.contas.find((c) => c.nome === conta);
  const semTabelas =
    faltando.includes("importacoes") || faltando.includes("regras");

  async function ler(lista: FileList | null) {
    if (!lista?.length || !contaObj) return;
    const fs = [...lista];
    setArquivos(fs.map((f) => f.name));
    setObservacao(null);
    setEtapa("lendo");
    try {
      const brutas: LinhaBruta[] = [];
      const paraIA: File[] = [];
      for (const f of fs) {
        const nome = f.name.toLowerCase();
        if (nome.endsWith(".ofx") || nome.endsWith(".qfx"))
          brutas.push(...lerOFX(await f.text()));
        else if (
          nome.endsWith(".csv") ||
          nome.endsWith(".txt") ||
          f.type === "text/csv"
        )
          brutas.push(...lerCSV(await f.text()));
        else if (
          f.type === "application/pdf" ||
          f.type.startsWith("image/") ||
          nome.endsWith(".pdf") ||
          /\.(png|jpe?g|heic|webp)$/.test(nome)
        )
          paraIA.push(f);
      }
      if (paraIA.length) {
        const enviados = await Promise.all(
          paraIA.map(async (f) =>
            f.type === "application/pdf" ||
            f.name.toLowerCase().endsWith(".pdf")
              ? {
                  nome: f.name,
                  tipo: "application/pdf",
                  base64: await lerBase64(f),
                }
              : { nome: f.name, ...(await reduzirImagem(f)) },
          ),
        );
        const { data: s } = await supabase.auth.getSession();
        const r = await fetch("/api/ler-arquivo", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${s.session?.access_token || ""}`,
          },
          body: JSON.stringify({
            arquivos: enviados,
            conta: contaObj.nome,
            tipoConta: contaObj.tipo,
            hoje: hojeISO(),
          }),
        });
        const j = await r.json().catch(() => ({ erro: `Erro ${r.status}` }));
        if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
        setObservacao(j.observacao || null);
        for (const l of j.lancamentos as {
          data: string;
          descricao: string;
          valor: number;
          direcao: string;
          parcela_atual?: number;
          parcela_total?: number;
        }[]) {
          const data = lerData(l.data);
          if (!data || !(Number(l.valor) > 0)) continue;
          const saida = l.direcao !== "entrada";
          // No cartão, compra = positivo; na conta, saída = negativo (mesma convenção dos arquivos)
          const sinal =
            contaObj.tipo === "credito" ? (saida ? 1 : -1) : saida ? -1 : 1;
          brutas.push({
            data,
            descricao: l.descricao,
            valor: sinal * Number(l.valor),
            parcela:
              l.parcela_atual && l.parcela_total && l.parcela_total > 1
                ? { atual: l.parcela_atual, total: l.parcela_total }
                : null,
          });
        }
      }
      if (!brutas.length)
        throw new Error(
          "Não encontrei lançamentos nesses arquivos. Confira se é o extrato ou a fatura certa.",
        );
      setLinhas(
        prepararLinhas(brutas, {
          conta: contaObj,
          contas: dados.contas,
          regras: dados.regras,
          transacoes: dados.transacoes,
          pessoaPadrao: pessoa,
        }).sort((a, b) => b.data.localeCompare(a.data)),
      );
      setEtapa("revisar");
    } catch (e) {
      avisar(
        e instanceof Error ? e.message : "Não consegui ler os arquivos.",
        "erro",
      );
      setEtapa("escolher");
    } finally {
      if (entrada.current) entrada.current.value = "";
      if (camera.current) camera.current.value = "";
    }
  }

  const mudar = (chave: string, campo: Partial<LinhaImport>) =>
    setLinhas((ls) =>
      ls.map((l) => (l.chave === chave ? { ...l, ...campo } : l)),
    );
  const marcadas = linhas.filter((l) => l.incluir);
  const totalSaida = marcadas
    .filter((l) => l.tipo === "despesa")
    .reduce((a, l) => a + l.valor, 0);
  const totalEntrada = marcadas
    .filter((l) => l.tipo === "receita")
    .reduce((a, l) => a + l.valor, 0);

  async function gravar() {
    if (!contaObj || !marcadas.length) return;
    setSalvando(true);
    let importacaoId: string | null = null;
    if (!faltando.includes("importacoes")) {
      const imp = await db.inserirDevolvendo<{ id: string }>("importacoes", {
        origem: arquivos.map((a) => a.split(".").pop()).join(","),
        conta: contaObj.nome,
        arquivo: arquivos.join(", ").slice(0, 300),
        qtd: marcadas.length,
      });
      importacaoId = imp?.[0]?.id ? String(imp[0].id) : null;
    }
    const novas: Record<string, unknown>[] = [];
    for (const l of marcadas) {
      const comum = {
        descricao: l.descricao,
        valor: l.valor,
        tipo: l.tipo,
        categoria: l.tipo === "transferencia" ? "Transferência" : l.categoria,
        cartao:
          l.tipo === "transferencia"
            ? l.conta_origem || contaObj.nome
            : contaObj.nome,
        conta_destino: l.tipo === "transferencia" ? l.conta_destino : null,
        quem: l.quem,
        divisao_pct:
          l.tipo === "despesa" && l.quem !== "Ambos" ? l.divisao_pct : null,
        tipo_gasto: "Variável",
        importacao_id: importacaoId,
      };
      if (l.parcela && l.tipo === "despesa") {
        const base = descricaoBase(l.descricao)
          .replace(/\s*\d{1,2}\s*\/\s*\d{1,2}\s*$/, "")
          .trim();
        const serie = dados.transacoes.find(
          (t) =>
            t.grupo_id &&
            t.cartao === contaObj.nome &&
            t.total_parcelas === l.parcela!.total &&
            Math.abs(t.valor - l.valor) < 0.01 &&
            chaveDescricao(t.descricao) === chaveDescricao(l.descricao),
        );
        const grupo = serie?.grupo_id || gerarId();
        novas.push({
          ...comum,
          descricao: `${base} (${l.parcela.atual}/${l.parcela.total})`,
          data: l.data,
          parcela_atual: l.parcela.atual,
          total_parcelas: l.parcela.total,
          grupo_id: grupo,
          import_hash: l.hash,
        });
        if (!serie && criarFuturas) {
          for (let p = l.parcela.atual + 1; p <= l.parcela.total; p++) {
            novas.push({
              ...comum,
              descricao: `${base} (${p}/${l.parcela.total})`,
              data: somarMesesISO(l.data, p - l.parcela.atual),
              parcela_atual: p,
              total_parcelas: l.parcela.total,
              grupo_id: grupo,
            });
          }
        }
      } else {
        novas.push({
          ...comum,
          data: l.data,
          parcela_atual: 1,
          total_parcelas: 1,
          import_hash: l.hash,
        });
      }
    }
    let ok = true;
    for (let i = 0; i < novas.length && ok; i += 300)
      ok = await db.inserir("financas", novas.slice(i, i + 300));
    setSalvando(false);
    if (ok) {
      avisar(`${marcadas.length} lançamentos importados.`);
      setLinhas([]);
      setEtapa("escolher");
      recarregar();
    }
  }

  async function desfazer(id: string, qtd: number) {
    const ids = dados.transacoes
      .filter((t) => t.importacao_id === id)
      .map((t) => t.id);
    if (
      !(await confirmar("Desfazer esta importação?", {
        texto: `Apaga os ${ids.length || qtd} lançamentos que ela criou (inclusive parcelas futuras). Lançamentos digitados à mão não são tocados.`,
        acao: "Desfazer",
      }))
    )
      return;
    const ok =
      (ids.length ? await db.remover("financas", ids) : true) &&
      (await db.remover("importacoes", id));
    if (ok) {
      avisar("Importação desfeita.");
      recarregar();
    }
  }

  // ---------------- Telas ----------------

  if (etapa === "lendo") {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-linha border-t-papel" />
        <p className="text-[15px]">
          Lendo{" "}
          {arquivos.length === 1 ? arquivos[0] : `${arquivos.length} arquivos`}…
        </p>
        <p className="text-sm text-fraco">
          Prints e PDFs levam alguns segundos.
        </p>
      </div>
    );
  }

  if (etapa === "revisar") {
    return (
      <div className="space-y-5">
        <Cabecalho
          titulo="Revisar importação"
          sub={`${contaObj?.nome} · ${linhas.length} lançamentos encontrados. Desmarque o que não deve entrar e corrija o que precisar.`}
          acoes={
            <Botao variante="fantasma" onClick={() => setEtapa("escolher")}>
              Cancelar
            </Botao>
          }
        />
        {observacao && (
          <p className="rounded-xl border border-alerta/30 bg-alerta/8 px-4 py-3 text-sm">
            {observacao}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-suave">
          <span>
            {marcadas.length} de {linhas.length} marcados
          </span>
          <span>
            Saídas{" "}
            <span className="num text-texto">{dinheiro(totalSaida)}</span>
          </span>
          {totalEntrada > 0 && (
            <span>
              Entradas{" "}
              <span className="num text-entrada">{dinheiro(totalEntrada)}</span>
            </span>
          )}
          <button
            type="button"
            className="cursor-pointer underline"
            onClick={() =>
              setLinhas((ls) => ls.map((l) => ({ ...l, incluir: !l.aviso })))
            }
          >
            Marcar os novos
          </button>
        </div>

        <ul className="space-y-2">
          {linhas.map((l) => (
            <LinhaRevisao
              key={l.chave}
              l={l}
              mudar={(c) => mudar(l.chave, c)}
              criarRegra={() => setRegraDe(l)}
            />
          ))}
        </ul>

        {linhas.some(
          (l) => l.parcela && l.incluir && l.parcela.atual < l.parcela.total,
        ) && (
          <div className="rounded-2xl border border-linha-suave bg-painel p-4">
            <Alternar
              ligado={criarFuturas}
              aoMudar={setCriarFuturas}
              rotulo="Criar as parcelas futuras das compras parceladas novas"
            />
            <p className="mt-1.5 text-xs text-fraco">
              Assim as próximas faturas já aparecem certas em Cartões. Quando a
              fatura seguinte for importada, a parcela é reconhecida e não
              duplica.
            </p>
          </div>
        )}

        <div className="pb-seguro sticky bottom-20 z-10 md:bottom-4">
          <Botao
            variante="primario"
            tamanho="lg"
            className="w-full shadow-2xl"
            disabled={!marcadas.length || salvando}
            onClick={gravar}
          >
            {salvando
              ? "Importando…"
              : `Importar ${marcadas.length} lançamentos`}
          </Botao>
        </div>

        {regraDe && (
          <RegraForm
            key={regraDe.chave}
            linha={regraDe}
            aoFechar={() => setRegraDe(null)}
            aoSalvar={(r) =>
              setLinhas((ls) =>
                ls.map((x) =>
                  chaveDescricao(x.descricao).includes(r.contem) ||
                  x.descricao.toLowerCase().includes(r.contem)
                    ? {
                        ...x,
                        categoria: r.categoria || x.categoria,
                        quem: r.quem || x.quem,
                        origemRegra: r.contem,
                      }
                    : x,
                ),
              )
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Importar extrato"
        sub="CSV, OFX, PDF ou prints. Tudo passa por uma revisão antes de entrar."
      />

      {semTabelas && (
        <div className="rounded-2xl border border-alerta/30 bg-alerta/8 p-4 text-sm">
          Dá para importar já, mas para desfazer uma importação e salvar regras,
          rode{" "}
          <code className="rounded bg-elevado px-1.5 py-0.5 text-[13px]">
            supabase/fase2a5.sql
          </code>{" "}
          no Supabase.
        </div>
      )}

      <Painel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo rotulo="De qual conta ou cartão é o arquivo">
            <Seletor value={conta} onChange={(e) => setConta(e.target.value)}>
              {contas.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </Seletor>
          </Campo>
          <Campo rotulo="Quem pagou, por padrão">
            <Segmentado
              valor={pessoa}
              aoMudar={setPessoa}
              opcoes={[
                { valor: "Chamone", rotulo: "Chamone" },
                { valor: "Letícia", rotulo: "Letícia" },
                { valor: "Ambos", rotulo: "Conjunta" },
              ]}
            />
          </Campo>
        </div>

        <input
          ref={entrada}
          type="file"
          multiple
          accept=".csv,.ofx,.qfx,.txt,.pdf,image/*"
          className="hidden"
          onChange={(e) => ler(e.target.files)}
        />
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => ler(e.target.files)}
        />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            ler(e.dataTransfer.files);
          }}
          className="mt-5 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#3a404d] px-6 py-10 text-center"
        >
          <FileUp className="h-7 w-7 text-fraco" />
          <p className="text-[15px]">Arraste os arquivos aqui</p>
          <p className="max-w-md text-sm text-fraco">
            Pode mandar vários prints de uma vez, por exemplo a fatura inteira
            rolando a tela.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <Botao
              variante="primario"
              icone={<FileUp className="h-4 w-4" />}
              onClick={() => entrada.current?.click()}
            >
              Escolher arquivos
            </Botao>
            <Botao
              icone={<Camera className="h-4 w-4" />}
              onClick={() => camera.current?.click()}
              className="md:hidden"
            >
              Tirar foto
            </Botao>
          </div>
        </div>
      </Painel>

      <Painel titulo="Onde conseguir cada arquivo">
        <ul className="space-y-2 text-sm text-suave">
          <li>
            <span className="text-texto">Banco Inter:</span> Conta Digital →
            Extrato → exportar em OFX.
          </li>
          <li>
            <span className="text-texto">Nubank:</span> o app não deixa tirar
            print no Android. Use o PDF da fatura ou do extrato, ou o CSV quando
            o app oferecer.
          </li>
          <li>
            <span className="text-texto">Caju, Intercred e outros:</span> print
            da lista de transações.
          </li>
          <li>
            <span className="text-texto">
              Comprovante de Pix, nota fiscal ou cupom:
            </span>{" "}
            print ou foto. Vira um lançamento só.
          </li>
        </ul>
        <p className="mt-3 text-xs text-fraco">
          CSV e OFX são lidos no seu aparelho. Prints e PDFs passam pelo
          servidor do app e pela API do Claude só para leitura, e não ficam
          guardados.
        </p>
      </Painel>

      {dados.importacoes.length > 0 && (
        <Painel titulo="Importações anteriores" corpo={false}>
          <ul className="px-3 pt-1 pb-3">
            {dados.importacoes.slice(0, 15).map((i) => (
              <li
                key={i.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">
                    {i.conta} · {i.qtd} lançamentos
                  </p>
                  <p className="truncate text-[12.5px] text-fraco">
                    {dataBR(i.created_at.slice(0, 10))}
                    {i.arquivo ? ` · ${i.arquivo}` : ""}
                  </p>
                </div>
                <Botao
                  tamanho="sm"
                  variante="fantasma"
                  icone={<Undo2 className="h-4 w-4" />}
                  onClick={() => desfazer(i.id, i.qtd)}
                >
                  Desfazer
                </Botao>
              </li>
            ))}
          </ul>
        </Painel>
      )}
    </div>
  );
}

function LinhaRevisao({
  l,
  mudar,
  criarRegra,
}: {
  l: LinhaImport;
  mudar: (c: Partial<LinhaImport>) => void;
  criarRegra: () => void;
}) {
  const { dados } = useApp();
  const [mexeu, setMexeu] = useState(false);
  const cats = dados.categorias.filter(
    (c) =>
      c.ativo &&
      (l.tipo === "receita" ? c.tipo !== "despesa" : c.tipo !== "receita"),
  );
  return (
    <li
      className={cx(
        "rounded-2xl border bg-painel p-3",
        l.incluir ? "border-linha" : "border-linha-suave opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={l.incluir}
          onChange={(e) => mudar({ incluir: e.target.checked })}
          aria-label="Incluir"
          className="mt-3 h-5 w-5 shrink-0 cursor-pointer accent-[#ece6d8]"
        />
        <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-2 sm:grid-cols-[132px_1fr_120px]">
          <input
            type="date"
            value={l.data}
            onChange={(e) => mudar({ data: e.target.value })}
            aria-label="Data"
            className="col-span-2 h-10 rounded-lg border border-linha bg-campo px-2 text-sm text-texto sm:col-span-1"
          />
          <input
            value={l.descricao}
            onChange={(e) => mudar({ descricao: e.target.value })}
            aria-label="Descrição"
            className="h-10 min-w-0 rounded-lg border border-linha bg-campo px-2.5 text-sm text-texto"
          />
          <input
            inputMode="decimal"
            defaultValue={l.valor.toFixed(2).replace(".", ",")}
            onBlur={(e) => {
              const v = lerValor(e.target.value);
              if (v > 0) mudar({ valor: Math.round(v * 100) / 100 });
            }}
            aria-label="Valor"
            className={cx(
              "num h-10 w-28 rounded-lg border border-linha bg-campo px-2.5 text-right text-sm sm:w-full",
              l.tipo === "receita" ? "text-entrada" : "text-texto",
            )}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
        <Segmentado
          tamanho="sm"
          valor={l.tipo}
          aoMudar={(t: TipoLinha) =>
            mudar({
              tipo: t,
              categoria:
                t === "transferencia"
                  ? "Transferência"
                  : t === "receita"
                    ? "Reembolso"
                    : "Outros",
            })
          }
          opcoes={[
            { valor: "despesa", rotulo: "Saída" },
            { valor: "receita", rotulo: "Entrada" },
            { valor: "transferencia", rotulo: "Transf." },
          ]}
        />
        {l.tipo === "transferencia" ? (
          <select
            value={l.conta_destino || ""}
            onChange={(e) => mudar({ conta_destino: e.target.value })}
            aria-label="Para qual conta"
            className="h-8 rounded-lg border border-linha bg-campo px-2 text-[13px] text-texto"
          >
            <option value="">Para qual conta?</option>
            {dados.contas.map((c) => (
              <option key={c.id} value={c.nome}>
                {l.conta_origem ? `De ${l.conta_origem} → ` : "→ "}
                {c.nome}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={l.categoria}
            onChange={(e) => {
              mudar({ categoria: e.target.value });
              setMexeu(true);
            }}
            aria-label="Categoria"
            className="h-8 max-w-[200px] rounded-lg border border-linha bg-campo px-2 text-[13px] text-texto"
          >
            {!cats.some((c) => c.nome === l.categoria) && (
              <option value={l.categoria}>{l.categoria}</option>
            )}
            {cats.map((c) => (
              <option key={c.id} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
        <select
          value={l.quem}
          onChange={(e) => mudar({ quem: e.target.value as Quem })}
          aria-label="Quem"
          className="h-8 rounded-lg border border-linha bg-campo px-2 text-[13px] text-texto"
        >
          <option value="Chamone">Chamone</option>
          <option value="Letícia">Letícia</option>
          <option value="Ambos">Conjunta</option>
        </select>
        {l.parcela && (
          <span className="num rounded-md bg-elevado px-1.5 text-[12px] text-suave">
            {l.parcela.atual}/{l.parcela.total}
          </span>
        )}
        {mexeu && l.tipo !== "transferencia" && (
          <button
            type="button"
            onClick={criarRegra}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 text-[12.5px] text-papel underline"
          >
            <Wand2 className="h-3.5 w-3.5" /> Sempre assim?
          </button>
        )}
        {l.origemRegra && !mexeu && (
          <span className="text-[12px] text-fraco">
            regra “{l.origemRegra}”
          </span>
        )}
        {l.aviso && (
          <span className="text-[12.5px] text-alerta">{l.aviso}</span>
        )}
      </div>
    </li>
  );
}

function RegraForm({
  linha,
  aoFechar,
  aoSalvar,
}: {
  linha: LinhaImport;
  aoFechar: () => void;
  aoSalvar: (r: {
    contem: string;
    categoria: string | null;
    quem: Quem | null;
  }) => void;
}) {
  const { recarregar, faltando, dados } = useApp();
  const [contem, setContem] = useState(
    chaveDescricao(linha.descricao).split(" ").slice(0, 3).join(" "),
  );
  const [usarQuem, setUsarQuem] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const outras = useMemo(() => contem.trim().length >= 3, [contem]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (faltando.includes("regras"))
      return avisar("Rode supabase/fase2a5.sql para salvar regras.", "erro");
    const c = contem.trim().toLowerCase();
    if (c.length < 3) return avisar("Use pelo menos 3 letras.", "erro");
    setSalvando(true);
    const ok = await db.inserir("regras", {
      contem: c,
      categoria: linha.categoria,
      quem: usarQuem ? linha.quem : null,
      divisao_pct: null,
      transferir_para: null,
      ignorar: false,
      ordem: dados.regras.length,
    });
    setSalvando(false);
    if (ok) {
      avisar(`Regra criada: “${c}” → ${linha.categoria}.`);
      aoSalvar({
        contem: c,
        categoria: linha.categoria,
        quem: usarQuem ? linha.quem : null,
      });
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo="Criar regra"
      rodape={
        <Botao
          variante="primario"
          tamanho="lg"
          className="w-full"
          type="submit"
          form="form-regra"
          disabled={salvando || !outras}
        >
          Criar regra
        </Botao>
      }
    >
      <form id="form-regra" onSubmit={salvar} className="space-y-4">
        <Campo
          rotulo="Quando a descrição tiver"
          dica="Sem diferença entre maiúsculas e acentos."
        >
          <Entrada
            autoFocus
            value={contem}
            onChange={(e) => setContem(e.target.value)}
          />
        </Campo>
        <p className="text-sm text-suave">
          usar a categoria <span className="text-texto">{linha.categoria}</span>
          .
        </p>
        <Alternar
          ligado={usarQuem}
          aoMudar={setUsarQuem}
          rotulo={`E marcar como de ${linha.quem === "Ambos" ? "conta conjunta" : linha.quem}`}
        />
      </form>
    </Folha>
  );
}
