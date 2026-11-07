"use client";

import { useState } from "react";
import { Minus, Pencil, Plus } from "lucide-react";
import { useApp } from "@/components/contexto";
import {
  Alternar,
  Avatar,
  Barra,
  Botao,
  BotaoIcone,
  Cabecalho,
  Campo,
  Entrada,
  Folha,
  Painel,
  Segmentado,
  Vazio,
} from "@/components/ui";
import { dataBR, dinheiro, diffDias, hojeISO, lerValor } from "@/lib/format";
import { db } from "@/lib/store";
import { avisar } from "@/lib/toast";
import type { Meta } from "@/lib/types";

export default function Metas() {
  const { dados, novaMeta, editarMeta, faltando } = useApp();
  const [movendo, setMovendo] = useState<{
    meta: Meta;
    sentido: "guardar" | "retirar";
  } | null>(null);
  const total = dados.metas.reduce((a, m) => a + m.valor_atual, 0);
  const alvo = dados.metas.reduce((a, m) => a + m.valor_alvo, 0);

  if (faltando.includes("metas")) {
    return (
      <div>
        <Cabecalho titulo="Metas" />
        <Painel>
          <Vazio
            titulo="Falta criar a tabela de metas"
            texto="Rode o arquivo supabase/migracao.sql no SQL Editor do Supabase e recarregue a página."
          />
        </Painel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Metas"
        sub={
          dados.metas.length
            ? `${dinheiro(total)} guardados de ${dinheiro(alvo)} no total.`
            : "Caixinhas para juntar dinheiro com um objetivo."
        }
        acoes={
          <Botao
            variante="primario"
            icone={<Plus className="h-4 w-4" />}
            onClick={novaMeta}
          >
            Nova meta
          </Botao>
        }
      />

      {dados.metas.length === 0 ? (
        <Painel>
          <Vazio
            titulo="Nenhuma meta criada"
            texto="Reserva de emergência, viagem, troca do carro… Defina quanto e até quando, e o app calcula quanto guardar por mês."
            acao={
              <Botao variante="primario" onClick={novaMeta}>
                Criar a primeira meta
              </Botao>
            }
          />
        </Painel>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {dados.metas.map((m) => {
            const falta = Math.max(m.valor_alvo - m.valor_atual, 0);
            const pct = Math.min((m.valor_atual / m.valor_alvo) * 100, 100);
            const meses = m.prazo
              ? Math.max(Math.ceil(diffDias(hojeISO(), m.prazo) / 30.44), 0)
              : null;
            const porMes = meses ? falta / meses : null;
            return (
              <section
                key={m.id}
                className="rounded-2xl border border-linha-suave bg-painel p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Avatar quem={m.quem} tamanho={22} />
                      <h3 className="truncate text-[16px] font-semibold">
                        {m.nome}
                      </h3>
                    </div>
                    {m.prazo && (
                      <p className="mt-1 text-[13px] text-fraco">
                        Até {dataBR(m.prazo)}
                      </p>
                    )}
                  </div>
                  <BotaoIcone
                    rotulo="Editar meta"
                    onClick={() => editarMeta(m)}
                  >
                    <Pencil className="h-4 w-4" />
                  </BotaoIcone>
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-2">
                  <span
                    className="display num text-3xl font-semibold"
                    style={{ color: m.cor }}
                  >
                    {dinheiro(m.valor_atual)}
                  </span>
                  <span className="num text-sm text-suave">
                    {Math.round(pct)}% de {dinheiro(m.valor_alvo)}
                  </span>
                </div>
                <div className="mt-3">
                  <Barra
                    valor={m.valor_atual}
                    max={m.valor_alvo}
                    cor={m.cor}
                    altura={10}
                  />
                </div>
                <p className="mt-3 text-sm text-suave">
                  {falta === 0 ? (
                    "Meta alcançada."
                  ) : porMes !== null && meses ? (
                    <>
                      Faltam{" "}
                      <span className="num text-texto">{dinheiro(falta)}</span>:
                      guardando{" "}
                      <span className="num text-texto">{dinheiro(porMes)}</span>{" "}
                      por mês, chega no prazo.
                    </>
                  ) : m.prazo ? (
                    <>
                      O prazo passou e faltam{" "}
                      <span className="num text-texto">{dinheiro(falta)}</span>.
                    </>
                  ) : (
                    <>
                      Faltam{" "}
                      <span className="num text-texto">{dinheiro(falta)}</span>.
                    </>
                  )}
                </p>
                <div className="mt-4 flex gap-2">
                  <Botao
                    tamanho="sm"
                    className="flex-1"
                    icone={<Plus className="h-4 w-4" />}
                    onClick={() => setMovendo({ meta: m, sentido: "guardar" })}
                  >
                    Guardar
                  </Botao>
                  <Botao
                    tamanho="sm"
                    variante="fantasma"
                    icone={<Minus className="h-4 w-4" />}
                    onClick={() => setMovendo({ meta: m, sentido: "retirar" })}
                    disabled={m.valor_atual <= 0}
                  >
                    Retirar
                  </Botao>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {movendo && (
        <Movimento
          key={movendo.meta.id + movendo.sentido}
          {...movendo}
          aoFechar={() => setMovendo(null)}
        />
      )}
    </div>
  );
}

function Movimento({
  meta,
  sentido: inicial,
  aoFechar,
}: {
  meta: Meta;
  sentido: "guardar" | "retirar";
  aoFechar: () => void;
}) {
  const { recarregar, dados } = useApp();
  const [sentido, setSentido] = useState(inicial);
  const [valor, setValor] = useState("");
  const [lancar, setLancar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const catInvest =
    dados.categorias.find((c) => c.tipo === "investimento")?.nome ||
    "Investimentos (CDB/XP)";
  const contaInvest =
    dados.contas.find((c) => c.tipo === "investimento")?.nome ||
    "Conta Corrente / Pix";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = lerValor(valor);
    if (!(v > 0)) return avisar("Digite um valor maior que zero.", "erro");
    setSalvando(true);
    const novo = Math.max(
      meta.valor_atual + (sentido === "guardar" ? v : -v),
      0,
    );
    let ok = await db.atualizar("metas", meta.id, { valor_atual: novo });
    if (ok && lancar) {
      ok = await db.inserir("financas", {
        descricao: `${sentido === "guardar" ? "Aporte" : "Resgate"}: ${meta.nome}`,
        valor: v,
        tipo: sentido === "guardar" ? "despesa" : "receita",
        categoria: catInvest,
        data: hojeISO(),
        quem: meta.quem,
        cartao: contaInvest,
        tipo_gasto: "Investimento",
        parcela_atual: 1,
        total_parcelas: 1,
      });
    }
    setSalvando(false);
    if (ok) {
      avisar(
        sentido === "guardar"
          ? `${dinheiro(v)} guardados em ${meta.nome}.`
          : `${dinheiro(v)} retirados de ${meta.nome}.`,
      );
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo={meta.nome}
      rodape={
        <Botao
          variante="primario"
          tamanho="lg"
          className="w-full"
          type="submit"
          form="form-mov"
          disabled={salvando}
        >
          {sentido === "guardar" ? "Guardar" : "Retirar"}
        </Botao>
      }
    >
      <form id="form-mov" onSubmit={salvar} className="space-y-4">
        <Segmentado
          valor={sentido}
          aoMudar={setSentido}
          opcoes={[
            { valor: "guardar", rotulo: "Guardar" },
            { valor: "retirar", rotulo: "Retirar" },
          ]}
        />
        <Campo rotulo="Valor (R$)">
          <Entrada
            autoFocus
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
          />
        </Campo>
        <div className="rounded-2xl border border-linha-suave bg-campo/60 p-4">
          <Alternar
            ligado={lancar}
            aoMudar={setLancar}
            rotulo={`Registrar também como ${sentido === "guardar" ? "aporte" : "resgate"} nos lançamentos`}
          />
          <p className="mt-2 text-xs text-fraco">
            Use se esse dinheiro saiu (ou voltou) para a conta agora e ainda não
            foi lançado.
          </p>
        </div>
      </form>
    </Folha>
  );
}
