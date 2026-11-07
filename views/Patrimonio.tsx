"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/components/contexto";
import {
  Botao,
  Cabecalho,
  Campo,
  Entrada,
  Folha,
  Painel,
  Ponto,
  Vazio,
  cx,
} from "@/components/ui";
import {
  AJUSTE,
  patrimonio,
  saldoConta,
  temSaldo,
  ultimosMeses,
} from "@/lib/finance";
import {
  cap,
  dataBR,
  diasNoMes,
  dinheiro,
  hojeISO,
  lerValor,
  mesAtual,
  rotuloMesCurto,
  valoresOcultos,
  valorParaCampo,
} from "@/lib/format";
import { COR_GRAFICO } from "@/lib/defaults";
import { db } from "@/lib/store";
import { avisar } from "@/lib/toast";
import type { Conta, TipoConta } from "@/lib/types";

const TITULO: Record<TipoConta, string> = {
  corrente: "Contas",
  investimento: "Investimentos",
  beneficio: "Vales",
  credito: "Cartões (fatura em aberto)",
};
const eixo = {
  tick: { fill: "#8a90a0", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;
const fimDoMes = (m: string) =>
  m === mesAtual()
    ? hojeISO()
    : `${m}-${String(diasNoMes(Number(m.slice(0, 4)), Number(m.slice(5, 7)))).padStart(2, "0")}`;

export default function Patrimonio() {
  const { dados, cats, faltando } = useApp();
  const [editando, setEditando] = useState<{
    conta: Conta;
    modo: "inicial" | "ajuste";
  } | null>(null);
  const contas = dados.contas.filter((c) => c.ativo || temSaldo(c));
  const hoje = patrimonio(contas, dados.transacoes, cats);
  const semSaldo = contas.filter((c) => !temSaldo(c));

  const todos = ultimosMeses(mesAtual(), 12).map((m) => {
    const fim = fimDoMes(m);
    const algum = contas.some(
      (c) => c.saldo_inicial_em && c.saldo_inicial_em <= fim,
    );
    return {
      mes: cap(rotuloMesCurto(m)),
      valor: algum
        ? patrimonio(contas, dados.transacoes, cats, fim).total
        : null,
    };
  });
  // Começa no primeiro mês que já tem saldo informado
  const serie = todos.slice(
    Math.max(
      0,
      todos.findIndex((s) => s.valor !== null),
    ),
  );
  const comSerie = serie.filter((s) => s.valor !== null).length > 1;

  if (faltando.includes("recorrencias")) {
    return (
      <div>
        <Cabecalho titulo="Patrimônio" />
        <Painel>
          <Vazio
            titulo="Falta rodar o SQL da v3"
            texto="Rode supabase/fase2a5.sql no SQL Editor do Supabase para guardar o saldo de cada conta."
          />
        </Painel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Patrimônio"
        sub="Saldo de cada conta calculado a partir do saldo inicial e dos lançamentos."
      />

      <section>
        <p className="text-[15px] text-suave">Vocês têm hoje</p>
        <p
          className={cx(
            "display num mt-1 text-[48px] leading-tight font-semibold md:text-[64px]",
            hoje.total < 0 && "text-saida",
          )}
        >
          {dinheiro(hoje.total)}
        </p>
        <div className="mt-4 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            ["corrente", "investimento", "beneficio", "credito"] as TipoConta[]
          ).map((t) => (
            <div key={t}>
              <p className="text-[13px] text-fraco">{TITULO[t]}</p>
              <p
                className={cx(
                  "num text-lg font-medium",
                  t === "credito" && hoje.porTipo[t] < 0 && "text-saida",
                  t === "investimento" && "text-investe",
                )}
              >
                {dinheiro(hoje.porTipo[t])}
              </p>
            </div>
          ))}
        </div>
      </section>

      {comSerie && (
        <Painel titulo="Patrimônio no fim de cada mês">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={serie}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#262a33" />
                <XAxis dataKey="mes" {...eixo} />
                <YAxis
                  {...eixo}
                  width={56}
                  tickFormatter={(v: number) =>
                    valoresOcultos()
                      ? ""
                      : `${Math.round(v / 1000).toLocaleString("pt-BR")} mil`
                  }
                />
                <Tooltip
                  cursor={{ stroke: "#3a404d" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-linha bg-elevado px-3 py-2 text-[13px] shadow-xl">
                        <p className="text-suave">{label}</p>
                        <p className="num text-texto">
                          {dinheiro(Number(payload[0].value))}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke={COR_GRAFICO.investe}
                  strokeWidth={2}
                  dot={{
                    r: 4,
                    fill: COR_GRAFICO.investe,
                    stroke: "#1b1e25",
                    strokeWidth: 2,
                  }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Painel>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(
          ["corrente", "investimento", "beneficio", "credito"] as TipoConta[]
        ).map((tipo) => {
          const lista = contas.filter((c) => c.tipo === tipo);
          if (!lista.length) return null;
          return (
            <Painel key={tipo} titulo={TITULO[tipo]} corpo={false}>
              <ul className="px-3 pt-1 pb-3">
                {lista.map((c) => {
                  const s = saldoConta(c, dados.transacoes, cats);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5"
                    >
                      <Ponto cor={c.cor} tamanho={10} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px]">{c.nome}</p>
                        <p className="text-[12.5px] text-fraco">
                          {s === null
                            ? "Sem saldo inicial"
                            : `desde ${dataBR(c.saldo_inicial_em!)}`}
                        </p>
                      </div>
                      {s === null ? (
                        <Botao
                          tamanho="sm"
                          onClick={() =>
                            setEditando({ conta: c, modo: "inicial" })
                          }
                        >
                          Informar saldo
                        </Botao>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setEditando({ conta: c, modo: "ajuste" })
                          }
                          className="cursor-pointer rounded-lg px-2 py-1 text-right hover:bg-elevado"
                          title="Conferir com o banco"
                        >
                          <span
                            className={cx(
                              "num block text-[15px] font-medium",
                              s < 0 && "text-saida",
                            )}
                          >
                            {dinheiro(s)}
                          </span>
                          <span className="block text-[11.5px] text-fraco">
                            conferir
                          </span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Painel>
          );
        })}
      </div>

      {semSaldo.length > 0 && (
        <p className="text-sm text-fraco">
          {semSaldo.length}{" "}
          {semSaldo.length === 1
            ? "conta ainda não entra"
            : "contas ainda não entram"}{" "}
          no total. Informe o saldo de hoje em cada uma, olhando o app do banco.
        </p>
      )}

      {editando && (
        <SaldoForm
          key={editando.conta.id + editando.modo}
          {...editando}
          aoFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function SaldoForm({
  conta,
  modo,
  aoFechar,
}: {
  conta: Conta;
  modo: "inicial" | "ajuste";
  aoFechar: () => void;
}) {
  const { dados, cats, recarregar } = useApp();
  const atual = saldoConta(conta, dados.transacoes, cats);
  const [valor, setValor] = useState(
    modo === "ajuste" ? valorParaCampo(atual) : "",
  );
  const [data, setData] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);
  const credito = conta.tipo === "credito";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    let v = lerValor(valor);
    if (!Number.isFinite(v)) return avisar("Digite o saldo.", "erro");
    if (credito && v > 0) v = -v; // fatura em aberto é dívida
    setSalvando(true);
    let ok: boolean;
    if (modo === "inicial") {
      ok = await db.atualizar("contas", conta.id, {
        saldo_inicial: v,
        saldo_inicial_em: data,
      });
    } else {
      const dif = Math.round((v - (atual || 0)) * 100) / 100;
      if (Math.abs(dif) < 0.01) {
        setSalvando(false);
        avisar("O saldo já bate com o banco.");
        return aoFechar();
      }
      ok = await db.inserir("financas", {
        descricao:
          conta.tipo === "investimento" && dif > 0
            ? `Rendimento ${conta.nome}`
            : `Ajuste de saldo ${conta.nome}`,
        valor: Math.abs(dif),
        tipo: "transferencia",
        categoria: "Transferência",
        cartao: dif > 0 ? AJUSTE : conta.nome,
        conta_destino: dif > 0 ? conta.nome : AJUSTE,
        quem: "Ambos",
        tipo_gasto: "Variável",
        data: hojeISO(),
        parcela_atual: 1,
        total_parcelas: 1,
      });
    }
    setSalvando(false);
    if (ok) {
      avisar(modo === "inicial" ? "Saldo inicial salvo." : "Saldo ajustado.");
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo={conta.nome}
      rodape={
        <Botao
          variante="primario"
          tamanho="lg"
          className="w-full"
          type="submit"
          form="form-saldo"
          disabled={salvando}
        >
          {modo === "inicial" ? "Salvar saldo" : "Ajustar saldo"}
        </Botao>
      }
    >
      <form id="form-saldo" onSubmit={salvar} className="space-y-4">
        {modo === "ajuste" && (
          <p className="text-sm text-suave">
            Pelo app, o saldo é{" "}
            <span className="num text-texto">{dinheiro(atual || 0)}</span>.
            Digite o valor que aparece no banco: a diferença vira um ajuste que
            não conta como gasto nem renda
            {conta.tipo === "investimento" ? " (na XP, é o rendimento)" : ""}.
          </p>
        )}
        <div
          className={cx(
            "grid gap-3",
            modo === "inicial" ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          <Campo
            rotulo={credito ? "Fatura em aberto (R$)" : "Saldo (R$)"}
            dica={
              credito ? "Tudo o que ainda não foi pago no cartão." : undefined
            }
          >
            <Entrada
              autoFocus
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </Campo>
          {modo === "inicial" && (
            <Campo
              rotulo="Saldo do fim do dia"
              dica="Só lançamentos depois desse dia mexem no saldo."
            >
              <Entrada
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </Campo>
          )}
        </div>
      </form>
    </Folha>
  );
}
