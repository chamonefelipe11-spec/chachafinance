'use client';

import { useMemo, useState } from 'react';
import { Check, Settings2 } from 'lucide-react';
import { useApp } from '@/components/contexto';
import { Barra, Botao, Cabecalho, Painel, Vazio, cx } from '@/components/ui';
import LinhaTransacao from '@/components/LinhaTransacao';
import { cartaoConfigurado, doMes, faturaEmFoco, faturasDoCartao, type Fatura } from '@/lib/finance';
import { cap, dataCurta, dinheiro, hojeISO, mesAtual, nomeMesCurto, rotuloMes, rotuloMesCurto, diffDias } from '@/lib/format';
import { db } from '@/lib/store';
import { avisar } from '@/lib/toast';
import type { Conta } from '@/lib/types';

const ROTULO_STATUS: Record<Fatura['status'], string> = {
  aberta: 'Aberta',
  fechada: 'Fechada',
  vencida: 'Vencida',
  paga: 'Paga',
  futura: 'Próxima',
};

export default function Cartoes() {
  const { dados, irPara } = useApp();
  const cartoes = dados.contas.filter((c) => c.tipo === 'credito' && c.ativo);
  const beneficios = dados.contas.filter((c) => c.tipo === 'beneficio' && c.ativo);
  const [selecionado, setSelecionado] = useState<string>(cartoes[0]?.nome || '');
  const atual = cartoes.find((c) => c.nome === selecionado) || cartoes[0];

  const resumoCartoes = useMemo(
    () =>
      cartoes.map((c) => {
        const faturas = faturasDoCartao(dados.transacoes, c, dados.faturasPagas);
        const foco = faturaEmFoco(faturas);
        const gastoMes = doMes(dados.transacoes, mesAtual()).filter((t) => t.cartao === c.nome && t.tipo === 'despesa').reduce((a, t) => a + t.valor, 0);
        return { conta: c, faturas, foco, gastoMes };
      }),
    [cartoes, dados.transacoes, dados.faturasPagas],
  );

  return (
    <div className="space-y-6">
      <Cabecalho titulo="Cartões" sub="Faturas por mês de fechamento, com parcelas futuras já incluídas." />

      {cartoes.length === 0 ? (
        <Painel>
          <Vazio titulo="Nenhum cartão de crédito cadastrado" texto="Cadastre seus cartões com o dia de fechamento e de vencimento para acompanhar as faturas." acao={<Botao onClick={() => irPara('ajustes')}>Cadastrar cartão</Botao>} />
        </Painel>
      ) : (
        <>
          <div className="sem-barra -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:px-0">
            {resumoCartoes.map(({ conta, foco, gastoMes }) => {
              const ativo = conta.nome === atual?.nome;
              return (
                <button
                  key={conta.id}
                  type="button"
                  onClick={() => setSelecionado(conta.nome)}
                  className={cx('relative min-w-[220px] cursor-pointer overflow-hidden rounded-2xl border p-4 text-left transition-colors', ativo ? 'border-linha bg-elevado' : 'border-linha-suave bg-painel hover:bg-elevado/50')}
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: conta.cor }} />
                  <p className="text-sm text-suave">{conta.nome}</p>
                  <p className="display num mt-2 text-2xl font-semibold">{dinheiro(foco?.total ?? gastoMes)}</p>
                  <p className="mt-1 text-[12.5px] text-fraco">
                    {!cartaoConfigurado(conta) || !foco
                      ? 'Gasto este mês · sem datas cadastradas'
                      : foco.status === 'aberta'
                        ? `Fatura aberta · fecha ${dataCurta(foco.fechamento)}`
                        : foco.status === 'vencida'
                          ? `Atrasada · venceu ${dataCurta(foco.vencimento)}`
                          : `Fechada · vence ${dataCurta(foco.vencimento)}`}
                  </p>
                </button>
              );
            })}
          </div>

          {atual && <DetalheCartao conta={atual} faturas={resumoCartoes.find((r) => r.conta.nome === atual.nome)?.faturas || []} />}
        </>
      )}

      {beneficios.length > 0 && <Beneficios contas={beneficios} />}
    </div>
  );
}

