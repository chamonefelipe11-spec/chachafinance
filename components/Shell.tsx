"use client";

import { useState, type ReactNode } from "react";
import {
  House,
  ReceiptText,
  CreditCard,
  Gauge,
  PiggyBank,
  HeartHandshake,
  ChartColumn,
  GraduationCap,
  CalendarDays,
  Settings2,
  Plus,
  LogOut,
  Download,
  Ellipsis,
  X,
  Repeat,
  Landmark,
  FileUp,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Aba } from "@/lib/types";
import { cx, Botao } from "./ui";

type Item = { aba: Aba; nome: string; icone: typeof House };

const DINHEIRO: Item[] = [
  { aba: "inicio", nome: "Início", icone: House },
  { aba: "lancamentos", nome: "Lançamentos", icone: ReceiptText },
  { aba: "cartoes", nome: "Cartões", icone: CreditCard },
  { aba: "contasfixas", nome: "Contas fixas", icone: Repeat },
  { aba: "patrimonio", nome: "Patrimônio", icone: Landmark },
  { aba: "orcamento", nome: "Orçamento", icone: Gauge },
  { aba: "metas", nome: "Metas", icone: PiggyBank },
  { aba: "casal", nome: "Acerto do casal", icone: HeartHandshake },
  { aba: "analises", nome: "Análises", icone: ChartColumn },
  { aba: "importar", nome: "Importar extrato", icone: FileUp },
];
const VIDA: Item[] = [
  { aba: "faculdade", nome: "Faculdade", icone: GraduationCap },
  { aba: "agenda", nome: "Agenda", icone: CalendarDays },
];
const AJUSTES: Item = { aba: "ajustes", nome: "Ajustes", icone: Settings2 };

const BARRA_CELULAR: Aba[] = ["inicio", "lancamentos", "cartoes"];

export const rotuloNovo = (aba: Aba) =>
  aba === "faculdade"
    ? "Nova disciplina"
    : aba === "agenda"
      ? "Novo compromisso"
      : aba === "metas"
        ? "Nova meta"
        : "Novo lançamento";

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-7 w-9 shrink-0">
        <span className="absolute left-0 h-7 w-7 rounded-full bg-chamone/90" />
        <span className="absolute left-2.5 h-7 w-7 rounded-full bg-leticia/90 mix-blend-screen" />
      </span>
      <span className="display text-[19px] font-semibold text-texto">
        chachafinance
      </span>
    </div>
  );
}

function LinkNav({
  item,
  ativo,
  aoClicar,
}: {
  item: Item;
  ativo: boolean;
  aoClicar: () => void;
}) {
  const Icone = item.icone;
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-current={ativo ? "page" : undefined}
      className={cx(
        "flex h-9 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-[14px] transition-colors",
        ativo
          ? "bg-elevado font-medium text-texto"
          : "text-suave hover:bg-elevado/60 hover:text-texto",
      )}
    >
      <Icone
        className={cx("h-[18px] w-[18px]", ativo ? "text-papel" : "text-fraco")}
        strokeWidth={ativo ? 2.2 : 1.8}
      />
      {item.nome}
    </button>
  );
}

