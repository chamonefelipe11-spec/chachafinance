"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Columns3,
  GanttChart,
  MoreHorizontal,
  Plus,
  Wallet,
} from "lucide-react";
import { useApp } from "@/components/contexto";
import {
  Alternar,
  Avatar,
  Botao,
  BotaoIcone,
  Cabecalho,
  Campo,
  Chip,
  Entrada,
  Folha,
  Painel,
  Segmentado,
  Vazio,
  confirmar,
  cx,
} from "@/components/ui";
import CardForm, { type InicialCard } from "@/components/projetos/CardForm";
import Gantt from "@/components/projetos/Gantt";
import { dataCurta, dinheiro, hojeISO } from "@/lib/format";
import {
  COR_SITUACAO,
  cardFeito,
  cardsDaColuna,
  corEtiqueta,
  gastoDoCard,
  ordemEntre,
  progresso,
  situacaoPrazo,
} from "@/lib/projetos";
import { db } from "@/lib/store";
import { avisar } from "@/lib/toast";
import type { Card, ColunaQuadro, Pessoa } from "@/lib/types";

type Visao = "quadro" | "gantt";
type FiltroPessoa = "todos" | Pessoa;
const CHAVE_VISAO = "chacha:projetos:visao";

/** Abre o formulário de card a partir do botão "Novo" do menu. */
export const EVENTO_NOVO_CARD = "chacha:novo-card";

const prefixoColuna = "col:";
// O navegador dispara um clique ao soltar o mouse: ignora logo depois de arrastar
let fimDoArrasto = 0;

