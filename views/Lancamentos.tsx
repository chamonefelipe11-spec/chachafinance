'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useApp } from '@/components/contexto';
import { Botao, Chip, MesNavegador, Painel, Segmentado, Seletor, Vazio, cx } from '@/components/ui';
import LinhaTransacao from '@/components/LinhaTransacao';
import { doMes, ehInvestimento, resumir } from '@/lib/finance';
import { dataAmigavel, dinheiro } from '@/lib/format';
import { COR_PESSOA } from '@/lib/defaults';
import type { Quem, Transacao } from '@/lib/types';

type FiltroTipo = 'tudo' | 'despesa' | 'receita' | 'investimento';

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Lancamentos() {
  const { dados, cats, mes, setMes, novaTransacao } = useApp();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<FiltroTipo>('tudo');
  const [quem, setQuem] = useState<Quem | 'todos'>('todos');
  const [conta, setConta] = useState('todas');
  const [categoria, setCategoria] = useState('todas');

  const buscando = busca.trim().length > 1;
  const nomesConta = useMemo(() => [...new Set([...dados.contas.map((c) => c.nome), ...dados.transacoes.map((t) => t.cartao)])], [dados]);
  const nomesCategoria = useMemo(() => [...new Set([...dados.categorias.map((c) => c.nome), ...dados.transacoes.map((t) => t.categoria)])], [dados]);

  const filtradas = useMemo(() => {
    const termo = semAcento(busca.trim());
    const base = buscando ? dados.transacoes : doMes(dados.transacoes, mes);
    return base.filter((t) => {
      if (buscando && !semAcento(`${t.descricao} ${t.categoria} ${t.cartao}`).includes(termo) && !String(t.valor).includes(termo.replace(',', '.'))) return false;
      const inv = ehInvestimento(t, cats);
      if (tipo === 'investimento' && !inv) return false;
      if ((tipo === 'despesa' || tipo === 'receita') && (inv || t.tipo !== tipo)) return false;
      if (quem !== 'todos' && t.quem !== quem) return false;
      if (conta !== 'todas' && t.cartao !== conta) return false;
      if (categoria !== 'todas' && t.categoria !== categoria) return false;
      return true;
    });
  }, [dados.transacoes, mes, busca, buscando, tipo, quem, conta, categoria, cats]);

  const r = resumir(filtradas, cats);
  const porDia = useMemo(() => {
    const m = new Map<string, Transacao[]>();
    for (const t of filtradas) {
      if (!m.has(t.data)) m.set(t.data, []);
      m.get(t.data)!.push(t);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtradas]);

  const temFiltro = tipo !== 'tudo' || quem !== 'todos' || conta !== 'todas' || categoria !== 'todas';
  const limpar = () => {
    setTipo('tudo');
    setQuem('todos');
    setConta('todas');
    setCategoria('todas');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[28px] font-semibold md:text-[34px]">Lançamentos</h1>
        {!buscando && <MesNavegador mes={mes} aoMudar={setMes} />}
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-fraco" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar em todos os meses: descrição, categoria, conta ou valor"
            className="h-11 w-full rounded-xl border border-linha bg-campo pr-10 pl-10 text-[15px] text-texto placeholder:text-fraco focus:border-[#4a5263] focus:outline-none"
          />
          {busca && (
            <button type="button" aria-label="Limpar busca" onClick={() => setBusca('')} className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-fraco hover:text-texto">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmentado
            tamanho="sm"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={[
              { valor: 'tudo', rotulo: 'Tudo' },
              { valor: 'despesa', rotulo: 'Despesas' },
              { valor: 'receita', rotulo: 'Receitas' },
              { valor: 'investimento', rotulo: 'Investimentos' },
            ]}
          />
          <div className="sem-barra flex gap-1.5 overflow-x-auto">
            {(['Chamone', 'Letícia', 'Ambos'] as Quem[]).map((p) => (
              <Chip key={p} ativo={quem === p} cor={COR_PESSOA[p]} onClick={() => setQuem(quem === p ? 'todos' : p)}>
                {p === 'Ambos' ? 'Conjunta' : p}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Seletor value={conta} onChange={(e) => setConta(e.target.value)} className="h-9 text-sm sm:w-56" aria-label="Conta">
            <option value="todas">Todas as contas</option>
            {nomesConta.map((c) => <option key={c} value={c}>{c}</option>)}
          </Seletor>
          <Seletor value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-9 text-sm sm:w-56" aria-label="Categoria">
            <option value="todas">Todas as categorias</option>
            {nomesCategoria.map((c) => <option key={c} value={c}>{c}</option>)}
          </Seletor>
          {temFiltro && <Botao variante="fantasma" tamanho="sm" onClick={limpar} className="col-span-2">Limpar filtros</Botao>}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-suave">
        <span>{filtradas.length} {filtradas.length === 1 ? 'lançamento' : 'lançamentos'}{buscando ? ' encontrados' : ''}</span>
        {r.receitas > 0 && <span>Entradas <span className="num text-entrada">{dinheiro(r.receitas)}</span></span>}
        {r.despesas > 0 && <span>Saídas <span className="num text-texto">{dinheiro(r.despesas)}</span></span>}
        {r.aportes > 0 && <span>Aportes <span className="num text-investe">{dinheiro(r.aportes)}</span></span>}
      </div>

      <Painel corpo={false}>
        {porDia.length === 0 ? (
          <Vazio
            titulo={buscando ? 'Nada encontrado' : 'Nenhum lançamento aqui'}
            texto={buscando ? 'Tente outra palavra ou limpe os filtros.' : temFiltro ? 'Os filtros escondem tudo deste mês.' : 'Registre uma despesa ou receita para este mês.'}
            acao={temFiltro ? <Botao onClick={limpar}>Limpar filtros</Botao> : !buscando ? <Botao variante="primario" onClick={() => novaTransacao()}>Novo lançamento</Botao> : undefined}
          />
        ) : (
          <div className="divide-y divide-linha-suave">
            {porDia.map(([dia, itens]) => {
              const saldoDia = itens.reduce((a, t) => a + (ehInvestimento(t, cats) ? 0 : t.tipo === 'receita' ? t.valor : -t.valor), 0);
              return (
                <div key={dia} className="px-3 pt-3 pb-2">
                  <div className="flex items-baseline justify-between px-2 pb-1">
                    <span className="text-[13px] font-medium text-suave">
                      {dataAmigavel(dia)}
                      {buscando && <span className="text-fraco"> · {dia.slice(0, 4)}</span>}
                    </span>
                    <span className={cx('num text-[13px]', saldoDia >= 0 ? 'text-entrada/80' : 'text-fraco')}>
                      {saldoDia >= 0 ? '+' : '−'} {dinheiro(Math.abs(saldoDia))}
                    </span>
                  </div>
                  {itens.map((t) => <LinhaTransacao key={t.id} t={t} />)}
                </div>
              );
            })}
          </div>
        )}
      </Painel>
    </div>
  );
}