export default function Shell({
  aba,
  irPara,
  email,
  aoSair,
  aoNovo,
  aoExportar,
  aviso,
  oculto,
  aoAlternarOculto,
  children,
}: {
  aba: Aba;
  irPara: (a: Aba) => void;
  email: string;
  aoSair: () => void;
  aoNovo: () => void;
  aoExportar: () => void;
  aviso?: ReactNode;
  oculto: boolean;
  aoAlternarOculto: () => void;
  children: ReactNode;
}) {
  const [maisAberto, setMaisAberto] = useState(false);
  const ir = (a: Aba) => {
    irPara(a);
    setMaisAberto(false);
  };

  return (
    <div className="min-h-dvh md:flex">
      {/* Lateral (computador) */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-linha-suave bg-[#171920] px-3 py-5 md:flex">
        <div className="flex items-center justify-between pl-2">
          <Marca />
          <BotaoOlho oculto={oculto} aoClicar={aoAlternarOculto} />
        </div>
        <Botao
          variante="primario"
          className="mx-1 mt-5"
          icone={<Plus className="h-4 w-4" />}
          onClick={aoNovo}
        >
          {rotuloNovo(aba)}
        </Botao>
        <nav
          className="mt-5 flex-1 space-y-0.5 overflow-y-auto"
          aria-label="Seções"
        >
          <p className="px-3 pb-1.5 text-xs text-fraco">Dinheiro</p>
          {DINHEIRO.map((i) => (
            <LinkNav
              key={i.aba}
              item={i}
              ativo={aba === i.aba}
              aoClicar={() => ir(i.aba)}
            />
          ))}
          <p className="px-3 pt-4 pb-1 text-xs text-fraco">Vida</p>
          {VIDA.map((i) => (
            <LinkNav
              key={i.aba}
              item={i}
              ativo={aba === i.aba}
              aoClicar={() => ir(i.aba)}
            />
          ))}
          <div className="pt-4">
            <LinkNav
              item={AJUSTES}
              ativo={aba === "ajustes"}
              aoClicar={() => ir("ajustes")}
            />
          </div>
        </nav>
        <div className="mt-4 space-y-0.5 border-t border-linha-suave pt-4">
          <button
            type="button"
            onClick={aoExportar}
            className="flex h-9 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-[13px] text-suave hover:bg-elevado/60 hover:text-texto"
          >
            <Download className="h-4 w-4 text-fraco" /> Baixar planilha (.xlsx)
          </button>
          <button
            type="button"
            onClick={aoSair}
            className="flex h-9 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-[13px] text-suave hover:bg-elevado/60 hover:text-texto"
          >
            <LogOut className="h-4 w-4 text-fraco" /> Sair
          </button>
          <p className="truncate px-3 pt-1 text-xs text-fraco">{email}</p>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
          <Marca />
          <BotaoOlho oculto={oculto} aoClicar={aoAlternarOculto} />
        </div>
        {aviso}
        <main className="mx-auto w-full max-w-[1120px] px-4 pt-5 pb-32 md:px-10 md:pt-10 md:pb-16">
          {children}
        </main>
      </div>

      {/* Barra inferior (celular) */}
      <nav
        className="pb-seguro fixed inset-x-0 bottom-0 z-50 border-t border-linha-suave bg-[#171920]/95 backdrop-blur md:hidden"
        aria-label="Seções"
      >
        <div className="grid h-16 grid-cols-5 items-center">
          {BARRA_CELULAR.slice(0, 2).map((a) => {
            const item = DINHEIRO.find((i) => i.aba === a)!;
            return (
              <BotaoBarra
                key={a}
                item={item}
                ativo={aba === a}
                aoClicar={() => ir(a)}
              />
            );
          })}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={aoNovo}
              aria-label={rotuloNovo(aba)}
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl bg-papel text-[#1a1b20] shadow-lg active:scale-95"
            >
              <Plus className="h-6 w-6" strokeWidth={2.4} />
            </button>
          </div>
          <BotaoBarra
            item={DINHEIRO[2]}
            ativo={aba === "cartoes"}
            aoClicar={() => ir("cartoes")}
          />
          <BotaoBarra
            item={{ aba: "ajustes", nome: "Mais", icone: Ellipsis }}
            ativo={!BARRA_CELULAR.includes(aba)}
            aoClicar={() => setMaisAberto(true)}
          />
        </div>
      </nav>

      {maisAberto && (
        <div
          className="anim-fundo fixed inset-0 z-[90] bg-black/60 md:hidden"
          onClick={() => setMaisAberto(false)}
        >
          <div
            className="anim-folha pb-seguro absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-linha bg-painel px-4 pt-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm text-suave">Mais seções</span>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setMaisAberto(false)}
                className="p-1 text-suave"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[...DINHEIRO.slice(3), ...VIDA, AJUSTES].map((i) => {
                const Icone = i.icone;
                return (
                  <button
                    key={i.aba}
                    type="button"
                    onClick={() => ir(i.aba)}
                    className={cx(
                      "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-[13px]",
                      aba === i.aba
                        ? "border-linha bg-elevado text-texto"
                        : "border-linha-suave text-suave",
                    )}
                  >
                    <Icone className="h-5 w-5" />
                    <span className="text-center leading-tight">
                      {i.aba === "ajustes" ? "Ajustes" : i.nome}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <Botao
                className="flex-1"
                tamanho="sm"
                icone={<Download className="h-4 w-4" />}
                onClick={aoExportar}
              >
                Planilha
              </Botao>
              <Botao
                className="flex-1"
                tamanho="sm"
                icone={<LogOut className="h-4 w-4" />}
                onClick={aoSair}
              >
                Sair
              </Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotaoOlho({
  oculto,
  aoClicar,
}: {
  oculto: boolean;
  aoClicar: () => void;
}) {
  const Icone = oculto ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={oculto}
      aria-label={oculto ? "Mostrar valores" : "Ocultar valores"}
      title={oculto ? "Mostrar valores" : "Ocultar valores"}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-suave transition-colors hover:bg-elevado hover:text-texto"
    >
      <Icone className="h-[18px] w-[18px]" />
    </button>
  );
}

function BotaoBarra({
  item,
  ativo,
  aoClicar,
}: {
  item: Item;
  ativo: boolean;
  aoClicar: () => void;
}) {
  const Icone = item.icone;
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={cx(
        "flex h-full cursor-pointer flex-col items-center justify-center gap-1 text-[11px]",
        ativo ? "text-texto" : "text-fraco",
      )}
    >
      <Icone className="h-[22px] w-[22px]" strokeWidth={ativo ? 2.2 : 1.7} />
      {item.nome}
    </button>
  );
}