export default function Projetos() {
  const { dados, faltando, recarregar, cats } = useApp();
  const [visao, setVisaoBruta] = useState<Visao>(() => {
    try {
      return (localStorage.getItem(CHAVE_VISAO) as Visao) === "gantt" ? "gantt" : "quadro";
    } catch {
      return "quadro";
    }
  });
  const setVisao = (v: Visao) => {
    setVisaoBruta(v);
    try {
      localStorage.setItem(CHAVE_VISAO, v);
    } catch {}
  };
  const [pessoa, setPessoa] = useState<FiltroPessoa>("todos");
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [form, setForm] = useState<{ card: Card | null; inicial?: InicialCard } | null>(null);
  const [colunaEditando, setColunaEditando] = useState<ColunaQuadro | "nova" | null>(null);
  // Mudanças já feitas na tela enquanto o banco ainda confirma
  const [ajustes, setAjustes] = useState<Record<string, Partial<Card>>>({});

  const colunas = useMemo(
    () => [...dados.colunasQuadro].sort((a, b) => a.ordem - b.ordem),
    [dados.colunasQuadro],
  );
  const todos = useMemo(
    () => dados.cards.map((c) => (ajustes[c.id] ? { ...c, ...ajustes[c.id] } : c)),
    [dados.cards, ajustes],
  );
  const visiveis = useMemo(
    () =>
      todos.filter(
        (c) =>
          (pessoa === "todos" || c.quem === pessoa || c.quem === "Ambos") &&
          (!etiqueta || (c.etiqueta || "").toLowerCase() === etiqueta.toLowerCase()),
      ),
    [todos, pessoa, etiqueta],
  );
  const etiquetasEmUso = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of todos) if (c.etiqueta) m.set(c.etiqueta.toLowerCase(), c.etiqueta);
    return [...m.values()].sort();
  }, [todos]);

  const novo = useCallback(
    (inicial?: InicialCard) =>
      setForm({
        card: null,
        inicial: {
          quem: pessoa === "todos" ? "Ambos" : pessoa,
          etiqueta,
          ...inicial,
        },
      }),
    [pessoa, etiqueta],
  );

  const algoAberto = !!form || !!colunaEditando;
  useEffect(() => {
    const abrir = () => !algoAberto && novo();
    window.addEventListener(EVENTO_NOVO_CARD, abrir);
    return () => window.removeEventListener(EVENTO_NOVO_CARD, abrir);
  }, [novo, algoAberto]);

  const salvarCampos = useCallback(
    async (card: Card, campos: Partial<Card>) => {
      setAjustes((a) => ({ ...a, [card.id]: { ...a[card.id], ...campos } }));
      const ok = await db.atualizar("cards", card.id, campos as Record<string, unknown>);
      await recarregar();
      setAjustes((a) => {
        const n = { ...a };
        delete n[card.id];
        return n;
      });
      return ok;
    },
    [recarregar],
  );

  if (faltando.includes("cards") || faltando.includes("quadro_colunas")) {
    return (
      <div>
        <Cabecalho titulo="Projetos" />
        <Painel>
          <Vazio
            titulo="Falta criar as tabelas do quadro"
            texto="Rode o arquivo supabase/projetos.sql no SQL Editor do Supabase e recarregue a página."
          />
        </Painel>
      </div>
    );
  }

  const hoje = hojeISO();
  const abertos = todos.filter((c) => !cardFeito(c, colunas));
  const atrasados = abertos.filter((c) => c.prazo && c.prazo < hoje).length;

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Projetos"
        sub={
          todos.length
            ? `${abertos.length} em aberto${atrasados ? ` · ${atrasados} atrasado${atrasados > 1 ? "s" : ""}` : ""}`
            : "Quadro de tarefas do casal, com linha do tempo."
        }
        acoes={
          <>
            <Segmentado<Visao>
              valor={visao}
              aoMudar={setVisao}
              opcoes={[
                { valor: "quadro", rotulo: <><Columns3 className="h-4 w-4" /> Quadro</> },
                { valor: "gantt", rotulo: <><GanttChart className="h-4 w-4" /> Gantt</> },
              ]}
            />
            <Botao variante="primario" icone={<Plus className="h-4 w-4" />} onClick={() => novo()} disabled={!colunas.length}>
              Novo card
            </Botao>
          </>
        }
      />

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Segmentado<FiltroPessoa>
          tamanho="sm"
          valor={pessoa}
          aoMudar={setPessoa}
          opcoes={[
            { valor: "todos", rotulo: "Todos" },
            { valor: "Chamone", rotulo: "Chamone" },
            { valor: "Letícia", rotulo: "Letícia" },
          ]}
        />
        {etiquetasEmUso.length > 0 && (
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            <Chip ativo={!etiqueta} onClick={() => setEtiqueta(null)}>
              Todas
            </Chip>
            {etiquetasEmUso.map((e) => (
              <Chip key={e} ativo={etiqueta === e} cor={corEtiqueta(e)} onClick={() => setEtiqueta(etiqueta === e ? null : e)}>
                {e}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {!colunas.length ? (
        <Painel>
          <Vazio
            titulo="O quadro está sem colunas"
            texto="Crie as colunas para começar a organizar os cards."
            acao={
              <Botao
                variante="primario"
                onClick={async () => {
                  if (
                    await db.inserir("quadro_colunas", [
                      { nome: "A fazer", ordem: 1000, concluida: false },
                      { nome: "Fazendo", ordem: 2000, concluida: false },
                      { nome: "Feito", ordem: 3000, concluida: true },
                    ])
                  )
                    await recarregar();
                }}
              >
                Criar A fazer, Fazendo e Feito
              </Botao>
            }
          />
        </Painel>
      ) : visao === "quadro" ? (
        <Quadro
          colunas={colunas}
          cards={visiveis}
          todos={todos}
          aoAbrir={(c) => setForm({ card: c })}
          aoNovoNaColuna={(id) => novo({ coluna_id: id })}
          aoCriarRapido={async (colunaId, titulo) => {
            const daColuna = cardsDaColuna(todos, colunaId);
            const ok = await db.inserir("cards", {
              titulo,
              coluna_id: colunaId,
              quem: pessoa === "todos" ? "Ambos" : pessoa,
              etiqueta,
              ordem: ordemEntre(daColuna[daColuna.length - 1]?.ordem),
              concluido_em: colunas.find((k) => k.id === colunaId)?.concluida ? new Date().toISOString() : null,
            });
            if (ok) await recarregar();
            return ok;
          }}
          aoMover={(card, colunaId, ordem) => {
            const coluna = colunas.find((k) => k.id === colunaId);
            const eraFeito = cardFeito(card, colunas);
            const campos: Partial<Card> = { coluna_id: colunaId, ordem };
            if (coluna?.concluida && !eraFeito) campos.concluido_em = new Date().toISOString();
            if (!coluna?.concluida && eraFeito) campos.concluido_em = null;
            salvarCampos(card, campos);
          }}
          aoEditarColuna={setColunaEditando}
          gasto={(c) => gastoDoCard(c, dados.transacoes, cats)}
        />
      ) : (
        <Gantt
          cards={visiveis}
          colunas={colunas}
          aoAbrir={(c) => setForm({ card: c })}
          aoMudarDatas={async (c, datas) => {
            if (!(await salvarCampos(c, datas))) avisar("Não consegui mudar as datas.", "erro");
          }}
        />
      )}

      {form && (
        <CardForm
          editando={form.card}
          inicial={form.inicial}
          colunas={colunas}
          cards={todos}
          aoFechar={() => setForm(null)}
        />
      )}
      {colunaEditando && (
        <ColunaForm
          coluna={colunaEditando === "nova" ? null : colunaEditando}
          colunas={colunas}
          qtdCards={colunaEditando === "nova" ? 0 : todos.filter((c) => c.coluna_id === colunaEditando.id).length}
          aoFechar={() => setColunaEditando(null)}
        />
      )}
    </div>
  );
}

// ---------------- Quadro ----------------

function Quadro({
  colunas,
  cards,
  todos,
  aoAbrir,
  aoNovoNaColuna,
  aoCriarRapido,
  aoMover,
  aoEditarColuna,
  gasto,
}: {
  colunas: ColunaQuadro[];
  cards: Card[];
  todos: Card[];
  aoAbrir: (c: Card) => void;
  aoNovoNaColuna: (colunaId: string) => void;
  aoCriarRapido: (colunaId: string, titulo: string) => Promise<boolean>;
  aoMover: (c: Card, colunaId: string, ordem: number) => void;
  aoEditarColuna: (c: ColunaQuadro | "nova") => void;
  gasto: (c: Card) => number | null;
}) {
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter abre o card; espaço pega e solta
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  const porId = useMemo(() => new Map(todos.map((c) => [c.id, c])), [todos]);
  const derivados = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const k of colunas) m[k.id] = cardsDaColuna(cards, k.id).map((c) => c.id);
    return m;
  }, [colunas, cards]);
  const [arrastando, setArrastando] = useState<Record<string, string[]> | null>(null);
  const itensRef = useRef<Record<string, string[]> | null>(null);
  const [ativo, setAtivo] = useState<string | null>(null);
  const itens = arrastando || derivados;
  const hoje = hojeISO();

  const atualizar = (n: Record<string, string[]>) => {
    itensRef.current = n;
    setArrastando(n);
  };
  const colunaDe = (id: string, mapa: Record<string, string[]>) =>
    id.startsWith(prefixoColuna) ? id.slice(prefixoColuna.length) : Object.keys(mapa).find((k) => mapa[k].includes(id));

  function inicio(e: DragStartEvent) {
    setAtivo(String(e.active.id));
    atualizar(derivados);
  }

  function sobre({ active, over }: DragOverEvent) {
    const mapa = itensRef.current;
    if (!over || !mapa) return;
    const id = String(active.id);
    const de = colunaDe(id, mapa);
    const para = colunaDe(String(over.id), mapa);
    if (!de || !para || de === para) return;
    const destino = [...mapa[para]];
    const idx = String(over.id).startsWith(prefixoColuna) ? destino.length : destino.indexOf(String(over.id));
    destino.splice(idx < 0 ? destino.length : idx, 0, id);
    atualizar({ ...mapa, [de]: mapa[de].filter((x) => x !== id), [para]: destino });
  }

  function fim({ active, over }: DragEndEvent) {
    const mapa = itensRef.current;
    const id = String(active.id);
    fimDoArrasto = Date.now();
    setAtivo(null);
    setArrastando(null);
    itensRef.current = null;
    if (!mapa || !over) return;
    const col = colunaDe(id, mapa);
    if (!col) return;
    let lista = mapa[col];
    const sobreId = String(over.id);
    if (!sobreId.startsWith(prefixoColuna)) {
      const a = lista.indexOf(id);
      const b = lista.indexOf(sobreId);
      if (b >= 0 && a !== b) lista = arrayMove(lista, a, b);
    }
    const card = porId.get(id);
    if (!card) return;
    const i = lista.indexOf(id);
    const original = derivados[card.coluna_id] || [];
    if (card.coluna_id === col && original.indexOf(id) === i) return; // não mudou
    const antes = lista[i - 1] ? porId.get(lista[i - 1])?.ordem : undefined;
    const depois = lista[i + 1] ? porId.get(lista[i + 1])?.ordem : undefined;
    aoMover(card, col, ordemEntre(antes, depois));
  }

  const nomeColuna = (id?: string) => colunas.find((k) => k.id === id)?.nome || "";
  const titulo = (id: unknown) => porId.get(String(id))?.titulo || "card";
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Pegou o card ${titulo(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titulo(active.id)} está sobre ${nomeColuna(colunaDe(String(over.id), itensRef.current || derivados))}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${titulo(active.id)} solto em ${nomeColuna(colunaDe(String(over.id), derivados) )}.` : `${titulo(active.id)} voltou ao lugar.`,
    onDragCancel: ({ active }) => `Movimento cancelado. ${titulo(active.id)} voltou ao lugar.`,
  };

  const cardAtivo = ativo ? porId.get(ativo) : null;

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCorners}
      onDragStart={inicio}
      onDragOver={sobre}
      onDragEnd={fim}
      onDragCancel={() => {
        setAtivo(null);
        setArrastando(null);
        itensRef.current = null;
      }}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable:
            "Enter abre o card. Para mover, aperte espaço, use as setas para mudar de lugar e de coluna, espaço para soltar e Esc para cancelar.",
        },
      }}
    >
      <div className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-3 md:snap-none" data-quadro>
        {colunas.map((k) => (
          <ColunaView
            key={k.id}
            coluna={k}
            ids={itens[k.id] || []}
            porId={porId}
            hoje={hoje}
            ativo={ativo}
            aoAbrir={aoAbrir}
            aoNovo={() => aoNovoNaColuna(k.id)}
            aoCriarRapido={(t) => aoCriarRapido(k.id, t)}
            aoEditar={() => aoEditarColuna(k)}
            gasto={gasto}
          />
        ))}
        <button
          type="button"
          onClick={() => aoEditarColuna("nova")}
          className="flex h-12 w-[260px] shrink-0 cursor-pointer snap-start items-center justify-center gap-2 rounded-2xl border border-dashed border-linha text-sm text-suave hover:border-[#3a404d] hover:text-texto"
        >
          <Plus className="h-4 w-4" /> Nova coluna
        </button>
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: "ease-out" }}>
        {cardAtivo ? (
          <CartaoConteudo card={cardAtivo} hoje={hoje} feito={cardFeito(cardAtivo, colunas)} gasto={gasto(cardAtivo)} erguido />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ColunaView({
  coluna,
  ids,
  porId,
  hoje,
  ativo,
  aoAbrir,
  aoNovo,
  aoCriarRapido,
  aoEditar,
  gasto,
}: {
  coluna: ColunaQuadro;
  ids: string[];
  porId: Map<string, Card>;
  hoje: string;
  ativo: string | null;
  aoAbrir: (c: Card) => void;
  aoNovo: () => void;
  aoCriarRapido: (titulo: string) => Promise<boolean>;
  aoEditar: () => void;
  gasto: (c: Card) => number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: prefixoColuna + coluna.id });
  const [rapido, setRapido] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  async function criar() {
    const t = (rapido || "").trim();
    if (!t) return setRapido(null);
    setCriando(true);
    const ok = await aoCriarRapido(t);
    setCriando(false);
    if (ok) setRapido("");
  }

  return (
    <section
      aria-label={coluna.nome}
      data-coluna={coluna.nome}
      className={cx(
        "flex max-h-[calc(100dvh-260px)] min-h-[160px] w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl border bg-painel md:max-h-[calc(100dvh-280px)] md:w-[280px]",
        isOver ? "border-[#3a404d]" : "border-linha-suave",
      )}
    >
      <header className="flex items-center gap-2 px-3.5 pt-3 pb-2">
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-texto">
          {coluna.nome}
          {coluna.concluida && <span className="ml-1.5 text-[12px] font-normal text-entrada">✓</span>}
        </h3>
        <span className="num rounded-full bg-elevado px-2 text-[12px] text-suave">{ids.length}</span>
        <BotaoIcone rotulo={`Opções da coluna ${coluna.nome}`} className="h-7 w-7" onClick={aoEditar}>
          <MoreHorizontal className="h-4 w-4" />
        </BotaoIcone>
      </header>
      <div ref={setNodeRef} className="min-h-[40px] flex-1 space-y-2 overflow-y-auto px-2.5 pb-2">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const c = porId.get(id);
            if (!c) return null;
            return (
              <CartaoArrastavel
                key={id}
                card={c}
                hoje={hoje}
                feito={coluna.concluida}
                sumido={ativo === id}
                aoAbrir={() => aoAbrir(c)}
                gasto={gasto(c)}
              />
            );
          })}
        </SortableContext>
        {!ids.length && (
          <p className="rounded-xl border border-dashed border-linha-suave px-3 py-5 text-center text-[13px] text-fraco">
            Arraste um card para cá
          </p>
        )}
      </div>
      <div className="px-2.5 pb-2.5">
        {rapido !== null ? (
          <div className="space-y-2">
            <Entrada
              autoFocus
              value={rapido}
              disabled={criando}
              onChange={(e) => setRapido(e.target.value)}
              placeholder="Título do card"
              aria-label={`Novo card em ${coluna.nome}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") criar();
                if (e.key === "Escape") setRapido(null);
              }}
              onBlur={() => !rapido.trim() && setRapido(null)}
            />
            <div className="flex gap-2">
              <Botao tamanho="sm" variante="primario" onClick={criar} disabled={criando}>
                Adicionar
              </Botao>
              <Botao tamanho="sm" variante="fantasma" onMouseDown={(e) => e.preventDefault()} onClick={aoNovo}>
                Mais detalhes
              </Botao>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRapido("")}
            className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-xl px-2 text-[13px] text-suave hover:bg-elevado hover:text-texto"
          >
            <Plus className="h-4 w-4" /> Adicionar card
          </button>
        )}
      </div>
    </section>
  );
}

