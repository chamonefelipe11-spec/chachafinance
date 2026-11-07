"use client";

import { useMemo, useState } from "react";
import { HandCoins, Trash2 } from "lucide-react";
import { useApp } from "@/components/contexto";
import {
  Avatar,
  BarraDividida,
  Botao,
  BotaoIcone,
  Cabecalho,
  Campo,
  Entrada,
  Folha,
  MesNavegador,
  Painel,
  Segmentado,
  Vazio,
  confirmar,
} from "@/components/ui";
import LinhaTransacao from "@/components/LinhaTransacao";
import {
  custoPorPessoa,
  doMes,
  itensDivididos,
  outraPessoa,
  saldoCasal,
} from "@/lib/finance";
import {
  dataBR,
  dinheiro,
  hojeISO,
  lerValor,
  valorParaCampo,
} from "@/lib/format";
import { COR_PESSOA } from "@/lib/defaults";
import { db } from "@/lib/store";
import { avisar } from "@/lib/toast";
import type { Pessoa } from "@/lib/types";

export default function Casal() {
  const { dados, cats, mes, setMes, recarregar, faltando } = useApp();
  const [registrando, setRegistrando] = useState(false);
  const saldo = useMemo(
    () => saldoCasal(dados.transacoes, dados.acertos),
    [dados.transacoes, dados.acertos],
  );
  const doMesSel = useMemo(
    () => doMes(dados.transacoes, mes),
    [dados.transacoes, mes],
  );
  const divididos = useMemo(() => itensDivididos(doMesSel), [doMesSel]);
  const custo = useMemo(() => custoPorPessoa(doMesSel, cats), [doMesSel, cats]);
  const conjunta = doMesSel
    .filter((t) => t.tipo === "despesa" && t.quem === "Ambos")
    .reduce((a, t) => a + t.valor, 0);
  const deveNoMes = (p: Pessoa) =>
    divididos
      .filter((i) => i.pagou !== p)
      .reduce((a, i) => a + i.parteOutro, 0);

  async function apagarAcerto(id: string) {
    if (
      !(await confirmar("Apagar este acerto?", {
        texto: "O saldo entre vocês volta a contar esse valor como pendente.",
      }))
    )
      return;
    if (await db.remover("acertos", id)) {
      avisar("Acerto apagado.");
      recarregar();
    }
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Acerto do casal"
        sub="Quando um paga algo que é dos dois, o app anota quanto o outro deve."
      />

      <section className="rounded-3xl border border-linha-suave bg-painel p-6 md:p-8">
        {saldo.devedor ? (
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                <Avatar quem={saldo.devedor} tamanho={44} />
                <Avatar quem={saldo.credor!} tamanho={44} />
              </div>
              <div>
                <p className="text-[15px] text-suave">
                  <span className="text-texto">{saldo.devedor}</span> deve para{" "}
                  <span className="text-texto">{saldo.credor}</span>
                </p>
                <p className="display num text-[44px] leading-tight font-semibold">
                  {dinheiro(saldo.valor)}
                </p>
                <p className="text-[13px] text-fraco">
                  Somando todas as despesas divididas até hoje, menos os acertos
                  já feitos.
                </p>
              </div>
            </div>
            <Botao
              variante="primario"
              icone={<HandCoins className="h-4 w-4" />}
              onClick={() =>
                faltando.includes("acertos")
                  ? avisar(
                      "Rode a migração do Supabase para registrar acertos.",
                      "erro",
                    )
                  : setRegistrando(true)
              }
            >
              Registrar pagamento
            </Botao>
          </div>
        ) : (
          <div>
            <p className="display text-3xl font-semibold">Tudo acertado</p>
            <p className="mt-1 text-sm text-suave">
              Ninguém deve nada. Ao lançar uma despesa paga por um de vocês,
              ligue “Dividir com…” para ela entrar aqui.
            </p>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="display text-xl font-semibold">Mês a mês</h2>
        <MesNavegador mes={mes} aoMudar={setMes} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Painel
          titulo="Despesas divididas"
          sub="Toque para mudar a divisão"
          corpo={false}
        >
          <div className="px-3 pt-2 pb-3">
            {divididos.length === 0 ? (
              <Vazio
                titulo="Nenhuma despesa dividida neste mês"
                texto="Despesas pagas por um e marcadas como “dividir” aparecem aqui."
              />
            ) : (
              divididos.map((i) => (
                <div key={i.transacao.id}>
                  <LinhaTransacao t={i.transacao} mostrarData />
                  <p className="num -mt-1 pb-2 pl-14 text-[12.5px] text-fraco">
                    Parte de {outraPessoa(i.pagou)}:{" "}
                    <span className="text-texto">{dinheiro(i.parteOutro)}</span>{" "}
                    ({i.transacao.divisao_pct}%)
                  </p>
                </div>
              ))
            )}
          </div>
        </Painel>

        <div className="space-y-6">
          <Painel titulo="Quanto pesou para cada um">
            <BarraDividida
              partes={[
                { valor: custo.Chamone, cor: COR_PESSOA.Chamone },
                { valor: custo["Letícia"], cor: COR_PESSOA["Letícia"] },
              ]}
            />
            <dl className="mt-4 space-y-2.5 text-sm">
              {(["Chamone", "Letícia"] as const).map((p) => (
                <div key={p} className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-suave">
                    <Avatar quem={p} tamanho={20} />
                    {p}
                  </dt>
                  <dd className="num text-texto">{dinheiro(custo[p])}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-linha-suave pt-2.5">
                <dt className="text-suave">Pago pela conta conjunta</dt>
                <dd className="num text-texto">{dinheiro(conjunta)}</dd>
              </div>
              {(["Chamone", "Letícia"] as const).map((p) =>
                deveNoMes(p) > 0 ? (
                  <div key={p} className="flex items-center justify-between">
                    <dt className="text-suave">{p} ficou devendo no mês</dt>
                    <dd className="num text-texto">{dinheiro(deveNoMes(p))}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </Painel>

          <Painel titulo="Pagamentos entre vocês">
            {dados.acertos.length === 0 ? (
              <p className="text-sm text-fraco">
                Nenhum acerto registrado ainda.
              </p>
            ) : (
              <ul className="-mx-2 space-y-0.5">
                {dados.acertos.slice(0, 12).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-elevado/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-texto">
                        <span className="text-texto">{a.de}</span> →{" "}
                        <span className="text-texto">{a.para}</span>
                      </p>
                      <p className="truncate text-[12.5px] text-fraco">
                        {dataBR(a.data)}
                        {a.obs ? ` · ${a.obs}` : ""}
                      </p>
                    </div>
                    <span className="num text-sm">{dinheiro(a.valor)}</span>
                    <BotaoIcone
                      rotulo="Apagar acerto"
                      className="h-8 w-8"
                      onClick={() => apagarAcerto(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </BotaoIcone>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>
      </div>

      {registrando && saldo.devedor && (
        <RegistrarAcerto
          de={saldo.devedor}
          valor={saldo.valor}
          aoFechar={() => setRegistrando(false)}
        />
      )}
    </div>
  );
}

function RegistrarAcerto({
  de: deInicial,
  valor: valorInicial,
  aoFechar,
}: {
  de: Pessoa;
  valor: number;
  aoFechar: () => void;
}) {
  const { recarregar } = useApp();
  const [de, setDe] = useState<Pessoa>(deInicial);
  const [valor, setValor] = useState(valorParaCampo(valorInicial));
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = lerValor(valor);
    if (!(v > 0)) return avisar("Digite um valor maior que zero.", "erro");
    setSalvando(true);
    const ok = await db.inserir("acertos", {
      de,
      para: outraPessoa(de),
      valor: v,
      data,
      obs: obs.trim() || null,
    });
    setSalvando(false);
    if (ok) {
      avisar("Pagamento registrado.");
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo="Registrar pagamento"
      rodape={
        <Botao
          variante="primario"
          tamanho="lg"
          className="w-full"
          type="submit"
          form="form-acerto"
          disabled={salvando}
        >
          Registrar pagamento
        </Botao>
      }
    >
      <form id="form-acerto" onSubmit={salvar} className="space-y-4">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-suave">
            Quem pagou
          </span>
          <Segmentado
            valor={de}
            aoMudar={setDe}
            opcoes={[
              {
                valor: "Letícia",
                rotulo: "Letícia → Chamone",
                cor: COR_PESSOA["Letícia"],
              },
              {
                valor: "Chamone",
                rotulo: "Chamone → Letícia",
                cor: COR_PESSOA.Chamone,
              },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Valor (R$)">
            <Entrada
              autoFocus
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Data">
            <Entrada
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </Campo>
        </div>
        <Campo rotulo="Observação" dica="Opcional">
          <Entrada
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: Pix do mercado de outubro"
          />
        </Campo>
      </form>
    </Folha>
  );
}
