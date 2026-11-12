"use client";

import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useApp } from "@/components/contexto";
import {
  AreaTexto,
  Botao,
  BotaoIcone,
  Campo,
  Chip,
  Entrada,
  Folha,
  Segmentado,
  Seletor,
  confirmar,
  cx,
} from "@/components/ui";
import { COR_PESSOA } from "@/lib/defaults";
import { dinheiro, gerarId, lerValor, valorParaCampo } from "@/lib/format";
import { corEtiqueta, etiquetasDisponiveis, gastoDoCard } from "@/lib/projetos";
import { db } from "@/lib/store";
import { avisar } from "@/lib/toast";
import type { Card, ColunaQuadro, ItemChecklist, Quem } from "@/lib/types";

export interface InicialCard {
  coluna_id?: string;
  quem?: Quem;
  etiqueta?: string | null;
  inicio?: string | null;
  prazo?: string | null;
}

export default function CardForm({
  editando,
  inicial,
  colunas,
  cards,
  aoFechar,
}: {
  editando: Card | null;
  inicial?: InicialCard;
  colunas: ColunaQuadro[];
  cards: Card[];
  aoFechar: () => void;
}) {
  const { dados, cats, recarregar } = useApp();
  const base = editando;
  const [titulo, setTitulo] = useState(base?.titulo || "");
  const [descricao, setDescricao] = useState(base?.descricao || "");
  const [colunaId, setColunaId] = useState(
    base?.coluna_id || inicial?.coluna_id || colunas[0]?.id || "",
  );
  const [quem, setQuem] = useState<Quem>(base?.quem || inicial?.quem || "Ambos");
  const [etiqueta, setEtiqueta] = useState<string>(base?.etiqueta ?? inicial?.etiqueta ?? "");
  const [outraEtiqueta, setOutraEtiqueta] = useState(false);
  const [inicio, setInicio] = useState(base?.inicio || inicial?.inicio || "");
  const [prazo, setPrazo] = useState(base?.prazo || inicial?.prazo || "");
  const [checklist, setChecklist] = useState<ItemChecklist[]>(base?.checklist || []);
  const [novoItem, setNovoItem] = useState("");
  const [categoria, setCategoria] = useState(base?.categoria || "");
  const [orcamento, setOrcamento] = useState(valorParaCampo(base?.orcamento));
  const [ligarGastos, setLigarGastos] = useState(!!base?.categoria);
  const [salvando, setSalvando] = useState(false);

  const etiquetas = etiquetasDisponiveis(cards);
  const categoriasDespesa = dados.categorias.filter((c) => c.tipo === "despesa" && c.ativo !== false);
  const datasInvalidas = !!inicio && !!prazo && inicio > prazo;
  const gasto = base ? gastoDoCard({ ...base, categoria: categoria || null, inicio: inicio || null }, dados.transacoes, cats) : null;

  function addItem() {
    const t = novoItem.trim();
    if (!t) return;
    setChecklist((l) => [...l, { id: gerarId(), texto: t, feito: false }]);
    setNovoItem("");
  }

  async function salvar() {
    if (!titulo.trim()) return avisar("Dê um título ao card.", "aviso");
    if (datasInvalidas) return avisar("O início precisa vir antes do prazo.", "aviso");
    const coluna = colunas.find((c) => c.id === colunaId);
    if (!coluna) return avisar("Escolha a coluna.", "aviso");
    const itens = novoItem.trim()
      ? [...checklist, { id: gerarId(), texto: novoItem.trim(), feito: false }]
      : checklist;
    const linha: Record<string, unknown> = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      coluna_id: colunaId,
      quem,
      etiqueta: etiqueta.trim() || null,
      inicio: inicio || null,
      prazo: prazo || null,
      checklist: itens,
      categoria: ligarGastos && categoria ? categoria : null,
      orcamento: ligarGastos && categoria && orcamento ? lerValor(orcamento) || null : null,
    };
    // Entrou numa coluna de "feito": marca quando foi concluído
    const estavaFeito = !!base && !!colunas.find((c) => c.id === base.coluna_id)?.concluida;
    linha.concluido_em = coluna.concluida
      ? estavaFeito && base?.concluido_em
        ? base.concluido_em
        : new Date().toISOString()
      : null;
    setSalvando(true);
    let ok: boolean;
    if (base) ok = await db.atualizar("cards", base.id, linha);
    else {
      const daColuna = cards.filter((c) => c.coluna_id === colunaId);
      linha.ordem = daColuna.length ? Math.max(...daColuna.map((c) => c.ordem)) + 1000 : 1000;
      ok = await db.inserir("cards", linha);
    }
    setSalvando(false);
    if (!ok) return;
    await recarregar();
    avisar(base ? "Card atualizado." : "Card criado.", "ok");
    aoFechar();
  }

  async function apagar() {
    if (!base) return;
    if (!(await confirmar("Apagar este card?", { texto: base.titulo }))) return;
    if (await db.remover("cards", base.id)) {
      await recarregar();
      avisar("Card apagado.", "ok");
      aoFechar();
    }
  }

  const feitos = checklist.filter((i) => i.feito).length;

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo={base ? "Editar card" : "Novo card"}
      largura="lg"
      rodape={
        <div className="flex gap-2">
          {base && (
            <Botao variante="perigo" onClick={apagar} icone={<Trash2 className="h-4 w-4" />} aria-label="Apagar card">
              <span className="hidden sm:inline">Apagar</span>
            </Botao>
          )}
          <Botao className="flex-1" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" className="flex-1" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
      }
    >
      <div className="space-y-5">
        <Campo rotulo="Título">
          <Entrada
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Reformar o banheiro"
            autoFocus={!base}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
          />
        </Campo>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo rotulo="Coluna">
            <Seletor value={colunaId} onChange={(e) => setColunaId(e.target.value)}>
              {colunas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Seletor>
          </Campo>
          <Campo rotulo="Responsável">
            <Segmentado<Quem>
              valor={quem}
              aoMudar={setQuem}
              opcoes={(["Chamone", "Letícia", "Ambos"] as Quem[]).map((q) => ({
                valor: q,
                rotulo: q === "Ambos" ? "Os dois" : q,
                cor: COR_PESSOA[q],
              }))}
            />
          </Campo>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-suave">Etiqueta</span>
          <div className="flex flex-wrap gap-2">
            <Chip ativo={!etiqueta && !outraEtiqueta} onClick={() => { setEtiqueta(""); setOutraEtiqueta(false); }}>
              Nenhuma
            </Chip>
            {etiquetas.map((e) => (
              <Chip
                key={e}
                ativo={!outraEtiqueta && etiqueta.toLowerCase() === e.toLowerCase()}
                cor={corEtiqueta(e)}
                onClick={() => { setEtiqueta(e); setOutraEtiqueta(false); }}
              >
                {e}
              </Chip>
            ))}
            <Chip ativo={outraEtiqueta} onClick={() => { setOutraEtiqueta(true); setEtiqueta(""); }}>
              <Plus className="h-3.5 w-3.5" /> Outra
            </Chip>
          </div>
          {outraEtiqueta && (
            <Entrada
              className="mt-2"
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="Nome da etiqueta (ex.: Casamento)"
              autoFocus
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Início">
            <Entrada type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo rotulo="Prazo">
            <Entrada type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </Campo>
        </div>
        {datasInvalidas && <p className="-mt-3 text-[13px] text-saida">O início está depois do prazo.</p>}
        {(inicio || prazo) && (
          <button
            type="button"
            className="-mt-3 cursor-pointer text-[13px] text-fraco hover:text-suave"
            onClick={() => { setInicio(""); setPrazo(""); }}
          >
            Limpar datas
          </button>
        )}

        <Campo rotulo="Descrição">
          <AreaTexto
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes, links, medidas…"
          />
        </Campo>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-suave">Checklist</span>
            {checklist.length > 0 && (
              <span className="num text-[13px] text-fraco">
                {feitos}/{checklist.length}
              </span>
            )}
          </div>
          {checklist.length > 0 && (
            <ul className="mb-2 divide-y divide-linha-suave rounded-xl border border-linha-suave">
              {checklist.map((i) => (
                <li key={i.id} className="flex items-center gap-2 px-3 py-1.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={i.feito}
                    aria-label={i.texto}
                    onClick={() => setChecklist((l) => l.map((x) => (x.id === i.id ? { ...x, feito: !x.feito } : x)))}
                    className={cx(
                      "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border",
                      i.feito ? "border-entrada bg-entrada text-[#13241b]" : "border-linha",
                    )}
                  >
                    {i.feito && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </button>
                  <input
                    value={i.texto}
                    onChange={(e) => setChecklist((l) => l.map((x) => (x.id === i.id ? { ...x, texto: e.target.value } : x)))}
                    className={cx(
                      "min-w-0 flex-1 bg-transparent py-1 text-sm focus:outline-none",
                      i.feito ? "text-fraco line-through" : "text-texto",
                    )}
                  />
                  <BotaoIcone rotulo="Tirar item" className="h-7 w-7" onClick={() => setChecklist((l) => l.filter((x) => x.id !== i.id))}>
                    <X className="h-4 w-4" />
                  </BotaoIcone>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Entrada
              value={novoItem}
              onChange={(e) => setNovoItem(e.target.value)}
              placeholder="Novo item"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <Botao onClick={addItem} aria-label="Adicionar item" icone={<Plus className="h-4 w-4" />} />
          </div>
        </div>

        <div className="rounded-xl border border-linha-suave p-3.5">
          <button
            type="button"
            role="switch"
            aria-checked={ligarGastos}
            onClick={() => setLigarGastos(!ligarGastos)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 text-left text-sm text-texto"
          >
            <span>
              Acompanhar gastos
              <span className="block text-[13px] text-fraco">Soma o que for lançado numa categoria desde o início do card.</span>
            </span>
            <span className={cx("relative h-6 w-10 shrink-0 rounded-full transition-colors", ligarGastos ? "bg-papel" : "bg-linha")}>
              <span className={cx("absolute top-0.5 h-5 w-5 rounded-full transition-all", ligarGastos ? "left-[18px] bg-[#1a1b20]" : "left-0.5 bg-suave")} />
            </span>
          </button>
          {ligarGastos && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo rotulo="Categoria">
                <Seletor value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  <option value="">Escolha…</option>
                  {categoriasDespesa.map((c) => (
                    <option key={c.id} value={c.nome}>
                      {c.nome}
                    </option>
                  ))}
                </Seletor>
              </Campo>
              <Campo rotulo="Quanto pretende gastar" dica="Opcional">
                <Entrada inputMode="decimal" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} placeholder="R$ 0,00" />
              </Campo>
              {gasto !== null && categoria && (
                <p className="text-[13px] text-suave sm:col-span-2">
                  Já gasto: <span className="num text-texto">{dinheiro(gasto)}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Folha>
  );
}
