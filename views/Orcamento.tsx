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
  // Média dos 3 meses anteriores; se o app tem menos de 3 meses de dados, divide só pelos que têm
  const { media3, mesesMedia } = useMemo(() => {
    const meses = ultimosMeses(somarMeses(mes, -1), 3).filter(
      (mm) => doMes(dados.transacoes, mm).length > 0,
    );
    const m = new Map<string, number>();
    for (const mm of meses)
      for (const t of despesasReais(doMes(dados.transacoes, mm), cats))
        m.set(t.categoria, (m.get(t.categoria) || 0) + t.valor / meses.length);
    return { media3: m, mesesMedia: meses.length };
  }, [dados.transacoes, mes, cats]);

  const ehAtual = mes === mesAtual();
  const fracaoMes = ehAtual
    ? Number(hojeISO().slice(8, 10)) /
      diasNoMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)))
    : 1;

  // Referência de cada categoria: o limite definido ou, sem limite, a média dos últimos meses
  const linhas = categorias
    .map((c) => {
      const media = media3.get(c.nome) || 0;
      const ref = c.orcamento || (media >= 1 ? media : 0);
      return {
        ...c,
        gasto: gasto.get(c.nome) || 0,
        media,
        ref,
        pelaMedia: !c.orcamento && ref > 0,
      };
    })
    .sort(
      (a, b) =>
        Number(b.ref > 0) - Number(a.ref > 0) ||
        (a.ref && b.ref ? b.gasto / b.ref - a.gasto / a.ref : 0) ||
        b.gasto - a.gasto,
    );
  const comRef = linhas.filter((l) => l.ref > 0);
  const totalRef = comRef.reduce((a, l) => a + l.ref, 0);
  const totalDefinido = comRef.filter((l) => !l.pelaMedia).reduce((a, l) => a + l.ref, 0);
  const totalGastoComRef = comRef.reduce((a, l) => a + l.gasto, 0);
  const nomesComRef = new Set(comRef.map((l) => l.nome));
  const semReferencia = [...gasto.entries()]
    .filter(([n]) => !nomesComRef.has(n))
    .reduce((a, [, v]) => a + v, 0);
  const estouradas = comRef.filter((l) => l.gasto > l.ref);
  const esperadoHoje = totalRef * fracaoMes;

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
          <p className="text-[13px] text-fraco">Gasto no mês</p>
          <p className="display num mt-1 text-3xl font-semibold">
            {dinheiro(totalGastoComRef)}
          </p>
          <p className="num text-sm text-suave">
            de {dinheiro(totalRef)}
            {totalRef > 0 &&
              (totalDefinido === 0
                ? " pela média"
                : totalDefinido < totalRef
                  ? ` (${dinheiro(totalDefinido)} em limites, o resto pela média)`
                  : " planejados")}
          </p>
          {totalRef > 0 && (
            <div className="mt-2">
              <Barra
                valor={totalGastoComRef}
                max={totalRef}
                cor="#ece6d8"
                marca={ehAtual ? esperadoHoje : undefined}
              />
            </div>
          )}
        </div>
        <div>
          <p className="text-[13px] text-fraco">
            {ehAtual ? "Até hoje, pelo ritmo" : "Resultado do mês"}
          </p>
          <p
            className={cx(
              "display num mt-1 text-3xl font-semibold",
              totalRef === 0
                ? "text-suave"
                : (ehAtual ? totalGastoComRef > esperadoHoje : totalGastoComRef > totalRef)
                  ? "text-saida"
                  : "text-entrada",
            )}
          >
            {totalRef === 0
              ? "—"
              : ehAtual
                ? `${totalGastoComRef > esperadoHoje ? "+" : "−"}${dinheiro(Math.abs(totalGastoComRef - esperadoHoje))}`
                : `${totalGastoComRef > totalRef ? "+" : "−"}${dinheiro(Math.abs(totalGastoComRef - totalRef))}`}
          </p>
          <p className="num text-sm text-suave">
            {totalRef === 0
              ? "Sem limites nem histórico ainda"
              : ehAtual
                ? `${totalGastoComRef > esperadoHoje ? "acima" : "abaixo"} do esperado para o dia ${Number(hojeISO().slice(8, 10))} (${dinheiro(esperadoHoje)})`
                : totalGastoComRef > totalRef
                  ? "acima da referência"
                  : "abaixo da referência"}
            {semReferencia > 0 && ` · ${dinheiro(semReferencia)} em categorias novas, sem média`}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-fraco">Situação</p>
          <p
            className={cx(
              "display mt-1 text-3xl font-semibold",
              estouradas.length ? "text-saida" : "text-entrada",
            )}
          >
            {totalRef === 0
              ? "—"
              : estouradas.length
                ? `${estouradas.length} acima`
                : "Tudo dentro"}
          </p>
          <p className="text-sm text-suave">
            {estouradas.map((e) => e.nome).join(", ") ||
              (totalRef
                ? "Nenhuma categoria passou da referência"
                : "Defina limites abaixo")}
          </p>
        </div>
      </section>

      <Painel
        titulo="Limite por categoria"
        sub={
          (ehAtual
            ? "A marca na barra mostra até onde o gasto deveria ir hoje, se fosse distribuído pelo mês."
            : `Referências aplicadas a ${nomeMes(mes)}.`) +
          (mesesMedia
            ? ` Sem limite definido, vale a média ${mesesMedia === 1 ? "do mês anterior" : `dos últimos ${mesesMedia} meses`}.`
            : "")
        }
        acao={
          editando ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Botao
                tamanho="sm"
                variante="fantasma"
                title="Coloca a média (arredondada para cima, de 10 em 10) nas categorias ainda sem limite"
                onClick={() =>
                  setRascunho((r) => {
                    const n = { ...r };
                    for (const l of linhas)
                      if (!n[l.id]?.trim() && l.media >= 1)
                        n[l.id] = valorParaCampo(Math.ceil(l.media / 10) * 10);
                    return n;
                  })
                }
              >
                Preencher com a média
              </Botao>
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
                        placeholder={l.media >= 1 ? `média ${valorParaCampo(Math.round(l.media))}` : "sem limite"}
                        className="num h-9 w-28 bg-transparent px-2 text-right text-sm text-texto placeholder:text-fraco focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="num shrink-0 text-sm text-suave">
                    <span
                      className={cx(
                        l.ref && l.gasto > l.ref ? "text-saida" : "text-texto",
                      )}
                    >
                      {dinheiro(l.gasto)}
                    </span>
                    {l.ref ? <> de {dinheiro(l.ref)}</> : null}
                  </span>
                )}
              </div>
              {!editando && (
                <div className="mt-2">
                  {l.ref ? (
                    <>
                      <Barra
                        valor={l.gasto}
                        max={l.ref}
                        cor={l.cor}
                        marca={ehAtual ? l.ref * fracaoMes : undefined}
                      />
                      <p className="num mt-1.5 text-[12.5px] text-fraco">
                        {l.gasto <= l.ref
                          ? `Restam ${dinheiro(l.ref - l.gasto)}`
                          : `Passou ${dinheiro(l.gasto - l.ref)}`}
                        {l.pelaMedia
                          ? " · pela média (sem limite definido)"
                          : l.media > 0 && ` · média ${dinheiro(l.media)}`}
                      </p>
                    </>
                  ) : (
                    <p className="num text-[12.5px] text-fraco">
                      Sem limite e sem gastos nos meses anteriores
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