function CartaoArrastavel({
  card,
  hoje,
  feito,
  sumido,
  aoAbrir,
  gasto,
}: {
  card: Card;
  hoje: string;
  feito: boolean;
  sumido: boolean;
  aoAbrir: () => void;
  gasto: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(sumido && "opacity-30")}
      {...attributes}
      {...listeners}
      aria-roledescription="card arrastável"
      data-card={card.titulo}
      onClick={() => Date.now() - fimDoArrasto > 300 && aoAbrir()}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !sumido) aoAbrir();
      }}
    >
      <CartaoConteudo card={card} hoje={hoje} feito={feito} gasto={gasto} />
    </div>
  );
}

function CartaoConteudo({
  card,
  hoje,
  feito,
  gasto,
  erguido,
}: {
  card: Card;
  hoje: string;
  feito: boolean;
  gasto: number | null;
  erguido?: boolean;
}) {
  const sit = situacaoPrazo(card, feito, hoje);
  const { feitos, total } = progresso(card);
  return (
    <div
      className={cx(
        "cursor-pointer touch-manipulation rounded-xl border bg-elevado px-3 py-2.5 text-left select-none",
        erguido ? "border-[#4a5263] shadow-2xl ring-1 ring-papel/20" : "border-linha hover:border-[#3a404d]",
      )}
    >
      {card.etiqueta && (
        <span
          className="mb-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: `${corEtiqueta(card.etiqueta)}26`, color: corEtiqueta(card.etiqueta) }}
        >
          {card.etiqueta}
        </span>
      )}
      <p className={cx("line-clamp-3 text-[14px] leading-snug", feito ? "text-suave line-through decoration-fraco" : "text-texto")}>
        {card.titulo}
      </p>
      {(card.prazo || total > 0 || card.descricao || gasto !== null || card.quem) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-suave">
          {card.prazo && sit && (
            <span
              className="num inline-flex items-center gap-1 rounded-md px-1.5 py-0.5"
              style={sit === "atrasado" || sit === "hoje" || sit === "feito" ? { backgroundColor: `${COR_SITUACAO[sit]}22`, color: COR_SITUACAO[sit] } : { color: sit === "breve" ? COR_SITUACAO.breve : undefined }}
              title={sit === "atrasado" ? "Atrasado" : "Prazo"}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {sit === "hoje" ? "Hoje" : dataCurta(card.prazo)}
            </span>
          )}
          {total > 0 && (
            <span className={cx("num inline-flex items-center gap-1", feitos === total && "text-entrada")}>
              <CheckSquare className="h-3.5 w-3.5" />
              {feitos}/{total}
            </span>
          )}
          {gasto !== null && (
            <span
              className={cx("num inline-flex items-center gap-1", card.orcamento && gasto > card.orcamento && "text-saida")}
              title="Gasto na categoria ligada"
            >
              <Wallet className="h-3.5 w-3.5" />
              {dinheiro(gasto)}
              {card.orcamento ? <span className="text-fraco">/ {dinheiro(card.orcamento)}</span> : null}
            </span>
          )}
          {card.descricao && <AlignLeft className="h-3.5 w-3.5" aria-label="Tem descrição" />}
          <span className="ml-auto">
            <Avatar quem={card.quem} tamanho={22} />
          </span>
        </div>
      )}
      {total > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-linha-suave">
          <div className="h-full rounded-full bg-entrada/80" style={{ width: `${(feitos / total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

// ---------------- Coluna: renomear, ordem, apagar ----------------

function ColunaForm({
  coluna,
  colunas,
  qtdCards,
  aoFechar,
}: {
  coluna: ColunaQuadro | null;
  colunas: ColunaQuadro[];
  qtdCards: number;
  aoFechar: () => void;
}) {
  const { recarregar } = useApp();
  const [nome, setNome] = useState(coluna?.nome || "");
  const [concluida, setConcluida] = useState(coluna?.concluida || false);
  const idx = coluna ? colunas.findIndex((c) => c.id === coluna.id) : -1;

  async function salvar() {
    if (!nome.trim()) return avisar("Dê um nome à coluna.", "aviso");
    const ok = coluna
      ? await db.atualizar("quadro_colunas", coluna.id, { nome: nome.trim(), concluida })
      : await db.inserir("quadro_colunas", {
          nome: nome.trim(),
          concluida,
          ordem: ordemEntre(colunas[colunas.length - 1]?.ordem),
        });
    if (!ok) return;
    await recarregar();
    aoFechar();
  }

  async function mover(dir: -1 | 1) {
    if (!coluna) return;
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= colunas.length) return;
    const vizinhos = colunas.filter((c) => c.id !== coluna.id);
    const ordem = ordemEntre(vizinhos[alvo - 1]?.ordem, vizinhos[alvo]?.ordem);
    if (await db.atualizar("quadro_colunas", coluna.id, { ordem })) await recarregar();
  }

  async function apagar() {
    if (!coluna) return;
    if (qtdCards > 0)
      return avisar(`Mova os ${qtdCards} card${qtdCards > 1 ? "s" : ""} desta coluna antes de apagá-la.`, "aviso");
    if (!(await confirmar(`Apagar a coluna "${coluna.nome}"?`))) return;
    if (await db.remover("quadro_colunas", coluna.id)) {
      await recarregar();
      aoFechar();
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo={coluna ? "Coluna" : "Nova coluna"}
      rodape={
        <div className="flex gap-2">
          {coluna && (
            <Botao variante="perigo" onClick={apagar}>
              Apagar
            </Botao>
          )}
          <Botao className="flex-1" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" className="flex-1" onClick={salvar}>
            Salvar
          </Botao>
        </div>
      }
    >
      <div className="space-y-5">
        <Campo rotulo="Nome">
          <Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Esperando orçamento" autoFocus onKeyDown={(e) => e.key === "Enter" && salvar()} />
        </Campo>
        <Alternar ligado={concluida} aoMudar={setConcluida} rotulo="Cards aqui contam como concluídos" />
        {coluna && colunas.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm text-suave">Posição no quadro</span>
            <Botao tamanho="sm" onClick={() => mover(-1)} disabled={idx <= 0} icone={<ChevronLeft className="h-4 w-4" />}>
              Esquerda
            </Botao>
            <Botao tamanho="sm" onClick={() => mover(1)} disabled={idx >= colunas.length - 1} icone={<ChevronRight className="h-4 w-4" />}>
              Direita
            </Botao>
          </div>
        )}
      </div>
    </Folha>
  );
}
