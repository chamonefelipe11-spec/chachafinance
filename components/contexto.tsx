"use client";

import { createContext, useContext } from "react";
import type { Dados } from "@/lib/store";
import type { MapaCategorias } from "@/lib/finance";
import type {
  Aba,
  Conta,
  Disciplina,
  Evento,
  Meta,
  Pessoa,
  TipoTransacao,
  Transacao,
} from "@/lib/types";

export interface Contexto {
  dados: Dados;
  cats: MapaCategorias;
  contasPorNome: Map<string, Conta>;
  recarregar: () => Promise<void>;
  mes: string;
  setMes: (m: string) => void;
  irPara: (a: Aba) => void;
  faltando: string[];
  // Abrir formulários
  novaTransacao: (
    inicial?: Partial<Transacao> & { tipo?: TipoTransacao },
  ) => void;
  editarTransacao: (t: Transacao) => void;
  novaDisciplina: (aluno: Pessoa) => void;
  editarDisciplina: (d: Disciplina) => void;
  novoEvento: (inicial?: Partial<Evento>) => void;
  editarEvento: (e: Evento) => void;
  novaMeta: () => void;
  editarMeta: (m: Meta) => void;
}

export const Ctx = createContext<Contexto | null>(null);

export function useApp(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp fora do provedor");
  return c;
}

export const corCategoria = (cats: MapaCategorias, nome: string) =>
  cats.get(nome)?.cor || "#8F96A3";
