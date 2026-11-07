"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  CreditCard,
  GraduationCap,
  Plus,
} from "lucide-react";
import { useApp } from "@/components/contexto";
import {
  Avatar,
  Botao,
  Cabecalho,
  Chip,
  Painel,
  Vazio,
  cx,
} from "@/components/ui";
import {
  cartaoConfigurado,
  faturasDoCartao,
  provasMarcadas,
} from "@/lib/finance";
import { dataAmigavel, diffDias, dinheiro, hojeISO } from "@/lib/format";
import { COR_PESSOA } from "@/lib/defaults";
import { db } from "@/lib/store";
import type { Evento, Quem } from "@/lib/types";

type Item =
  | { tipo: "evento"; e: Evento }
  | { tipo: "fatura"; data: string; titulo: string; valor: number }
  | { tipo: "prova"; data: string; titulo: string; quem: Quem };

export default function Agenda() {
  const { dados, novoEvento, editarEvento, recarregar } = useApp();
  const [quem, setQuem] = useState<Quem | "todos">("todos");
  const [verConcluidos, setVerConcluidos] = useState(false);
  const hoje = hojeISO();

  const faturas = useMemo(() => {
    const r: Item[] = [];
    for (const c of dados.contas.filter(cartaoConfigurado)) {
      for (const f of faturasDoCartao(
        dados.transacoes,
        c,
        dados.faturasPagas,
      )) {
        if (
          f.status !== "paga" &&
          f.total > 0 &&
          f.vencimento >= hoje &&
          diffDias(hoje, f.vencimento) <= 45
        ) {
          r.push({
            tipo: "fatura",
            data: f.vencimento,
            titulo: `Vence a fatura do ${c.nome}`,
            valor: f.total,
          });
        }
      }
    }
    return r;
  }, [dados.contas, dados.transacoes, dados.faturasPagas, hoje]);

  const eventos = dados.eventos.filter(
    (e) => quem === "todos" || e.quem === quem || e.quem === "Ambos",
  );
  const pendentes = eventos.filter((e) => !e.concluido);
  const concluidos = eventos
    .filter((e) => e.concluido)
    .sort((a, b) => b.data.localeCompare(a.data));

  const grupos = (() => {
    const provas: Item[] = provasMarcadas(dados.disciplinas)
      .filter((p) => p.data >= hoje && (quem === "todos" || p.quem === quem))
      .map((p) => ({
        tipo: "prova" as const,
        data: p.data,
        titulo: p.titulo,
        quem: p.quem,
      }));
    const itens: Item[] = [
      ...pendentes.map((e) => ({ tipo: "evento" as const, e })),
      ...(quem === "todos" ? faturas : []),
      ...provas,
    ];
    const dataDe = (i: Item) => (i.tipo === "evento" ? i.e.data : i.data);
    itens.sort(
      (a, b) =>
        dataDe(a).localeCompare(dataDe(b)) ||
        (a.tipo === "evento" && b.tipo === "evento"
          ? (a.e.hora || "").localeCompare(b.e.hora || "")
          : 0),
    );
    const ordem = [
      "Atrasados",
      "Hoje",
      "Amanhã",
      "Próximos 7 dias",
      "Mais adiante",
    ];
    const m = new Map<string, Item[]>(ordem.map((o) => [o, []]));
    for (const i of itens) {
      const d = diffDias(hoje, dataDe(i));
      const g =
        d < 0
          ? "Atrasados"
          : d === 0
            ? "Hoje"
            : d === 1
              ? "Amanhã"
              : d <= 7
                ? "Próximos 7 dias"
                : "Mais adiante";
      m.get(g)!.push(i);
    }
    return [...m.entries()].filter(([, v]) => v.length);
  })();

  async function alternar(e: Evento) {
    if (await db.atualizar("agenda", e.id, { concluido: !e.concluido }))
      recarregar();
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Agenda"
        sub="Provas, contas a pagar e o que mais não pode passar. Vencimentos de fatura entram sozinhos."
        acoes={
          <Botao
            variante="primario"
            icone={<Plus className="h-4 w-4" />}
            onClick={() => novoEvento()}
          >
            Novo compromisso
          </Botao>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Chip ativo={quem === "todos"} onClick={() => setQuem("todos")}>
          Todos
        </Chip>
        {(["Chamone", "Letícia"] as Quem[]).map((p) => (
          <Chip
            key={p}
            ativo={quem === p}
            cor={COR_PESSOA[p]}
            onClick={() => setQuem(p)}
          >
            {p}
          </Chip>
        ))}
      </div>

      {grupos.length === 0 ? (
        <Painel>
          <Vazio
            titulo="Nada pela frente"
            texto="Adicione provas, consultas e contas com data para não esquecer."
            acao={<Botao onClick={() => novoEvento()}>Novo compromisso</Botao>}
          />
        </Painel>
      ) : (
        <div className="space-y-6">
          {grupos.map(([nome, itens]) => (
            <section key={nome}>
              <h2
                className={cx(
                  "mb-2 px-1 text-sm font-medium",
                  nome === "Atrasados" ? "text-saida" : "text-suave",
                )}
              >
                {nome}
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-linha-suave bg-painel">
                {itens.map((i, idx) =>
                  i.tipo === "evento" ? (
                    <LinhaEvento
                      key={i.e.id}
                      e={i.e}
                      aoAlternar={() => alternar(i.e)}
                      aoEditar={() => editarEvento(i.e)}
                      mostrarData={nome !== "Hoje" && nome !== "Amanhã"}
                    />
                  ) : i.tipo === "prova" ? (
                    <li
                      key={`p${idx}`}
                      className="flex items-center gap-3 border-b border-linha-suave px-4 py-3 last:border-0"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                        <GraduationCap className="h-4 w-4 text-fraco" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px]">{i.titulo}</p>
                        <p className="text-[12.5px] text-fraco">
                          {dataAmigavel(i.data)} · Faculdade
                        </p>
                      </div>
                      <Avatar quem={i.quem} tamanho={22} />
                    </li>
                  ) : (
                    <li
                      key={`f${idx}`}
                      className="flex items-center gap-3 border-b border-linha-suave px-4 py-3 last:border-0"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                        <CreditCard className="h-4 w-4 text-fraco" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px]">{i.titulo}</p>
                        <p className="text-[12.5px] text-fraco">
                          {dataAmigavel(i.data)}
                        </p>
                      </div>
                      <span className="num text-sm text-suave">
                        {dinheiro(i.valor)}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}

      {concluidos.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setVerConcluidos(!verConcluidos)}
            className="flex cursor-pointer items-center gap-1.5 px-1 text-sm text-fraco hover:text-suave"
          >
            <ChevronDown
              className={cx(
                "h-4 w-4 transition-transform",
                !verConcluidos && "-rotate-90",
              )}
            />
            Concluídos ({concluidos.length})
          </button>
          {verConcluidos && (
            <ul className="mt-2 overflow-hidden rounded-2xl border border-linha-suave bg-painel">
              {concluidos.slice(0, 30).map((e) => (
                <LinhaEvento
                  key={e.id}
                  e={e}
                  aoAlternar={() => alternar(e)}
                  aoEditar={() => editarEvento(e)}
                  mostrarData
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function LinhaEvento({
  e,
  aoAlternar,
  aoEditar,
  mostrarData,
}: {
  e: Evento;
  aoAlternar: () => void;
  aoEditar: () => void;
  mostrarData: boolean;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-linha-suave px-4 py-3 last:border-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={e.concluido}
        aria-label={e.concluido ? "Marcar como pendente" : "Marcar como feito"}
        onClick={aoAlternar}
        className={cx(
          "flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors",
          e.concluido
            ? "border-transparent bg-entrada/80 text-[#14261c]"
            : "border-[#4a5263] hover:border-suave",
        )}
      >
        {e.concluido && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>
      <button
        type="button"
        onClick={aoEditar}
        className="min-w-0 flex-1 cursor-pointer text-left"
      >
        <p
          className={cx(
            "truncate text-[15px]",
            e.concluido && "text-fraco line-through",
          )}
        >
          {e.titulo}
        </p>
        <p className="truncate text-[12.5px] text-fraco">
          {[
            mostrarData ? dataAmigavel(e.data) : null,
            e.hora ? e.hora.slice(0, 5) : null,
            e.categoria,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </button>
      <Avatar quem={e.quem} tamanho={22} />
    </li>
  );
}