function DetalheCartao({ conta, faturas }: { conta: Conta; faturas: Fatura[] }) {
  const { recarregar, irPara, faltando } = useApp();
  const hoje = hojeISO();
  const padrao = faturaEmFoco(faturas)?.referencia || faturas[0]?.referencia;
  const [ref, setRef] = useState(padrao);
  const fatura = faturas.find((f) => f.referencia === ref) || faturas.find((f) => f.referencia === padrao);

  if (!cartaoConfigurado(conta)) {
    return (
      <Painel>
        <Vazio
          titulo={`Falta configurar o ${conta.nome}`}
          texto="Informe o dia de fechamento e o de vencimento para o app separar as compras em faturas."
          acao={<Botao icone={<Settings2 className="h-4 w-4" />} onClick={() => irPara('ajustes')}>Configurar datas</Botao>}
        />
      </Painel>
    );
  }

  const comprometido = faturas.filter((f) => f.status !== 'paga' && (f.vencimento >= hoje || f.status === 'vencida')).reduce((a, f) => a + f.total, 0);
  const ordenadas = [...faturas].sort((a, b) => a.referencia.localeCompare(b.referencia));

  async function alternarPaga() {
    if (!fatura) return;
    if (faltando.includes('faturas_pagas')) return avisar('Rode a migração do Supabase para marcar faturas como pagas.', 'erro');
    const ok = fatura.pagamento
      ? await db.remover('faturas_pagas', fatura.pagamento.id)
      : await db.inserir('faturas_pagas', { conta: conta.nome, referencia: fatura.referencia, pago_em: hoje, valor: fatura.total });
    if (ok) {
      avisar(fatura.pagamento ? 'Fatura marcada como não paga.' : 'Fatura marcada como paga.');
      recarregar();
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Painel corpo={false}>
        <div className="sem-barra flex gap-1.5 overflow-x-auto border-b border-linha-suave px-4 pt-4 pb-3">
          {ordenadas.map((f) => (
            <button
              key={f.referencia}
              type="button"
              onClick={() => setRef(f.referencia)}
              className={cx('shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-[13px] transition-colors', f.referencia === fatura?.referencia ? 'bg-elevado text-texto' : 'text-fraco hover:text-suave')}
            >
              {f.referencia.slice(0, 4) === hoje.slice(0, 4) ? cap(nomeMesCurto(f.referencia)) : cap(rotuloMesCurto(f.referencia))}
            </button>
          ))}
        </div>
        {fatura && (
          <div className="px-5 pt-4 pb-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm text-suave">
                  Fatura de {rotuloMes(fatura.referencia)}
                  <span className={cx('rounded-md px-1.5 py-0.5 text-[11.5px]', fatura.status === 'vencida' ? 'bg-saida/15 text-saida' : fatura.status === 'paga' ? 'bg-entrada/15 text-entrada' : 'bg-elevado text-suave')}>
                    {ROTULO_STATUS[fatura.status]}
                  </span>
                </p>
                <p className="display num mt-1 text-4xl font-semibold">{dinheiro(fatura.total)}</p>
                <p className="mt-1 text-[13px] text-fraco">
                  Fecha {dataCurta(fatura.fechamento)} · vence {dataCurta(fatura.vencimento)}
                  {fatura.status !== 'paga' && fatura.vencimento >= hoje && ` · em ${diffDias(hoje, fatura.vencimento)} dias`}
                </p>
              </div>
              {fatura.status !== 'futura' && fatura.status !== 'aberta' && (
                <Botao variante={fatura.pagamento ? 'secundario' : 'primario'} icone={<Check className="h-4 w-4" />} onClick={alternarPaga}>
                  {fatura.pagamento ? 'Desmarcar pagamento' : 'Marcar como paga'}
                </Botao>
              )}
            </div>
            <div className="mt-4 -mx-2">
              {fatura.itens.length ? fatura.itens.map((t) => <LinhaTransacao key={t.id} t={t} mostrarData />) : <p className="py-6 text-center text-sm text-fraco">Nenhuma compra nesta fatura.</p>}
            </div>
          </div>
        )}
      </Painel>

      <div className="space-y-6">
        <Painel titulo="Limite">
          {conta.limite ? (
            <>
              <Barra valor={comprometido} max={conta.limite} cor={conta.cor} />
              <p className="num mt-2 text-sm text-suave">
                {dinheiro(comprometido)} usados de {dinheiro(conta.limite)}
              </p>
              <p className="num mt-1 text-sm text-texto">{dinheiro(Math.max(conta.limite - comprometido, 0))} disponíveis</p>
            </>
          ) : (
            <p className="text-sm text-fraco">Informe o limite em Contas e categorias para ver quanto ainda está disponível.</p>
          )}
        </Painel>
        <Painel titulo="Próximas faturas" sub="Já contando parcelas lançadas">
          <ul className="space-y-2">
            {ordenadas
              .filter((f) => f.status !== 'paga' && f.vencimento >= hoje)
              .slice(0, 6)
              .map((f) => (
                <li key={f.referencia} className="flex justify-between text-sm">
                  <span className="text-suave">{cap(rotuloMes(f.referencia))}</span>
                  <span className="num text-texto">{dinheiro(f.total)}</span>
                </li>
              ))}
          </ul>
        </Painel>
      </div>
    </div>
  );
}

function Beneficios({ contas }: { contas: Conta[] }) {
  const { dados, mes } = useApp();
  const gastos = contas.map((c) => ({
    conta: c,
    gasto: doMes(dados.transacoes, mes).filter((t) => t.cartao === c.nome && t.tipo === 'despesa').reduce((a, t) => a + t.valor, 0),
    recebido: doMes(dados.transacoes, mes).filter((t) => t.cartao === c.nome && t.tipo === 'receita').reduce((a, t) => a + t.valor, 0),
  }));
  return (
    <Painel titulo="Vales e benefícios" sub={`Uso em ${rotuloMes(mes)}. Lance o crédito do mês como receita no vale para ver o saldo.`}>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {gastos.map(({ conta, gasto, recebido }) => (
          <div key={conta.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-texto">{conta.nome}</span>
              <span className="num text-suave">
                {dinheiro(gasto)}
                {recebido > 0 && <> de {dinheiro(recebido)}</>}
              </span>
            </div>
            <Barra valor={gasto} max={recebido || Math.max(gasto, 1)} cor={conta.cor} altura={6} />
          </div>
        ))}
      </div>
    </Painel>
  );
}
