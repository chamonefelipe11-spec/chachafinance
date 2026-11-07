'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp, corCategoria } from '@/components/contexto';
import { Barra, MesNavegador, Painel, Ponto, Segmentado, cx } from '@/components/ui';
import { agrupar, despesasReais, doMes, resumir, ultimosMeses } from '@/lib/finance';
import { cap, dinheiro, nomeMes, rotuloMesCurto, somarMeses } from '@/lib/format';
import { COR_GRAFICO } from '@/lib/defaults';

const eixoValor = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v));

const eixo = { stroke: '#3a404d', tick: { fill: '#8a90a0', fontSize: 12 }, tickLine: false, axisLine: false } as const;

function Dica({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-linha bg-elevado px-3 py-2 text-[13px] shadow-xl">
      <p className="mb-1 text-suave">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-texto">
          <Ponto cor={p.color} />
          <span className="text-suave">{p.name}</span>
          <span className="num ml-auto pl-3">{dinheiro(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function Analises() {
  const { dados, cats, mes, setMes } = useApp();
  const [periodo, setPeriodo] = useState<'6' | '12'>('6');
  const meses = useMemo(() => ultimosMeses(mes, Number(periodo)), [mes, periodo]);

  const serie = useMemo(
    () =>
      meses.map((m) => {
        const r = resumir(doMes(dados.transacoes, m), cats);
        return { mes: cap(rotuloMesCurto(m)), Entradas: r.receitas, Saídas: r.despesas, Fixas: r.fixas, Variáveis: r.variaveis, sobra: r.saldo };
      }),
    [meses, dados.transacoes, cats],
  );
  const comDados = serie.filter((s) => s.Entradas || s['Saídas']);
  const mediaGasto = comDados.length ? comDados.reduce((a, s) => a + s['Saídas'], 0) / comDados.length : 0;
  const mediaSobra = comDados.length ? comDados.reduce((a, s) => a + s.sobra, 0) / comDados.length : 0;
  const totalEntradas = comDados.reduce((a, s) => a + s.Entradas, 0);
  const taxa = totalEntradas ? (comDados.reduce((a, s) => a + s.sobra, 0) / totalEntradas) * 100 : 0;

  const despMes = useMemo(() => despesasReais(doMes(dados.transacoes, mes), cats), [dados.transacoes, mes, cats]);
  const porCategoria = useMemo(() => agrupar(despMes, (t) => t.categoria, (n) => corCategoria(cats, n)), [despMes, cats]);
  const mediaCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const mm of ultimosMeses(somarMeses(mes, -1), 3)) for (const t of despesasReais(doMes(dados.transacoes, mm), cats)) m.set(t.categoria, (m.get(t.categoria) || 0) + t.valor / 3);
    return m;
  }, [dados.transacoes, mes, cats]);
  const porConta = useMemo(() => agrupar(despMes, (t) => t.cartao, (n) => dados.contas.find((c) => c.nome === n)?.cor || '#8F96A3'), [despMes, dados.contas]);
  const maxCat = Math.max(1, ...porCategoria.map((c) => c.valor));
  const maxConta = Math.max(1, ...porConta.map((c) => c.valor));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[28px] font-semibold md:text-[34px]">Análises</h1>
        <MesNavegador mes={mes} aoMudar={setMes} />
      </div>

      <Painel
        titulo="Entradas e saídas por mês"
        sub={`Até ${nomeMes(mes)} de ${mes.slice(0, 4)}. Investimentos ficam de fora.`}
        acao={<Segmentado tamanho="sm" valor={periodo} aoMudar={setPeriodo} opcoes={[{ valor: '6', rotulo: '6 meses' }, { valor: '12', rotulo: '12 meses' }]} />}
      >
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-[13px] text-fraco">Gasto médio</p>
            <p className="num text-lg font-medium">{dinheiro(mediaGasto)}</p>
          </div>
          <div>
            <p className="text-[13px] text-fraco">Sobra média</p>
            <p className={cx('num text-lg font-medium', mediaSobra < 0 && 'text-saida')}>{dinheiro(mediaSobra)}</p>
          </div>
          <div>
            <p className="text-[13px] text-fraco">Taxa de poupança</p>
            <p className="num text-lg font-medium">{taxa.toFixed(0)}%</p>
          </div>
        </div>
        <div className="h-64 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#262a33" />
              <XAxis dataKey="mes" {...eixo} />
              <YAxis {...eixo} width={52} tickFormatter={eixoValor} />
              <Tooltip content={<Dica />} cursor={{ fill: '#ffffff08' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, color: '#a1a7b3', paddingTop: 8 }} />
              <Bar isAnimationActive={false} dataKey="Entradas" fill={COR_GRAFICO.entrada} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar isAnimationActive={false} dataKey="Saídas" fill={COR_GRAFICO.saida} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Painel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Painel titulo={`Categorias em ${nomeMes(mes)}`} sub="Comparado com a média dos 3 meses anteriores">
          {porCategoria.length === 0 ? (
            <p className="py-8 text-center text-sm text-fraco">Sem despesas neste mês.</p>
          ) : (
            <ul className="space-y-3.5">
              {porCategoria.map((c) => {
                const media = mediaCat.get(c.nome) || 0;
                const dif = media ? ((c.valor - media) / media) * 100 : null;
                return (
                  <li key={c.nome}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2 truncate"><Ponto cor={c.cor} />{c.nome}</span>
                      <span className="num flex shrink-0 items-baseline gap-2">
                        {dif !== null && Math.abs(dif) >= 5 && (
                          <span className={cx('text-xs', dif > 0 ? 'text-saida' : 'text-entrada')}>{dif > 0 ? '+' : '−'}{Math.abs(dif).toFixed(0)}%</span>
                        )}
                        <span>{dinheiro(c.valor)}</span>
                      </span>
                    </div>
                    <Barra valor={c.valor} max={maxCat} cor={c.cor} altura={6} />
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>

        <div className="space-y-6">
          <Painel titulo="Contas fixas e gastos variáveis">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#262a33" />
                  <XAxis dataKey="mes" {...eixo} />
                  <YAxis {...eixo} width={52} tickFormatter={eixoValor} />
                  <Tooltip content={<Dica />} cursor={{ fill: '#ffffff08' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, color: '#a1a7b3', paddingTop: 8 }} />
                  <Bar isAnimationActive={false} dataKey="Fixas" stackId="a" fill={COR_GRAFICO.fixa} maxBarSize={28} stroke="#1b1e25" strokeWidth={2} />
                  <Bar isAnimationActive={false} dataKey="Variáveis" stackId="a" fill={COR_GRAFICO.variavel} radius={[4, 4, 0, 0]} maxBarSize={28} stroke="#1b1e25" strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Painel>

          <Painel titulo={`Por conta em ${nomeMes(mes)}`}>
            {porConta.length === 0 ? (
              <p className="py-6 text-center text-sm text-fraco">Sem despesas neste mês.</p>
            ) : (
              <ul className="space-y-3">
                {porConta.map((c) => (
                  <li key={c.nome}>
                    <div className="mb-1.5 flex justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 truncate"><Ponto cor={c.cor} />{c.nome}</span>
                      <span className="num">{dinheiro(c.valor)}</span>
                    </div>
                    <Barra valor={c.valor} max={maxConta} cor={c.cor} altura={6} />
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>
      </div>

      <Painel titulo="Tabela do período" corpo={false}>
        <div className="overflow-x-auto px-5 pb-4">
          <table className="num w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-linha-suave text-left text-[13px] text-fraco">
                <th className="py-2 font-normal">Mês</th>
                <th className="py-2 text-right font-normal">Entradas</th>
                <th className="py-2 text-right font-normal">Saídas</th>
                <th className="py-2 text-right font-normal">Sobra</th>
              </tr>
            </thead>
            <tbody>
              {[...serie].reverse().map((s) => (
                <tr key={s.mes} className="border-b border-linha-suave/60 last:border-0">
                  <td className="py-2 text-suave">{s.mes}</td>
                  <td className="py-2 text-right">{dinheiro(s.Entradas)}</td>
                  <td className="py-2 text-right">{dinheiro(s['Saídas'])}</td>
                  <td className={cx('py-2 text-right', s.sobra < 0 && 'text-saida')}>{dinheiro(s.sobra)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>
    </div>
  );
}
