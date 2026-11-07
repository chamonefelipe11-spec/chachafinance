"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/contexto";
import { Barra, Botao, MesNavegador, Painel, Ponto, cx } from "@/components/ui";
import { agrupar, despesasReais, doMes, ultimosMeses } from "@/lib/finance";
import {
  diasNoMes,
  dinheiro,
  hojeISO,
  lerValor,
  mesAtual,
  nomeMes,
  somarMeses,
  valorParaCampo,
} from "@/lib/format";
import { db } from "@/lib/store";
import { avisar } from "@/lib/toast";

export default function Orcamento() {
  const { dados, cats, mes, setMes, recarregar, faltando } = useApp();
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const categorias = dados.categorias.filter(
    (c) => c.tipo === "despesa" && c.ativo,
  );
  const gasto = useMemo(
    () =>
      new Map(
        agrupar(
          despesasReais(doMes(dados.transacoes, mes), cats),
          (t) => t.categoria,
          () => "",
        ).map((f) => [f.nome, f.valor]),
      ),
    [dados.transacoes, mes, cats],
  );
  const media3 = useMemo(() => {
    const meses = ultimosMeses(somarMeses(mes, -1), 3);
    const m = new Map<string, number>();
    for (const mm of meses)
      for (const t of despesasReais(doMes(dados.transacoes, mm), cats))
        m.set(t.categoria, (m.get(t.categoria) || 0) + t.valor / 3);
    return m;
  }, [dados.transacoes, mes, cats]);

  const ehAtual = mes === mesAtual();
  const fracaoMes = ehAtual
    ? Number(hojeISO().slice(8, 10)) /
      diasNoMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)))
    : 1;

  const linhas = categorias
    .map((c) => ({
      ...c,
      gasto: gasto.get(c.nome) || 0,
      media: media3.get(c.nome) || 0,
    }))
    .sort(
      (a, b) =>
        Number(!!b.orcamento) - Number(!!a.orcamento) || b.gasto - a.gasto,
    );
  const totalLimite = linhas.reduce((a, l) => a + (l.orcamento || 0), 0);
  const totalGastoOrcado = linhas
    .filter((l) => l.orcamento)
    .reduce((a, l) => a + Math.min(l.gasto, Infinity), 0);
  const foraOrcamento = [...gasto.entries()]
    .filter(([n]) => !cats.get(n)?.orcamento)
    .reduce((a, [, v]) => a + v, 0);
  const estouradas = linhas.filter((l) => l.orcamento && l.gasto > l.orcamento);

  function comecar() {
    if (faltando.includes("categorias"))
      return avisar(
        "Rode a migração do Supabase para salvar orçamentos.",
        "erro",
      );
    setRascunho(
      Object.fromEntries(
        categorias.map((c) => [c.id, valorParaCampo(c.orcamento)]),
      ),
    );
    setEditando(true);
  }

  async function salvar() {
    setSalvando(true);
    const mudancas = categorias.filter((c) => {
      const novo = rascunho[c.id]?.trim() ? lerValor(rascunho[c.id]) : null;
      return (novo || null) !== (c.orcamento || null);
    });
    const ok = (
      await Promise.all(
        mudancas.map((c) => {
          const v = rascunho[c.id]?.trim() ? lerValor(rascunho[c.id]) : null;
          return db.atualizar("categorias", c.id, {
            orcamento: v && v > 0 ? v : null,
          });
        }),
      )
    ).every(Boolean);
    setSalvando(false);
    if (ok) {
      avisar("Orçamento salvo.");
      setEditando(false);
      recarregar();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[28px] font-semibold md:text-[34px]">
          Orçamento
        </h1>
        <MesNavegador mes={mes} aoMudar={setMes} />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[13px] text-fraco">
            Gasto nas categorias com limite
          </p>
          <p className="display num mt-1 text-3xl font-semibold">
            {dinheiro(totalGastoOrcado)}
          </p>
          <p className="num text-sm text-suave">
            de {dinheiro(totalLimite)} planejados
          </p>
        </div>
        <div>
          <p className="text-[13px] text-fraco">Fora do orçamento</p>
          <p className="display num mt-1 text-3xl font-semibold text-suave">
            {dinheiro(foraOrcamento)}
          </p>
          <p className="text-sm text-suave">em categorias sem limite</p>
        </div>
        <div>
          <p className="text-[13px] text-fraco">Situação</p>
          <p
            className={cx(
              "display mt-1 text-3xl font-semibold",
              estouradas.length ? "text-saida" : "text-entrada",
            )}
          >
            {totalLimite === 0
              ? "—"
              : estouradas.length
                ? `${estouradas.length} estourada${estouradas.length > 1 ? "s" : ""}`
                : "Dentro do plano"}
          </p>
          <p className="text-sm text-suave">
            {estouradas.map((e) => e.nome).join(", ") ||
              (totalLimite
                ? "Nenhuma categoria passou do limite"
                : "Defina limites abaixo")}
          </p>
        </div>
      </section>

      <Painel
        titulo="Limite por categoria"
        sub={
          ehAtual
            ? "A marca na barra mostra até onde o gasto deveria ir hoje, se fosse distribuído pelo mês."
            : `Limites aplicados a ${nomeMes(mes)}.`
        }
        acao={
          editando ? (
            <div className="flex gap-2">
              <Botao
                tamanho="sm"
                variante="fantasma"
                onClick={() => setEditando(false)}
              >
                Cancelar
              </Botao>
              <Botao
                tamanho="sm"
                variante="primario"
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? "Salvando…" : "Salvar limites"}
              </Botao>
            </div>
          ) : (
            <Botao tamanho="sm" onClick={comecar}>
              Editar limites
            </Botao>
          )
        }
      >
        <ul className="divide-y divide-linha-suave">
          {linhas.map((l) => (
            <li key={l.id} className="py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[15px] text-texto">
                  <Ponto cor={l.cor} />
                  <span className="truncate">{l.nome}</span>
                </span>
                {editando ? (
                  <div className="flex items-center gap-2">
                    <span className="hidden text-xs text-fraco sm:inline">
                      média {dinheiro(l.media)}
                    </span>
                    <div className="flex items-center rounded-lg border border-linha bg-campo pl-2.5">
                      <span className="text-sm text-fraco">R$</span>
                      <input
                        inputMode="decimal"
                        aria-label={`Limite de ${l.nome}`}
                        value={rascunho[l.id] ?? ""}
                        onChange={(e) =>
                          setRascunho((r) => ({ ...r, [l.id]: e.target.value }))
                        }
                        placeholder="sem limite"
                        className="num h-9 w-28 bg-transparent px-2 text-right text-sm text-texto placeholder:text-fraco focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="num shrink-0 text-sm text-suave">
                    <span
                      className={cx(
                        l.orcamento && l.gasto > l.orcamento
                          ? "text-saida"
                          : "text-texto",
                      )}
                    >
                      {dinheiro(l.gasto)}
                    </span>
                    {l.orcamento ? <> de {dinheiro(l.orcamento)}</> : null}
                  </span>
                )}
              </div>
              {!editando && (
                <div className="mt-2">
                  {l.orcamento ? (
                    <>
                      <Barra
                        valor={l.gasto}
                        max={l.orcamento}
                        cor={l.cor}
                        marca={ehAtual ? l.orcamento * fracaoMes : undefined}
                      />
                      <p className="num mt-1.5 text-[12.5px] text-fraco">
                        {l.gasto <= l.orcamento
                          ? `Restam ${dinheiro(l.orcamento - l.gasto)}`
                          : `Passou ${dinheiro(l.gasto - l.orcamento)}`}
                        {l.media > 0 &&
                          ` · média dos últimos 3 meses ${dinheiro(l.media)}`}
                      </p>
                    </>
                  ) : (
                    <p className="num text-[12.5px] text-fraco">
                      Sem limite
                      {l.media > 0 &&
                        ` · média dos últimos 3 meses ${dinheiro(l.media)}`}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Painel>
    </div>
  );
}
