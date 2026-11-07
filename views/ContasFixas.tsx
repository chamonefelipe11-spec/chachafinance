"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Repeat } from "lucide-react";
import { useApp } from "@/components/contexto";
import {
  Alternar,
  Avatar,
  Barra,
  Botao,
  Cabecalho,
  Campo,
  Chip,
  Entrada,
  Folha,
  MesNavegador,
  Painel,
  Segmentado,
  Seletor,
  Vazio,
  confirmar,
  cx,
} from "@/components/ui";
import {
  dataNoMes,
  descricaoBase,
  ehPrevisto,
  outraPessoa,
  recorrenciaNoMes,
} from "@/lib/finance";
import {
  dataCurta,
  dinheiro,
  hojeISO,
  lerValor,
  mesAtual,
  nomeMes,
  valorParaCampo,
} from "@/lib/format";
import { COR_PESSOA } from "@/lib/defaults";
import { db } from "@/lib/store";
import { avisar } from "@/lib/toast";
import type {
  Pessoa,
  Quem,
  Recorrencia,
  TipoTransacao,
  Transacao,
} from "@/lib/types";

export default function ContasFixas() {
  const { dados, mes, setMes, recarregar, editarTransacao, faltando } =
    useApp();
  const [form, setForm] = useState<Recorrencia | "nova" | null>(null);
  const recs = dados.recorrencias;

  const doMes = useMemo(
    () =>
      dados.transacoes
        .filter((t) => t.recorrencia_id && t.competencia === mes)
        .sort((a, b) => a.data.localeCompare(b.data)),
    [dados.transacoes, mes],
  );
  const despesas = doMes.filter((t) => t.tipo === "despesa");
  const receitas = doMes.filter((t) => t.tipo === "receita");
  const pagas = despesas.filter((t) => !ehPrevisto(t));
  const falta = despesas.filter(ehPrevisto).reduce((a, t) => a + t.valor, 0);
  const totalFixo = despesas.reduce((a, t) => a + t.valor, 0);

  // Séries antigas de "Todo mês" (criadas antes das contas fixas)
  const seriesAntigas = useMemo(() => {
    const m = new Map<string, Transacao[]>();
    for (const t of dados.transacoes) {
      if (
        !t.grupo_id ||
        t.recorrencia_id ||
        (t.total_parcelas || 1) > 1 ||
        t.tipo === "transferencia"
      )
        continue;
      if (!m.has(t.grupo_id)) m.set(t.grupo_id, []);
      m.get(t.grupo_id)!.push(t);
    }
    return [...m.values()]
      .filter((g) => g.length > 1)
      .map((g) => g.sort((a, b) => a.data.localeCompare(b.data)));
  }, [dados.transacoes]);

  async function alternar(t: Transacao) {
    const ok = await db.atualizar("financas", t.id, {
      status: ehPrevisto(t) ? "pago" : "previsto",
      ...(ehPrevisto(t) && t.data > hojeISO() ? { data: hojeISO() } : {}),
    });
    if (ok) recarregar();
  }

  async function converter(serie: Transacao[]) {
    const ultima = serie[serie.length - 1];
    const criada = await db.inserirDevolvendo<{ id: string }>("recorrencias", {
      descricao: descricaoBase(ultima.descricao),
      valor: ultima.valor,
      tipo: ultima.tipo,
      categoria: ultima.categoria,
      cartao: ultima.cartao,
      quem: ultima.quem,
      divisao_pct: ultima.divisao_pct ?? null,
      dia: Number(ultima.data.slice(8, 10)),
      inicio: serie[0].data.slice(0, 7),
      fim: null,
      ativo: true,
    });
    if (!criada?.length) return;
    const rid = criada[0].id;
    // Liga os lançamentos existentes à conta fixa, sem apagar nenhum
    const ok = (
      await Promise.all(
        serie.map((t) =>
          db.atualizar("financas", t.id, {
            recorrencia_id: rid,
            competencia: t.data.slice(0, 7),
            descricao: descricaoBase(t.descricao),
          }),
        ),
      )
    ).every(Boolean);
    if (ok) {
      avisar(`"${descricaoBase(ultima.descricao)}" agora é uma conta fixa.`);
      recarregar();
    }
  }

  if (faltando.includes("recorrencias")) {
    return (
      <div>
        <Cabecalho titulo="Contas fixas" />
        <Painel>
          <Vazio
            titulo="Falta rodar o SQL da v3"
            texto="Rode supabase/fase2a5.sql no SQL Editor do Supabase para cadastrar contas fixas."
          />
        </Painel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[28px] font-semibold md:text-[34px]">
          Contas fixas
        </h1>
        <div className="flex items-center gap-2">
          <MesNavegador mes={mes} aoMudar={setMes} />
          <Botao
            variante="primario"
            tamanho="sm"
            icone={<Plus className="h-4 w-4" />}
            onClick={() => setForm("nova")}
          >
            Nova
          </Botao>
        </div>
      </div>

      {recs.length === 0 && seriesAntigas.length === 0 ? (
        <Painel>
          <Vazio
            titulo="Nenhuma conta fixa ainda"
            texto="Cadastre aluguel, internet, assinaturas e salário uma vez. Todo mês o app cria o lançamento e vocês só marcam quando pagar."
            acao={
              <Botao variante="primario" onClick={() => setForm("nova")}>
                Cadastrar a primeira
              </Botao>
            }
          />
        </Painel>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px] text-suave">
                <span className="display num text-3xl font-semibold text-texto">
                  {pagas.length}
                </span>{" "}
                de {despesas.length} contas pagas em {nomeMes(mes)}
              </p>
              <p className="num text-sm text-suave">
                {falta > 0 ? (
                  <>
                    Faltam <span className="text-texto">{dinheiro(falta)}</span>{" "}
                    de {dinheiro(totalFixo)}
                  </>
                ) : despesas.length ? (
                  "Tudo pago"
                ) : (
                  ""
                )}
              </p>
            </div>
            {despesas.length > 0 && (
              <Barra
                valor={pagas.length}
                max={despesas.length}
                cor="#2AA695"
                altura={8}
              />
            )}
          </section>

          <Painel titulo={`Checklist de ${nomeMes(mes)}`} corpo={false}>
            <ul className="px-3 pt-1 pb-3">
              {[...despesas, ...receitas].length === 0 && (
                <li className="px-2 py-6 text-center text-sm text-fraco">
                  {mes > mesAtual()
                    ? "Os lançamentos deste mês aparecem quando ele estiver perto."
                    : "Nenhuma conta fixa neste mês."}
                </li>
              )}
              {[...despesas, ...receitas].map((t) => {
                const pendente = ehPrevisto(t);
                const atrasada = pendente && t.data < hojeISO();
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={!pendente}
                      aria-label={
                        pendente
                          ? `Marcar ${t.descricao} como paga`
                          : `Marcar ${t.descricao} como pendente`
                      }
                      onClick={() => alternar(t)}
                      className={cx(
                        "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors",
                        !pendente
                          ? "border-transparent bg-entrada/80 text-[#14261c]"
                          : "border-[#4a5263] hover:border-suave",
                      )}
                    >
                      {!pendente && (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => editarTransacao(t)}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <p
                        className={cx(
                          "truncate text-[15px]",
                          !pendente && "text-suave",
                        )}
                      >
                        {t.descricao}
                      </p>
                      <p
                        className={cx(
                          "truncate text-[12.5px]",
                          atrasada ? "text-saida" : "text-fraco",
                        )}
                      >
                        {t.tipo === "receita" ? "Recebe" : "Vence"}{" "}
                        {dataCurta(t.data)} · {t.cartao}
                        {atrasada ? " · atrasada" : ""}
                      </p>
                    </button>
                    <span
                      className={cx(
                        "num text-[15px]",
                        t.tipo === "receita" && "text-entrada",
                      )}
                    >
                      {dinheiro(t.valor)}
                    </span>
                    <Avatar quem={t.quem} tamanho={20} />
                  </li>
                );
              })}
            </ul>
          </Painel>

          <Painel
            titulo="Contas cadastradas"
            sub="Toque para mudar valor, dia ou pausar"
            corpo={false}
          >
            <ul className="px-3 pt-1 pb-3">
              {recs.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setForm(r)}
                    className={cx(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-elevado/70",
                      !r.ativo && "opacity-50",
                    )}
                  >
                    <Repeat className="h-4 w-4 shrink-0 text-fraco" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px]">{r.descricao}</p>
                      <p className="truncate text-[12.5px] text-fraco">
                        Todo dia {r.dia} · {r.cartao}
                        {!r.ativo
                          ? " · pausada"
                          : r.fim
                            ? ` · até ${r.fim.slice(5, 7)}/${r.fim.slice(0, 4)}`
                            : ""}
                      </p>
                    </div>
                    <span
                      className={cx(
                        "num text-[15px]",
                        r.tipo === "receita" && "text-entrada",
                      )}
                    >
                      {dinheiro(r.valor)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Painel>

          {seriesAntigas.length > 0 && (
            <Painel
              titulo="Séries antigas de “Todo mês”"
              sub="Foram criadas como vários lançamentos separados. Converter liga todos a uma conta fixa, sem apagar nenhum."
            >
              <ul className="space-y-2">
                {seriesAntigas.map((g) => (
                  <li
                    key={g[0].grupo_id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-sm">
                      {descricaoBase(g[0].descricao)}{" "}
                      <span className="num text-fraco">
                        · {g.length} meses · {dinheiro(g[g.length - 1].valor)}
                      </span>
                    </span>
                    <Botao tamanho="sm" onClick={() => converter(g)}>
                      Converter
                    </Botao>
                  </li>
                ))}
              </ul>
            </Painel>
          )}
        </>
      )}

      {form && (
        <RecorrenciaForm
          key={form === "nova" ? "nova" : form.id}
          rec={form === "nova" ? null : form}
          aoFechar={() => setForm(null)}
        />
      )}
    </div>
  );
}

function RecorrenciaForm({
  rec,
  aoFechar,
}: {
  rec: Recorrencia | null;
  aoFechar: () => void;
}) {
  const { dados, recarregar } = useApp();
  const [tipo, setTipo] = useState<TipoTransacao>(rec?.tipo || "despesa");
  const [descricao, setDescricao] = useState(rec?.descricao || "");
  const [valor, setValor] = useState(valorParaCampo(rec?.valor));
  const [categoria, setCategoria] = useState(
    rec?.categoria || "Moradia / Aluguel",
  );
  const [conta, setConta] = useState(rec?.cartao || "Conta Corrente / Pix");
  const [quem, setQuem] = useState<Quem>(rec?.quem || "Ambos");
  const [pct, setPct] = useState(
    rec?.divisao_pct ? String(rec.divisao_pct) : "",
  );
  const [dia, setDia] = useState(String(rec?.dia || 10));
  const [inicio, setInicio] = useState(rec?.inicio || mesAtual());
  const [fim, setFim] = useState(rec?.fim || "");
  const [ativo, setAtivo] = useState(rec?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const cats = dados.categorias.filter(
    (c) =>
      (c.ativo || c.nome === categoria) &&
      c.tipo === (tipo === "receita" ? "receita" : "despesa"),
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = lerValor(valor);
    if (!descricao.trim() || !(v > 0))
      return avisar("Preencha a descrição e o valor.", "erro");
    const d = Math.min(Math.max(parseInt(dia) || 1, 1), 31);
    const payload = {
      descricao: descricao.trim(),
      valor: v,
      tipo,
      categoria,
      cartao: conta,
      quem,
      divisao_pct:
        tipo === "despesa" && quem !== "Ambos" && pct
          ? Math.min(Math.max(lerValor(pct), 0), 100)
          : null,
      dia: d,
      inicio,
      fim: fim || null,
      ativo,
    };
    setSalvando(true);
    let ok: boolean;
    if (rec) {
      ok = await db.atualizar("recorrencias", rec.id, payload);
      // Atualiza os meses ainda não pagos; o que já foi pago fica como está
      const pendentes = dados.transacoes.filter(
        (t) => t.recorrencia_id === rec.id && ehPrevisto(t),
      );
      const fora = pendentes.filter(
        (t) => !recorrenciaNoMes({ ...rec, ...payload }, t.competencia || ""),
      );
      const dentro = pendentes.filter((t) => !fora.includes(t));
      if (ok && fora.length)
        ok = await db.remover(
          "financas",
          fora.map((t) => t.id),
        );
      if (ok)
        ok = (
          await Promise.all(
            dentro.map((t) =>
              db.atualizar("financas", t.id, {
                descricao: payload.descricao,
                valor: v,
                tipo,
                categoria,
                cartao: conta,
                quem,
                divisao_pct: payload.divisao_pct,
                data: dataNoMes(t.competencia || t.data.slice(0, 7), d),
              }),
            ),
          )
        ).every(Boolean);
    } else {
      ok = await db.inserir("recorrencias", payload);
    }
    setSalvando(false);
    if (ok) {
      avisar(rec ? "Conta fixa atualizada." : "Conta fixa criada.");
      aoFechar();
      recarregar();
    }
  }

  async function apagar() {
    if (
      !rec ||
      !(await confirmar(`Apagar a conta fixa "${rec.descricao}"?`, {
        texto:
          "Os meses já pagos continuam nos lançamentos. Só os que estão a pagar somem.",
      }))
    )
      return;
    const pendentes = dados.transacoes
      .filter((t) => t.recorrencia_id === rec.id && ehPrevisto(t))
      .map((t) => t.id);
    const ok =
      (await db.remover("recorrencias", rec.id)) &&
      (pendentes.length ? await db.remover("financas", pendentes) : true);
    if (ok) {
      avisar("Conta fixa apagada.");
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo={rec ? rec.descricao : "Nova conta fixa"}
      rodape={
        <div className="flex gap-2">
          {rec && (
            <Botao variante="fantasma" onClick={apagar}>
              Apagar
            </Botao>
          )}
          <Botao
            variante="primario"
            tamanho="lg"
            className="flex-1"
            type="submit"
            form="form-rec"
            disabled={salvando}
          >
            {rec ? "Salvar alterações" : "Criar conta fixa"}
          </Botao>
        </div>
      }
    >
      <form id="form-rec" onSubmit={salvar} className="space-y-4">
        <Segmentado
          valor={tipo}
          aoMudar={setTipo}
          opcoes={[
            { valor: "despesa", rotulo: "Conta a pagar" },
            { valor: "receita", rotulo: "Renda fixa" },
          ]}
        />
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Campo rotulo="Descrição">
            <Entrada
              autoFocus={!rec}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Aluguel, Internet, Salário"
            />
          </Campo>
          <Campo rotulo="Valor (R$)">
            <Entrada
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Campo>
        </div>
        <div>
          <span className="mb-2 block text-[13px] font-medium text-suave">
            Categoria
          </span>
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <Chip
                key={c.id}
                ativo={c.nome === categoria}
                cor={c.cor}
                onClick={() => setCategoria(c.nome)}
              >
                {c.nome}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Campo rotulo={tipo === "receita" ? "Cai em" : "Paga com"}>
            <Seletor value={conta} onChange={(e) => setConta(e.target.value)}>
              {dados.contas
                .filter((c) => c.ativo || c.nome === conta)
                .map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
            </Seletor>
          </Campo>
          <Campo rotulo="Dia do mês">
            <Entrada
              type="number"
              min={1}
              max={31}
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />
          </Campo>
        </div>
        <p className="-mt-2 text-xs text-fraco">
          No cartão de crédito e nos vales, o mês já entra como pago. Na conta
          corrente, fica “a pagar” até vocês marcarem.
        </p>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-suave">
            De quem
          </span>
          <Segmentado
            valor={quem}
            aoMudar={setQuem}
            opcoes={[
              { valor: "Ambos", rotulo: "Conjunta", cor: COR_PESSOA.Ambos },
              { valor: "Chamone", rotulo: "Chamone", cor: COR_PESSOA.Chamone },
              {
                valor: "Letícia",
                rotulo: "Letícia",
                cor: COR_PESSOA["Letícia"],
              },
            ]}
          />
        </div>
        {tipo === "despesa" && quem !== "Ambos" && (
          <Campo
            rotulo={`Parte de ${outraPessoa(quem as Pessoa)} (%)`}
            dica="Deixe em branco para não dividir."
          >
            <Entrada
              inputMode="decimal"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="Ex.: 50"
            />
          </Campo>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Começa em">
            <Entrada
              type="month"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Termina em" dica="Opcional">
            <Entrada
              type="month"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </Campo>
        </div>
        <Alternar
          ligado={ativo}
          aoMudar={setAtivo}
          rotulo="Ativa (pausar para de gerar os próximos meses)"
        />
      </form>
    </Folha>
  );
}
