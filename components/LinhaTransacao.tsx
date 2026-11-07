"use client";

import { ArrowRightLeft, Repeat, Users } from "lucide-react";
import { corCategoria, useApp } from "./contexto";
import { Avatar, Valor, cx } from "./ui";
import { ehInvestimento, ehPrevisto, ehTransferencia } from "@/lib/finance";
import type { Transacao } from "@/lib/types";

export default function LinhaTransacao({
  t,
  mostrarData,
}: {
  t: Transacao;
  mostrarData?: boolean;
}) {
  const { cats, editarTransacao } = useApp();
  const transf = ehTransferencia(t);
  const cor = transf ? "#8F96A3" : corCategoria(cats, t.categoria);
  const invest = !transf && ehInvestimento(t, cats);
  const previsto = ehPrevisto(t);
  const parcelado = (t.total_parcelas || 1) > 1;
  return (
    <button
      type="button"
      onClick={() => editarTransacao(t)}
      className={cx(
        "group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-elevado/70",
        previsto && "opacity-70",
      )}
    >
      <span
        className={cx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold",
          previsto && "border border-dashed",
        )}
        style={{
          backgroundColor: previsto ? "transparent" : `${cor}1f`,
          color: cor,
          borderColor: previsto ? cor : undefined,
        }}
      >
        {transf ? (
          <ArrowRightLeft className="h-4 w-4" />
        ) : (
          (t.categoria || "?").slice(0, 1)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-texto">
          {t.descricao}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-fraco">
          {mostrarData && (
            <span className="num">
              {t.data.slice(8, 10)}/{t.data.slice(5, 7)}
            </span>
          )}
          {transf ? (
            <span className="truncate">
              {t.cartao} → {t.conta_destino}
            </span>
          ) : (
            <>
              <span className="truncate">{t.categoria}</span>
              <span aria-hidden>·</span>
              <span className="truncate">{t.cartao}</span>
            </>
          )}
          {(t.tipo_gasto === "Fixo" || t.recorrencia_id) && !parcelado && (
            <Repeat className="h-3 w-3 shrink-0" aria-label="Fixo" />
          )}
          {(t.divisao_pct ?? 0) > 0 && (
            <Users className="h-3 w-3 shrink-0" aria-label="Dividido" />
          )}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Valor
          v={t.valor}
          tipo={
            transf || invest
              ? "neutro"
              : t.tipo === "receita"
                ? "receita"
                : "despesa"
          }
          className={cx(
            "text-[15px] font-medium",
            invest && "text-investe",
            transf && "text-suave",
          )}
        />
        <span className="flex items-center gap-1.5">
          {previsto && (
            <span className="rounded-md border border-alerta/40 px-1.5 text-[11px] text-alerta">
              a pagar
            </span>
          )}
          {parcelado && (
            <span className="num rounded-md bg-elevado px-1.5 text-[11px] text-suave">
              {t.parcela_atual}/{t.total_parcelas}
            </span>
          )}
          {!transf && <Avatar quem={t.quem} tamanho={18} />}
        </span>
      </span>
    </button>
  );
}
