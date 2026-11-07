'use client';

import { useCallback, useState } from 'react';
import { supabase } from './supabase';
import { CATEGORIAS_PADRAO, CONTAS_PADRAO } from './defaults';
import type { Acerto, Categoria, Conta, Disciplina, Evento, FaturaPaga, Meta, Transacao } from './types';
import { avisar } from './toast';

export interface Dados {
  transacoes: Transacao[];
  contas: Conta[];
  categorias: Categoria[];
  metas: Meta[];
  acertos: Acerto[];
  faturasPagas: FaturaPaga[];
  disciplinas: Disciplina[];
  eventos: Evento[];
}

const VAZIO: Dados = {
  transacoes: [],
  contas: CONTAS_PADRAO,
  categorias: CATEGORIAS_PADRAO,
  metas: [],
  acertos: [],
  faturasPagas: [],
  disciplinas: [],
  eventos: [],
};

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

function normalizarTransacao(t: Record<string, unknown>): Transacao {
  return {
    ...(t as unknown as Transacao),
    id: String(t.id),
    valor: Number(t.valor) || 0,
    descricao: (t.descricao as string) || (t.categoria as string) || 'Sem descrição',
    categoria: (t.categoria as string) || 'Outros',
    cartao: (t.cartao as string) || 'Conta Corrente / Pix',
    quem: ((t.quem as string) || 'Ambos') as Transacao['quem'],
    tipo: t.tipo === 'receita' ? 'receita' : 'despesa',
    tipo_gasto: (t.tipo_gasto as string) || 'Variável',
    parcela_atual: num(t.parcela_atual),
    total_parcelas: num(t.total_parcelas),
    divisao_pct: num(t.divisao_pct),
  };
}

/** Tabelas criadas pelo arquivo supabase/migracao.sql. */
export const TABELAS_NOVAS = ['contas', 'categorias', 'metas', 'acertos', 'faturas_pagas'] as const;
const COLUNAS_NOVAS = ['grupo_id', 'divisao_pct'];

export function useDados() {
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [faltando, setFaltando] = useState<string[]>([]);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    const [fin, disc, ag, contas, cats, metas, acertos, pagas] = await Promise.all([
      supabase.from('financas').select('*').order('data', { ascending: false }),
      supabase.from('disciplinas').select('*').order('created_at', { ascending: false }),
      supabase.from('agenda').select('*').order('data', { ascending: true }),
      supabase.from('contas').select('*').order('ordem'),
      supabase.from('categorias').select('*').order('ordem'),
      supabase.from('metas').select('*').order('created_at'),
      supabase.from('acertos').select('*').order('data', { ascending: false }),
      supabase.from('faturas_pagas').select('*'),
    ]);

    const falta: string[] = [];
    const opcional = <T,>(nome: string, r: { data: unknown; error: unknown }, padrao: T[]): T[] => {
      if (r.error) {
        falta.push(nome);
        return padrao;
      }
      const lista = (r.data as T[]) || [];
      return lista.length ? lista : padrao;
    };

    if (fin.error) avisar(`Não consegui ler os lançamentos: ${fin.error.message}`, 'erro');

    setDados({
      transacoes: ((fin.data as Record<string, unknown>[]) || []).map(normalizarTransacao),
      disciplinas: ((disc.data as Disciplina[]) || []).map((d) => ({ ...d, id: String(d.id) })),
      eventos: ((ag.data as Evento[]) || []).map((e) => ({ ...e, id: String(e.id) })),
      contas: opcional<Conta>('contas', contas, CONTAS_PADRAO).map((c) => ({ ...c, id: String(c.id), limite: num(c.limite) })),
      categorias: opcional<Categoria>('categorias', cats, CATEGORIAS_PADRAO).map((c) => ({ ...c, id: String(c.id), orcamento: num(c.orcamento) })),
      metas: opcional<Meta>('metas', metas, []).map((m) => ({ ...m, id: String(m.id), valor_alvo: Number(m.valor_alvo), valor_atual: Number(m.valor_atual) })),
      acertos: opcional<Acerto>('acertos', acertos, []).map((a) => ({ ...a, id: String(a.id), valor: Number(a.valor) })),
      faturasPagas: opcional<FaturaPaga>('faturas_pagas', pagas, []).map((p) => ({ ...p, id: String(p.id), valor: Number(p.valor) })),
    });
    setFaltando(falta);
    setCarregando(false);
  }, []);

  const limpar = useCallback(() => setDados(VAZIO), []);

  return { dados, carregando, faltando, carregar, limpar };
}

// ---------------- Escrita ----------------

type Linha = Record<string, unknown>;

function semColunasNovas(linhas: Linha[]): Linha[] {
  return linhas.map((l) => {
    const c = { ...l };
    for (const k of COLUNAS_NOVAS) delete c[k];
    return c;
  });
}

const erroDeColuna = (msg: string) => COLUNAS_NOVAS.some((c) => msg.includes(c));
const erroDeTabela = (msg: string) => /does not exist|Could not find the table|schema cache/i.test(msg);

function tratarErro(tabela: string, msg: string) {
  if (erroDeTabela(msg)) avisar(`A tabela "${tabela}" ainda não existe. Rode o arquivo supabase/migracao.sql no Supabase.`, 'erro');
  else avisar(`Não foi possível salvar: ${msg}`, 'erro');
}

export const db = {
  async inserir(tabela: string, linhas: Linha | Linha[]): Promise<boolean> {
    let lista = Array.isArray(linhas) ? linhas : [linhas];
    let { error } = await supabase.from(tabela).insert(lista);
    if (error && tabela === 'financas' && erroDeColuna(error.message)) {
      lista = semColunasNovas(lista);
      ({ error } = await supabase.from(tabela).insert(lista));
      if (!error) avisar('Salvo, mas sem divisão/agrupamento de parcelas: rode a migração do Supabase.', 'aviso');
    }
    if (error) tratarErro(tabela, error.message);
    return !error;
  },

  async atualizar(tabela: string, ids: string | string[], valores: Linha): Promise<boolean> {
    const lista = Array.isArray(ids) ? ids : [ids];
    let { error } = await supabase.from(tabela).update(valores).in('id', lista);
    if (error && tabela === 'financas' && erroDeColuna(error.message)) {
      ({ error } = await supabase.from(tabela).update(semColunasNovas([valores])[0]).in('id', lista));
    }
    if (error) tratarErro(tabela, error.message);
    return !error;
  },

  async atualizarOnde(tabela: string, coluna: string, valorAtual: string, valores: Linha): Promise<boolean> {
    const { error } = await supabase.from(tabela).update(valores).eq(coluna, valorAtual);
    if (error) tratarErro(tabela, error.message);
    return !error;
  },

  async remover(tabela: string, ids: string | string[]): Promise<boolean> {
    const lista = Array.isArray(ids) ? ids : [ids];
    const { error } = await supabase.from(tabela).delete().in('id', lista);
    if (error) tratarErro(tabela, error.message);
    return !error;
  },
};
