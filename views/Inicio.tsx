"use client";

import { useMemo } from "react";
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  Repeat,
  SquareKanban,
} from "lucide-react";
import { useApp, corCategoria } from "@/components/contexto";
import {
  Avatar,
  Barra,
  BarraDividida,
  Botao,
  MesNavegador,
  Painel,
  Ponto,
  Vazio,
  cx,
} from "@/components/ui";
import LinhaTransacao from "@/components/LinhaTransacao";
import {
  agrupar,
  cartaoConfigurado,
  custoPorPessoa,
  despesasReais,
  doMes,
  ehPrevisto,
  faturasDoCartao,
  patrimonio,
  projecaoMes,
  provasMarcadas,
  resumir,
  saldoCasal,
  temSaldo,
} from "@/lib/finance";
import {
  dataAmigavel,
  dinheiro,
  diffDias,
  hojeISO,
  mesAtual,
  nomeMes,
  somarDiasISO,
  somarMeses,
} from "@/lib/format";
import { db } from "@/lib/store";
import { COR_PESSOA } from "@/lib/defaults";

export default function Inicio() {
  const { dados, cats, mes, setMes, irPara, novaTransacao, recarregar } =
    useApp();
  const {
    transacoes,
    contas,
    faturasPagas,
    categorias,
    metas,
    eventos,
    acertos,
  } = dados;

  const doMesAtual = useMemo(() => doMes(transacoes, mes), [transacoes, mes]);
  const r = useMemo(() => resumir(doMesAtual, cats), [doMesAtual, cats]);
  const anterior = useMemo(
    () => resumir(doMes(transacoes, somarMeses(mes, -1)), cats),
    [transacoes, mes, cats],
  );
  const projecao = useMemo(
    () => projecaoMes(transacoes, cats, mes),
    [transacoes, cats, mes],
  );
  const custo = useMemo(
    () => custoPorPessoa(doMesAtual, cats),
    [doMesAtual, cats],
  );
  const casal = useMemo(
    () => saldoCasal(transacoes, acertos),
    [transacoes, acertos],
  );

  const hoje = hojeISO();
  const ehMesAtual = mes === mesAtual();
  const difDespesa = r.despesas - anterior.despesas;

  // Orçamento: categorias com limite; se não houver nenhum, mostra as maiores do mês
  const gastoPorCat = useMemo(
    () =>
      new Map(
        agrupar(
          despesasReais(doMesAtual, cats),
          (t) => t.categoria,
          () => "",
        ).map((f) => [f.nome, f.valor]),
      ),
    [doMesAtual, cats],
  );
  const comOrcamento = categorias.filter((c) => (c.orcamento || 0) > 0);
  const linhasOrcamento = (
    comOrcamento.length
      ? comOrcamento.map((c) => ({
          nome: c.nome,
          cor: c.cor,
          gasto: gastoPorCat.get(c.nome) || 0,
          limite: c.orcamento || 0,
        }))
      : [...gastoPorCat.entries()].map(([nome, gasto]) => ({
          nome,
          cor: corCategoria(cats, nome),
          gasto,
          limite: 0,
        }))
  )
    .sort(
      (a, b) =>
        (b.limite ? b.gasto / b.limite : 0) -
          (a.limite ? a.gasto / a.limite : 0) || b.gasto - a.gasto,
    )
    .slice(0, 5);
  const maiorGasto = Math.max(1, ...linhasOrcamento.map((l) => l.gasto));

  // Próximos 7 dias: faturas, contas fixas e agenda
  const limite = somarDiasISO(hoje, 7);
  const proximos = (() => {
    const itens: {
      data: string;
      titulo: string;
      detalhe: string;
      valor?: number;
      tipo: "fatura" | "fixa" | "evento" | "card";
    }[] = [];
    for (const c of contas.filter(cartaoConfigurado)) {
      for (const f of faturasDoCartao(transacoes, c, faturasPagas)) {
        if (
          f.status !== "paga" &&
          f.total > 0 &&
          f.vencimento >= hoje &&
          f.vencimento <= limite
        ) {
          itens.push({
            data: f.vencimento,
            titulo: `Fatura ${c.nome.replace(/^Cartão\s+/i, "")}`,
            detalhe: "Vencimento",
            valor: f.total,
            tipo: "fatura",
          });
        }
      }
    }
    for (const t of transacoes) {
      if (
        t.tipo === "despesa" &&
        (t.tipo_gasto === "Fixo" || t.status === "previsto") &&
        t.data > hoje &&
        t.data <= limite &&
        (t.status === "previsto" || !t.recorrencia_id)
      ) {
        itens.push({
          data: t.data,
          titulo: t.descricao,
          detalhe: t.cartao,
          valor: t.valor,
          tipo: "fixa",
        });
      }
    }
    for (const p of provasMarcadas(dados.disciplinas)) {
      if (p.data >= hoje && p.data <= limite)
        itens.push({
          data: p.data,
          titulo: p.titulo,
          detalhe: p.quem,
          tipo: "evento",
        });
    }
    for (const e of eventos) {
      if (!e.concluido && e.data >= hoje && e.data <= limite) {
        itens.push({
          data: e.data,
          titulo: e.titulo,
          detalhe: [e.hora?.slice(0, 5), e.categoria]
            .filter(Boolean)
            .join(" · "),
          tipo: "evento",
        });
      }
    }
    const feitas = new Set(
      dados.colunasQuadro.filter((k) => k.concluida).map((k) => k.id),
    );
    for (const c of dados.cards) {
      if (c.prazo && c.prazo >= hoje && c.prazo <= limite && !feitas.has(c.coluna_id))
        itens.push({
          data: c.prazo,
          titulo: c.titulo,
          detalhe: c.etiqueta ? `Prazo · ${c.etiqueta}` : "Prazo do card",
          tipo: "card",
        });
    }
    return itens.sort((a, b) => a.data.localeCompare(b.data)).slice(0, 7);
  })();

  const recentes = doMesAtual.slice(0, 8);
  const fixasDoMes = doMesAtual.filter(
    (t) => t.recorrencia_id && t.tipo === "despesa",
  );
  const aPagar = doMesAtual
    .filter((t) => ehPrevisto(t))
    .sort((a, b) => a.data.localeCompare(b.data));
  const comSaldo = dados.contas.some(temSaldo);
  const patri = comSaldo
    ? patrimonio(dados.contas, dados.transacoes, cats)
    : null;

  async function paguei(id: string) {
    if (await db.atualizar("financas", id, { status: "pago" })) recarregar();
  }
  const vazio = transacoes.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MesNavegador mes={mes} aoMudar={setMes} />
        <div className="hidden gap-2 md:flex">
          <Botao
            tamanho="sm"
            onClick={() => novaTransacao({ tipo: "receita" })}
          >
            + Receita
          </Botao>
          <Botao
            tamanho="sm"
            onClick={() => novaTransacao({ tipo: "despesa" })}
          >
            + Despesa
          </Botao>
        </div>
      </div>

      {/* Destaque: quanto sobrou */}
      <section className="pt-2 pb-2">
        <p className="text-[15px] text-suave">
          {r.saldo >= 0 ? "Sobrou" : "Faltou"} em {nomeMes(mes)}
        </p>
        <p
          className={cx(
            "display num mt-1 text-[52px] leading-[1.05] font-semibold md:text-[72px]",
            r.saldo < 0 && "text-saida",
          )}
        >
          {dinheiro(Math.abs(r.saldo))}
        </p>
        <div className="mt-5 grid max-w-xl grid-cols-3 gap-4">
          <Numero rotulo="Entrou" valor={r.receitas} cor="text-entrada" />
          <Numero rotulo="Saiu" valor={r.despesas} cor="text-texto" />
          <Numero
            rotulo="Investido"
            valor={r.aportes - r.resgates}
            cor="text-investe"
          />
        </div>
        {!vazio && (
          <div className="mt-4 space-y-1 text-sm text-suave">
            {anterior.despesas > 0 && (
              <p>
                {"Gastos "}
                <span
                  className={cx(
                    "num font-medium",
                    difDespesa <= 0 ? "text-entrada" : "text-saida",
                  )}
                >
                  {dinheiro(Math.abs(difDespesa))}{" "}
                  {difDespesa <= 0 ? "abaixo" : "acima"}
                </span>{" "}
                de {nomeMes(somarMeses(mes, -1))}.
              </p>
            )}
            {ehMesAtual && projecao !== null && r.despesas > 0 && (
              <p>
                No ritmo atual, o mês fecha com{" "}
                <span className="num font-medium text-texto">
                  {dinheiro(projecao)}
                </span>{" "}
                de gastos
                {r.receitas > 0 && (
                  <>
                    {" "}
                    e{" "}
                    <span
                      className={cx(
                        "num font-medium",
                        r.receitas - projecao >= 0
                          ? "text-entrada"
                          : "text-saida",
                      )}
                    >
                      {dinheiro(Math.abs(r.receitas - projecao))}{" "}
                      {r.receitas - projecao >= 0 ? "de sobra" : "no vermelho"}
                    </span>
                  </>
                )}
                .
              </p>
            )}
          </div>
        )}
      </section>

      {vazio ? (
        <Painel>
          <Vazio
            titulo="Nenhum lançamento ainda"
            texto="Comece registrando o salário do mês e as contas fixas; o resto do app se monta a partir disso."
            acao={
              <Botao variante="primario" onClick={() => novaTransacao()}>
                Registrar o primeiro
              </Botao>
            }
          />
        </Painel>
      ) : (
        <>
          {/* Divisão do casal */}
          <Painel
            titulo="Quanto pesou para cada um"
            sub="Gastos da conta conjunta contam meio a meio; despesas divididas entram na parte de quem deve."
            acao={
              <Botao
                variante="fantasma"
                tamanho="sm"
                onClick={() => irPara("casal")}
              >
                Acerto <ArrowRight className="h-3.5 w-3.5" />
              </Botao>
            }
          >
            <BarraDividida
              partes={[
                {
                  valor: custo.Chamone,
                  cor: COR_PESSOA.Chamone,
                  rotulo: "Chamone",
                },
                {
                  valor: custo["Letícia"],
                  cor: COR_PESSOA["Letícia"],
                  rotulo: "Letícia",
                },
              ]}
              altura={12}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-6">
                {(["Chamone", "Letícia"] as const).map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <Avatar quem={p} />
                    <div>
                      <p className="text-[13px] text-suave">{p}</p>
                      <p className="num text-[15px] font-medium">
                        {dinheiro(custo[p])}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {casal.devedor ? (
                <p className="rounded-xl bg-elevado px-3 py-2 text-sm text-suave">
                  <span className="text-texto">{casal.devedor}</span> deve{" "}
                  <span className="num font-medium text-texto">
                    {dinheiro(casal.valor)}
                  </span>{" "}
                  para <span className="text-texto">{casal.credor}</span>
                </p>
              ) : (
                <p className="text-sm text-fraco">
                  Contas acertadas entre vocês.
                </p>
              )}
            </div>
          </Painel>

          {(fixasDoMes.length > 0 || aPagar.length > 0 || patri) && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {(fixasDoMes.length > 0 || aPagar.length > 0) && (
                <Painel
                  titulo={`Contas fixas: ${fixasDoMes.length - fixasDoMes.filter(ehPrevisto).length} de ${fixasDoMes.length} pagas`}
                  acao={
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      onClick={() => irPara("contasfixas")}
                    >
                      Checklist <ArrowRight className="h-3.5 w-3.5" />
                    </Botao>
                  }
                >
                  {aPagar.length === 0 ? (
                    <p className="py-2 text-sm text-fraco">
                      Tudo pago neste mês.
                    </p>
                  ) : (
                    <ul className="divide-y divide-linha-suave">
                      {aPagar.slice(0, 5).map((t) => (
                        <li key={t.id} className="flex items-center gap-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px]">
                              {t.descricao}
                            </p>
                            <p
                              className={cx(
                                "text-[12.5px]",
                                t.data < hoje ? "text-saida" : "text-fraco",
                              )}
                            >
                              {t.tipo === "receita" ? "Recebe" : "Vence"}{" "}
                              {dataAmigavel(t.data).toLowerCase()}
                            </p>
                          </div>
                          <span className="num text-sm text-suave">
                            {dinheiro(t.valor)}
                          </span>
                          <Botao tamanho="sm" onClick={() => paguei(t.id)}>
                            {t.tipo === "receita" ? "Caiu" : "Paguei"}
                          </Botao>
                        </li>
                      ))}
                    </ul>
                  )}
                </Painel>
              )}
              {patri && (
                <Painel
                  titulo="Patrimônio hoje"
                  acao={
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      onClick={() => irPara("patrimonio")}
                    >
                      Ver contas <ArrowRight className="h-3.5 w-3.5" />
                    </Botao>
                  }
                >
                  <p
                    className={cx(
                      "display num text-3xl font-semibold",
                      patri.total < 0 && "text-saida",
                    )}
                  >
                    {dinheiro(patri.total)}
                  </p>
                  <p className="num mt-1 text-sm text-suave">
                    Contas {dinheiro(patri.porTipo.corrente)} · Investido{" "}
                    {dinheiro(patri.porTipo.investimento)} · Cartões{" "}
                    {dinheiro(patri.porTipo.credito)}
                  </p>
                </Painel>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Painel
              titulo={
                comOrcamento.length ? "Orçamento do mês" : "Onde o dinheiro foi"
              }
              sub={
                comOrcamento.length
                  ? undefined
                  : "Defina limites por categoria para acompanhar aqui."
              }
              acao={
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() =>
                    irPara(comOrcamento.length ? "orcamento" : "analises")
                  }
                >
                  Ver tudo <ArrowRight className="h-3.5 w-3.5" />
                </Botao>
              }
            >
              {linhasOrcamento.length === 0 ? (
                <p className="py-6 text-center text-sm text-fraco">
                  Sem despesas neste mês.
                </p>
              ) : (
                <ul className="space-y-3.5">
                  {linhasOrcamento.map((l) => (
                    <li key={l.nome}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2 truncate text-texto">
                          <Ponto cor={l.cor} />
                          {l.nome}
                        </span>
                        <span className="num shrink-0 text-suave">
                          <span
                            className={cx(
                              l.limite && l.gasto > l.limite
                                ? "text-saida"
                                : "text-texto",
                            )}
                          >
                            {dinheiro(l.gasto)}
                          </span>
                          {l.limite > 0 && <> de {dinheiro(l.limite)}</>}
                        </span>
                      </div>
                      <Barra
                        valor={l.gasto}
                        max={l.limite || maiorGasto}
                        cor={l.cor}
                        altura={6}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Painel>

            <Painel
              titulo="Próximos 7 dias"
              acao={
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => irPara("agenda")}
                >
                  Agenda <ArrowRight className="h-3.5 w-3.5" />
                </Botao>
              }
            >
              {proximos.length === 0 ? (
                <p className="py-6 text-center text-sm text-fraco">
                  Nada vencendo nem marcado para esta semana.
                </p>
              ) : (
                <ul className="divide-y divide-linha-suave">
                  {proximos.map((p, i) => {
                    const Icone =
                      p.tipo === "fatura"
                        ? CreditCard
                        : p.tipo === "fixa"
                          ? Repeat
                          : p.tipo === "card"
                            ? SquareKanban
                            : CalendarClock;
                    const dias = diffDias(hoje, p.data);
                    return (
                      <li key={i} className="flex items-center gap-3 py-2.5">
                        <Icone className="h-4 w-4 shrink-0 text-fraco" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] text-texto">
                            {p.titulo}
                          </p>
                          <p className="truncate text-[12.5px] text-fraco">
                            {dataAmigavel(p.data)}
                            {p.detalhe ? ` · ${p.detalhe}` : ""}
                          </p>
                        </div>
                        {p.valor !== undefined && (
                          <span
                            className={cx(
                              "num text-sm",
                              dias <= 1 ? "text-alerta" : "text-suave",
                            )}
                          >
                            {dinheiro(p.valor)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Painel>
          </div>

          {metas.length > 0 && (
            <Painel
              titulo="Metas"
              acao={
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => irPara("metas")}
                >
                  Ver metas <ArrowRight className="h-3.5 w-3.5" />
                </Botao>
              }
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metas.slice(0, 3).map((m) => (
                  <div key={m.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate text-texto">{m.nome}</span>
                      <span className="num text-suave">
                        {Math.round((m.valor_atual / m.valor_alvo) * 100)}%
                      </span>
                    </div>
                    <Barra
                      valor={m.valor_atual}
                      max={m.valor_alvo}
                      cor={m.cor}
                      altura={6}
                    />
                    <p className="num mt-1.5 text-[12.5px] text-fraco">
                      {dinheiro(m.valor_atual)} de {dinheiro(m.valor_alvo)}
                    </p>
                  </div>
                ))}
              </div>
            </Painel>
          )}

          <Painel
            titulo={`Lançamentos de ${nomeMes(mes)}`}
            acao={
              <Botao
                variante="fantasma"
                tamanho="sm"
                onClick={() => irPara("lancamentos")}
              >
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Botao>
            }
            corpo={false}
          >
            <div className="px-3 pt-2 pb-3">
              {recentes.length ? (
                recentes.map((t) => (
                  <LinhaTransacao key={t.id} t={t} mostrarData />
                ))
              ) : (
                <p className="py-6 text-center text-sm text-fraco">
                  Nada lançado neste mês.
                </p>
              )}
            </div>
          </Painel>
        </>
      )}
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string;
  valor: number;
  cor: string;
}) {
  return (
    <div>
      <p className="text-[13px] text-fraco">{rotulo}</p>
      <p className={cx("num mt-0.5 text-[17px] font-medium md:text-xl", cor)}>
        {dinheiro(valor)}
      </p>
    </div>
  );
}
