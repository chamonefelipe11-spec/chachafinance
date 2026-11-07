'use client';

import { useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { useApp } from '@/components/contexto';
import { Barra, Botao, Cabecalho, Campo, Entrada, Painel, Segmentado, Seletor, Vazio, cx } from '@/components/ui';
import { situacaoDisciplina, type Situacao } from '@/lib/finance';
import { COR_PESSOA, NOTA_APROVACAO, NOTA_EXAME } from '@/lib/defaults';
import { lerValor } from '@/lib/format';
import { db } from '@/lib/store';
import type { Disciplina, Pessoa } from '@/lib/types';

const STATUS: Record<Situacao['status'], { texto: string; classe: string }> = {
  aprovado: { texto: 'Aprovado', classe: 'bg-entrada/12 text-entrada' },
  exame: { texto: 'Exame especial', classe: 'bg-alerta/12 text-alerta' },
  'reprovado-nota': { texto: 'Reprovado por nota', classe: 'bg-saida/12 text-saida' },
  'reprovado-faltas': { texto: 'Reprovado por falta', classe: 'bg-saida/12 text-saida' },
  andamento: { texto: 'Em andamento', classe: 'bg-elevado text-suave' },
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

export default function Faculdade({ aluno, setAluno }: { aluno: Pessoa; setAluno: (p: Pessoa) => void }) {
  const { dados, novaDisciplina, editarDisciplina, recarregar } = useApp();
  const doAluno = dados.disciplinas.filter((d) => (d.aluno || 'Chamone') === aluno);
  const semestres = [...new Set(doAluno.map((d) => d.semestre))].sort().reverse();
  const [semestre, setSemestre] = useState<string>('');
  const semAtual = semestre && semestres.includes(semestre) ? semestre : semestres[0] || '';
  const lista = doAluno.filter((d) => !semAtual || d.semestre === semAtual).map((d) => ({ d, s: situacaoDisciplina(d) }));

  const comNota = lista.filter(({ s, d }) => s.pendentes.length < (d.qtd_provas || 2));
  const mediaGeral = comNota.length ? comNota.reduce((a, { s }) => a + s.mediaFeitas, 0) / comNota.length : 0;
  const aprovadas = lista.filter(({ s }) => s.status === 'aprovado').length;
  const emRisco = lista.filter(({ s }) => s.riscoFaltas || s.status === 'exame' || s.status.startsWith('reprovado') || (s.precisaAprovar !== null && s.precisaAprovar > 70)).length;

  async function somarFalta(d: Disciplina) {
    if (await db.atualizar('disciplinas', d.id, { faltas: (Number(d.faltas) || 0) + 1 })) recarregar();
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Faculdade"
        sub={`Aprovação com ${NOTA_APROVACAO} pontos; exame especial a partir de ${NOTA_EXAME}.`}
        acoes={
          <>
            <Segmentado
              valor={aluno}
              aoMudar={setAluno}
              opcoes={(['Chamone', 'Letícia'] as const).map((p) => ({ valor: p, rotulo: p, cor: COR_PESSOA[p] }))}
            />
            {semestres.length > 1 && (
              <Seletor value={semAtual} onChange={(e) => setSemestre(e.target.value)} className="h-11 w-32" aria-label="Semestre">
                {semestres.map((s) => <option key={s} value={s}>{s}</option>)}
              </Seletor>
            )}
          </>
        }
      />

      {lista.length === 0 ? (
        <Painel>
          <Vazio titulo={`Nenhuma disciplina de ${aluno}`} texto="Adicione as matérias do semestre com as provas e pesos; o app mostra quanto falta para passar em cada uma." acao={<Botao variante="primario" icone={<Plus className="h-4 w-4" />} onClick={() => novaDisciplina(aluno)}>Adicionar disciplina</Botao>} />
        </Painel>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[13px] text-fraco">Média das provas feitas</p>
              <p className="display num mt-1 text-3xl font-semibold">{fmt(Number(mediaGeral.toFixed(1)))}</p>
            </div>
            <div>
              <p className="text-[13px] text-fraco">Já aprovadas</p>
              <p className="display num mt-1 text-3xl font-semibold">{aprovadas}<span className="text-lg text-fraco">/{lista.length}</span></p>
            </div>
            <div>
              <p className="text-[13px] text-fraco">Pedem atenção</p>
              <p className={cx('display num mt-1 text-3xl font-semibold', emRisco > 0 && 'text-alerta')}>{emRisco}</p>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lista.map(({ d, s }) => {
              const n = Math.min(Math.max(d.qtd_provas || 2, 1), 3);
              const notas = [d.nota_p1, d.nota_p2, d.nota_p3].slice(0, n);
              const st = STATUS[s.status];
              return (
                <section key={d.id} className="flex flex-col rounded-2xl border border-linha-suave bg-painel">
                  <button type="button" onClick={() => editarDisciplina(d)} className="flex-1 cursor-pointer p-5 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[16px] leading-snug font-semibold">{d.nome}</h3>
                      <span className={cx('shrink-0 rounded-md px-2 py-0.5 text-xs', st.classe)}>{st.texto}</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      {notas.map((nota, i) => (
                        <div key={i} className={cx('flex-1 rounded-xl px-3 py-2', nota === null || nota === undefined ? 'border border-dashed border-linha' : 'bg-elevado')}>
                          <p className="text-[11.5px] text-fraco">P{i + 1}</p>
                          <p className="num text-[15px] font-medium">{nota === null || nota === undefined ? '—' : fmt(Number(nota))}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-suave">
                      {s.pendentes.length === 0 ? (
                        <>Média final <span className="num font-medium text-texto">{fmt(Number(s.media.toFixed(1)))}</span></>
                      ) : s.precisaAprovar === 0 ? (
                        <>Já garantiu {fmt(Number(s.media.toFixed(1)))} pontos: aprovado.</>
                      ) : s.precisaAprovar !== null && s.precisaAprovar <= 100 ? (
                        <>
                          Precisa de <span className="num font-medium text-texto">{fmt(Math.ceil(s.precisaAprovar * 10) / 10)}</span>
                          {s.pendentes.length > 1 ? ' de média nas ' : ' na '}
                          {s.pendentes.map((p) => `P${p}`).join(' e ')} para passar direto
                        </>
                      ) : s.precisaExame !== null && s.precisaExame <= 100 ? (
                        <>
                          Não dá mais para passar direto. Precisa de <span className="num font-medium text-texto">{fmt(Math.ceil(s.precisaExame * 10) / 10)}</span> para ir ao exame.
                        </>
                      ) : (
                        <>Não é mais possível chegar a {NOTA_EXAME} pontos.</>
                      )}
                    </p>
                  </button>
                  <div className="border-t border-linha-suave px-5 py-3.5">
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className={cx('flex items-center gap-1.5', s.riscoFaltas ? 'text-saida' : 'text-suave')}>
                        {s.riscoFaltas && <AlertTriangle className="h-3.5 w-3.5" />}
                        <span className="num">{d.faltas} de {d.max_faltas} faltas</span>
                      </span>
                      <button type="button" onClick={() => somarFalta(d)} className="cursor-pointer rounded-md px-2 py-0.5 text-xs text-fraco hover:bg-elevado hover:text-texto">
                        + falta
                      </button>
                    </div>
                    <Barra valor={d.faltas} max={d.max_faltas} cor={s.riscoFaltas ? '#E0654F' : '#6f7685'} altura={4} />
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <Simulador />
    </div>
  );
}

function Simulador() {
  const [p1, setP1] = useState('');
  const [peso1, setPeso1] = useState('1');
  const [peso2, setPeso2] = useState('1');
  const n1 = lerValor(p1) || 0;
  const w1 = lerValor(peso1) || 1;
  const w2 = lerValor(peso2) || 1;
  const precisa = (alvo: number) => Math.max(0, (alvo * (w1 + w2) - n1 * w1) / w2);
  const p60 = precisa(NOTA_APROVACAO);
  const p40 = precisa(NOTA_EXAME);
  return (
    <Painel titulo="Simulador rápido" sub="Para uma matéria com duas provas que ainda não está cadastrada.">
      <div className="grid grid-cols-3 gap-3">
        <Campo rotulo="Nota da P1"><Entrada inputMode="decimal" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="Ex.: 55" /></Campo>
        <Campo rotulo="Peso P1"><Entrada inputMode="decimal" value={peso1} onChange={(e) => setPeso1(e.target.value)} /></Campo>
        <Campo rotulo="Peso P2"><Entrada inputMode="decimal" value={peso2} onChange={(e) => setPeso2(e.target.value)} /></Campo>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-elevado px-4 py-3">
          <p className="text-[13px] text-suave">Para passar direto ({NOTA_APROVACAO})</p>
          <p className="display num text-2xl font-semibold">{!p1.trim() ? '—' : p60 > 100 ? 'Impossível' : `${fmt(Math.ceil(p60 * 10) / 10)} na P2`}</p>
        </div>
        <div className="rounded-xl bg-elevado px-4 py-3">
          <p className="text-[13px] text-suave">Para ir ao exame ({NOTA_EXAME})</p>
          <p className="display num text-2xl font-semibold">{!p1.trim() ? '—' : p40 > 100 ? 'Impossível' : `${fmt(Math.ceil(p40 * 10) / 10)} na P2`}</p>
        </div>
      </div>
    </Painel>
  );
}
