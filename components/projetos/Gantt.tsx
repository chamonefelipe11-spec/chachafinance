"use client";

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, CalendarPlus } from "lucide-react";
import { Avatar, Botao, Segmentado, cx } from "@/components/ui";
import { dataCurta, diffDias, hojeISO, nomeMesCurto, somarDiasISO, dataDeISO } from "@/lib/format";
import {
  cardFeito,
  corEtiqueta,
  intervaloCard,
  moverDatas,
  progresso,
  situacaoPrazo,
} from "@/lib/projetos";
import type { Card, ColunaQuadro } from "@/lib/types";

type Zoom = "semana" | "mes";
type Modo = "mover" | "inicio" | "fim";

const assinarLargura = (cb: () => void) => {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const telaLarga = () => window.matchMedia("(min-width: 768px)").matches;

const LETRA_DIA = ["D", "S", "T", "Q", "Q", "S", "S"];
const ALTURA = 44;

export default function Gantt({
  cards,
  colunas,
  aoAbrir,
  aoMudarDatas,
}: {
  cards: Card[];
  colunas: ColunaQuadro[];
  aoAbrir: (c: Card) => void;
  aoMudarDatas: (c: Card, datas: { inicio: string | null; prazo: string | null }) => void;
}) {
  const [zoom, setZoom] = useState<Zoom>("semana");
  const [verFeitos, setVerFeitos] = useState(true);
  const largo = useSyncExternalStore(assinarLargura, telaLarga, () => true);
  const rotuloW = largo ? 220 : 132;
  const diaW = zoom === "semana" ? 34 : 9;
  const hoje = hojeISO();
  const rolagem = useRef<HTMLDivElement>(null);
  const [arrasto, setArrasto] = useState<{ id: string; modo: Modo; dias: number } | null>(null);

  const comDatas = cards.filter((c) => intervaloCard(c) && (verFeitos || !cardFeito(c, colunas)));
  const semDatas = cards.filter((c) => !intervaloCard(c) && !cardFeito(c, colunas));

  // Período mostrado: dos cards e de uma folga em volta de hoje
  const { ini, dias } = useMemo(() => {
    let de = somarDiasISO(hoje, -7);
    let ate = somarDiasISO(hoje, zoom === "semana" ? 35 : 120);
    for (const c of comDatas) {
      const iv = intervaloCard(c)!;
      if (iv.de < de) de = iv.de;
      if (iv.ate > ate) ate = iv.ate;
    }
    if (zoom === "semana") {
      const dow = (dataDeISO(de).getDay() + 6) % 7; // segunda = 0
      de = somarDiasISO(de, -dow);
      ate = somarDiasISO(ate, 7);
    } else {
      de = `${de.slice(0, 7)}-01`;
      ate = somarDiasISO(ate, 30);
    }
    return { ini: de, dias: diffDias(de, ate) + 1 };
  }, [comDatas, hoje, zoom]);

  const W = dias * diaW;
  const x = (iso: string) => diffDias(ini, iso) * diaW;
  const xHoje = x(hoje);

  // Abre já mostrando hoje
  useLayoutEffect(() => {
    if (rolagem.current) rolagem.current.scrollLeft = Math.max(0, xHoje - (largo ? 160 : 40));
  }, [zoom, largo]); // eslint-disable-line react-hooks/exhaustive-deps

  const meses = useMemo(() => {
    const out: { rotulo: string; x: number; w: number }[] = [];
    let d = ini;
    while (diffDias(ini, d) < dias) {
      const fimMes = somarDiasISO(`${somarMes(d)}-01`, -1);
      const ate = diffDias(ini, fimMes) >= dias ? somarDiasISO(ini, dias - 1) : fimMes;
      out.push({
        rotulo: `${nomeMesCurto(d.slice(0, 7))}${d.slice(5, 7) === "01" || out.length === 0 ? ` ${d.slice(0, 4)}` : ""}`,
        x: x(d),
        w: (diffDias(d, ate) + 1) * diaW,
      });
      d = somarDiasISO(ate, 1);
    }
    return out;
  }, [ini, dias, diaW]); // eslint-disable-line react-hooks/exhaustive-deps

  const grupos = useMemo(() => {
    const m = new Map<string, Card[]>();
    for (const c of [...comDatas].sort((a, b) => intervaloCard(a)!.de.localeCompare(intervaloCard(b)!.de))) {
      const k = c.etiqueta || "";
      m.set(k, [...(m.get(k) || []), c]);
    }
    return [...m.entries()].sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b)));
  }, [comDatas]);

  function comecarArrasto(e: React.PointerEvent, c: Card, modo: Modo) {
    e.stopPropagation();
    e.preventDefault();
    const alvo = e.currentTarget as HTMLElement;
    alvo.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    let movido = false;
    let ultimo = 0;
    const mover = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (Math.abs(dx) > 4) movido = true;
      const d = Math.round(dx / diaW);
      if (d !== ultimo) {
        ultimo = d;
        setArrasto({ id: c.id, modo, dias: d });
      }
    };
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
      setArrasto(null);
      if (!movido) {
        if (modo === "mover") aoAbrir(c);
        return;
      }
      if (ultimo) aoMudarDatas(c, moverDatas(c, modo, ultimo));
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }

  function irParaHoje() {
    rolagem.current?.scrollTo({ left: Math.max(0, xHoje - (largo ? 160 : 40)), behavior: "smooth" });
  }

  const linhasDias = Array.from({ length: dias }, (_, i) => somarDiasISO(ini, i));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmentado<Zoom>
          tamanho="sm"
          valor={zoom}
          aoMudar={setZoom}
          opcoes={[
            { valor: "semana", rotulo: "Dias" },
            { valor: "mes", rotulo: "Meses" },
          ]}
        />
        <Botao tamanho="sm" onClick={irParaHoje}>
          Hoje
        </Botao>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13px] text-suave">
          <input type="checkbox" checked={verFeitos} onChange={(e) => setVerFeitos(e.target.checked)} className="accent-[#ece6d8]" />
          Mostrar concluídos
        </label>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-linha-suave bg-painel">
        <div ref={rolagem} className="overflow-x-auto overscroll-x-contain" data-gantt>
          <div className="relative" style={{ width: rotuloW + W }}>
            {/* Fundo: fins de semana, viradas de mês e hoje */}
            <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: rotuloW, width: W }} aria-hidden>
              {zoom === "semana" &&
                linhasDias.map((d, i) => {
                  const dow = dataDeISO(d).getDay();
                  return dow === 0 || dow === 6 ? (
                    <div key={d} className="absolute top-0 bottom-0 bg-white/[0.025]" style={{ left: i * diaW, width: diaW }} />
                  ) : null;
                })}
              {meses.slice(1).map((m) => (
                <div key={m.x} className="absolute top-0 bottom-0 w-px bg-linha-suave" style={{ left: m.x }} />
              ))}
              {xHoje >= 0 && xHoje <= W && (
                <div className="absolute top-0 bottom-0 z-[1] w-0.5 bg-alerta/70" style={{ left: xHoje + diaW / 2 - 1 }} />
              )}
            </div>

            {/* Cabeçalho */}
            <div className="relative flex border-b border-linha-suave">
              <div className="sticky left-0 z-20 flex shrink-0 items-end bg-painel px-3 pb-2 text-[12px] font-medium text-fraco" style={{ width: rotuloW }}>
                Card
              </div>
              <div className="relative h-[52px]" style={{ width: W }}>
                {meses.map((m) => (
                  <div key={m.x} className="absolute top-1.5 overflow-clip px-1.5 text-[12px] font-semibold whitespace-nowrap text-suave capitalize" style={{ left: m.x, width: m.w }}>
                    {/* O nome do mês acompanha a rolagem até o mês acabar */}
                    <span className="sticky inline-block" style={{ left: rotuloW + 6 }}>
                      {m.rotulo}
                    </span>
                  </div>
                ))}
                {linhasDias.map((d, i) => {
                  const dt = dataDeISO(d);
                  const segunda = dt.getDay() === 1;
                  if (zoom === "mes" && !segunda) return null;
                  return (
                    <div
                      key={d}
                      className={cx("absolute bottom-1 text-center text-[11px] leading-tight", d === hoje ? "font-semibold text-alerta" : "text-fraco")}
                      style={{ left: i * diaW, width: zoom === "semana" ? diaW : diaW * 7 }}
                    >
                      {zoom === "semana" ? (
                        <>
                          <span className="block text-[10px] opacity-70">{LETRA_DIA[dt.getDay()]}</span>
                          {dt.getDate()}
                        </>
                      ) : (
                        <span className="block text-left">{dt.getDate()}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {grupos.length === 0 && (
              <div className="sticky left-0 px-4 py-10 text-sm text-suave" style={{ width: "min(100vw - 64px, 480px)" }}>
                Nenhum card com data. Coloque início ou prazo num card para ele aparecer aqui.
              </div>
            )}

            {grupos.map(([etq, lista]) => (
              <div key={etq || "_"}>
                <div className="relative flex border-b border-linha-suave/60">
                  <div className="sticky left-0 z-20 flex h-8 shrink-0 items-center gap-2 bg-painel px-3 text-[12px] font-semibold tracking-wide text-suave uppercase" style={{ width: rotuloW }}>
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: corEtiqueta(etq) }} />
                    <span className="truncate">{etq || "Sem etiqueta"}</span>
                  </div>
                  <div style={{ width: W }} />
                </div>
                {lista.map((c) => {
                  const feito = cardFeito(c, colunas);
                  const sit = situacaoPrazo(c, feito, hoje);
                  const vis = arrasto?.id === c.id ? moverDatas(c, arrasto.modo, arrasto.dias) : c;
                  const iv = intervaloCard({ ...c, ...vis })!;
                  const left = x(iv.de);
                  const w = (diffDias(iv.de, iv.ate) + 1) * diaW;
                  const { feitos, total } = progresso(c);
                  const cor = corEtiqueta(c.etiqueta);
                  const rotuloDatas = iv.de === iv.ate ? dataCurta(iv.de) : `${dataCurta(iv.de)} – ${dataCurta(iv.ate)}`;
                  return (
                    <div key={c.id} className="relative flex border-b border-linha-suave/60" style={{ height: ALTURA }}>
                      <button
                        type="button"
                        onClick={() => aoAbrir(c)}
                        className="sticky left-0 z-20 flex shrink-0 cursor-pointer items-center gap-2 bg-painel px-3 text-left hover:bg-elevado"
                        style={{ width: rotuloW }}
                      >
                        <span className={cx("min-w-0 flex-1 truncate text-[13px]", feito ? "text-fraco line-through" : "text-texto")}>{c.titulo}</span>
                        {largo && <Avatar quem={c.quem} tamanho={20} />}
                      </button>
                      <div className="relative" style={{ width: W }}>
                        <div
                          role="button"
                          tabIndex={0}
                          data-barra={c.id}
                          aria-label={`${c.titulo}, ${rotuloDatas}`}
                          title={`${c.titulo} · ${rotuloDatas}`}
                          onPointerDown={(e) => comecarArrasto(e, c, "mover")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") aoAbrir(c);
                            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                              e.preventDefault();
                              aoMudarDatas(c, moverDatas(c, e.shiftKey ? "fim" : "mover", e.key === "ArrowRight" ? 1 : -1));
                            }
                          }}
                          className={cx(
                            "group absolute top-[7px] flex h-[30px] cursor-grab touch-none items-center overflow-hidden rounded-lg select-none active:cursor-grabbing",
                            arrasto?.id === c.id && "z-10 shadow-lg ring-2 ring-papel/60",
                            sit === "atrasado" && "ring-2 ring-saida",
                            feito && "opacity-45",
                          )}
                          style={{ left: left + 2, width: Math.max(w - 4, 10), backgroundColor: `${cor}38`, boxShadow: `inset 0 0 0 1px ${cor}80` }}
                        >
                          {total > 0 && (
                            <div className="absolute inset-y-0 left-0" style={{ width: `${(feitos / total) * 100}%`, backgroundColor: `${cor}55` }} />
                          )}
                          <span className="relative truncate px-2.5 text-[12px] font-medium text-texto">
                            {feito && w > 40 && <Check className="mr-1 inline h-3.5 w-3.5 text-entrada" />}
                            {w > 70 ? c.titulo : ""}
                          </span>
                          {/* Pontas: esticam o início e o prazo */}
                          <span
                            onPointerDown={(e) => comecarArrasto(e, c, "inicio")}
                            className="absolute inset-y-0 left-0 w-3 cursor-ew-resize touch-none rounded-l-lg hover:bg-white/15 md:w-2"
                            aria-hidden
                          />
                          <span
                            onPointerDown={(e) => comecarArrasto(e, c, "fim")}
                            className="absolute inset-y-0 right-0 w-3 cursor-ew-resize touch-none rounded-r-lg hover:bg-white/15 md:w-2"
                            aria-hidden
                          />
                        </div>
                        {arrasto?.id === c.id && (
                          <span className="absolute -top-0.5 z-20 rounded bg-elevado px-1.5 text-[11px] whitespace-nowrap text-texto shadow" style={{ left: left + 2 }}>
                            {rotuloDatas}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[13px] text-fraco">
        Arraste a barra para mudar as datas; puxe as pontas para mudar o início ou o prazo. Toque no nome para abrir o card.
      </p>

      {semDatas.length > 0 && (
        <div>
          <h3 className="mb-2 text-[13px] font-medium text-suave">Sem data ({semDatas.length})</h3>
          <div className="flex flex-wrap gap-2">
            {semDatas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => aoAbrir(c)}
                className="inline-flex h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-linha px-3 text-[13px] text-suave hover:text-texto"
              >
                <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{c.titulo}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function somarMes(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
