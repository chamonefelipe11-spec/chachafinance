'use client';

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../contexto';
import { Alternar, Botao, Campo, Chip, Entrada, Folha, Segmentado, Seletor, cx } from '../ui';
import { db } from '@/lib/store';
import { avisar } from '@/lib/toast';
import { dinheiro, gerarId, hojeISO, lerValor, somarMesesISO, valorParaCampo } from '@/lib/format';
import { descricaoBase, irmaos, outraPessoa } from '@/lib/finance';
import { COR_PESSOA } from '@/lib/defaults';
import type { Conta, Pessoa, Quem, TipoTransacao, Transacao } from '@/lib/types';

type Repeticao = 'nenhuma' | 'parcelado' | 'fixo';
type Escopo = 'este' | 'proximos';

const ROTULO_CONTA: Record<Conta['tipo'], string> = {
  corrente: 'Contas',
  credito: 'Cartões de crédito',
  beneficio: 'Vales e benefícios',
  investimento: 'Investimentos',
};

export default function TransacaoForm({
  aberta,
  aoFechar,
  editando,
  inicial,
}: {
  aberta: boolean;
  aoFechar: () => void;
  editando: Transacao | null;
  inicial?: Partial<Transacao>;
}) {
  const { dados, cats, recarregar } = useApp();
  const base = editando || inicial || {};

  const [tipo, setTipo] = useState<TipoTransacao>((base.tipo as TipoTransacao) || 'despesa');
  const [valor, setValor] = useState(valorParaCampo(base.valor));
  const [descricao, setDescricao] = useState(editando ? descricaoBase(editando.descricao) : base.descricao || '');
  const [categoria, setCategoria] = useState(base.categoria || (tipo === 'receita' ? 'Salário / Renda' : 'Alimentação / Mercado'));
  const [data, setData] = useState(base.data || hojeISO());
  const [conta, setConta] = useState(base.cartao || 'Conta Corrente / Pix');
  const [quem, setQuem] = useState<Quem>((base.quem as Quem) || 'Chamone');
  const [fixo, setFixo] = useState(base.tipo_gasto === 'Fixo');
  const [dividir, setDividir] = useState((base.divisao_pct ?? 0) > 0);
  const [pct, setPct] = useState(String(base.divisao_pct || 50));
  const [repeticao, setRepeticao] = useState<Repeticao>('nenhuma');
  const [qtd, setQtd] = useState('2');
  const [valorEhTotal, setValorEhTotal] = useState(true);
  const [escopo, setEscopo] = useState<Escopo>('este');
  const [apagando, setApagando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const grupo = useMemo(() => (editando ? irmaos(editando, dados.transacoes) : []), [editando, dados.transacoes]);
  const proximos = editando ? grupo.filter((t) => t.data >= editando.data) : [];

  const categoriasVisiveis = dados.categorias.filter(
    (c) => (c.ativo || c.nome === categoria) && (c.tipo === 'investimento' || c.tipo === tipo),
  );
  if (!categoriasVisiveis.some((c) => c.nome === categoria) && categoria) {
    categoriasVisiveis.push({ id: 'legado', nome: categoria, tipo, cor: '#8F96A3', orcamento: null, ativo: true, ordem: 999 });
  }
  const ehInvest = cats.get(categoria)?.tipo === 'investimento';

  const contasAtivas = dados.contas.filter((c) => c.ativo || c.nome === conta);
  const gruposConta = (['corrente', 'credito', 'beneficio', 'investimento'] as const)
    .map((t) => ({ tipo: t, contas: contasAtivas.filter((c) => c.tipo === t) }))
    .filter((g) => g.contas.length);
  const contaLegada = !contasAtivas.some((c) => c.nome === conta);

  const numero = lerValor(valor);
  const n = Math.min(Math.max(parseInt(qtd) || 1, 1), 120);
  const valorParcela = repeticao === 'parcelado' && valorEhTotal ? numero / n : numero;
  const podeDividir = tipo === 'despesa' && quem !== 'Ambos' && !ehInvest;

  function trocarTipo(t: TipoTransacao) {
    setTipo(t);
    const atual = cats.get(categoria);
    if (atual && atual.tipo !== 'investimento' && atual.tipo !== t) {
      setCategoria(dados.categorias.find((c) => c.tipo === t && c.ativo)?.nome || '');
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(numero) || numero <= 0) return avisar('Digite um valor maior que zero.', 'erro');
    if (!categoria) return avisar('Escolha uma categoria.', 'erro');
    setSalvando(true);
    const desc = descricao.trim() || categoria;
    const comum = {
      tipo,
      categoria,
      cartao: conta,
      quem,
      tipo_gasto: ehInvest ? 'Investimento' : fixo || repeticao === 'fixo' ? 'Fixo' : 'Variável',
      divisao_pct: podeDividir && dividir ? Math.min(Math.max(lerValor(pct) || 0, 0), 100) : null,
    };

    let ok: boolean;
    if (editando) {
      if (escopo === 'proximos' && proximos.length > 1) {
        // Atualiza a série mantendo data e número de cada parcela
        const resultados = await Promise.all(
          proximos.map((t) => {
            const total = t.total_parcelas || 1;
            const sufixo = total > 1 ? ` (${t.parcela_atual}/${total})` : '';
            return db.atualizar('financas', t.id, { ...comum, valor: numero, descricao: desc + sufixo, ...(t.id === editando.id ? { data } : {}) });
          }),
        );
        ok = resultados.every(Boolean);
      } else {
        const total = editando.total_parcelas || 1;
        const sufixo = total > 1 ? ` (${editando.parcela_atual}/${total})` : '';
        ok = await db.atualizar('financas', editando.id, { ...comum, valor: numero, descricao: desc + sufixo, data });
      }
    } else {
      const vezes = repeticao === 'nenhuma' ? 1 : n;
      const grupoId = vezes > 1 ? gerarId() : null;
      const centavos = Math.round(numero * 100);
      const linhas = Array.from({ length: vezes }, (_, i) => {
        let v = numero;
        if (repeticao === 'parcelado' && valorEhTotal) {
          const parcela = Math.floor(centavos / vezes);
          v = (i === vezes - 1 ? centavos - parcela * (vezes - 1) : parcela) / 100;
        }
        return {
          ...comum,
          valor: v,
          descricao: repeticao === 'parcelado' ? `${desc} (${i + 1}/${vezes})` : desc,
          data: somarMesesISO(data, i),
          parcela_atual: i + 1,
          total_parcelas: repeticao === 'parcelado' ? vezes : 1,
          grupo_id: grupoId,
        };
      });
      ok = await db.inserir('financas', linhas);
    }
    setSalvando(false);
    if (ok) {
      avisar(editando ? 'Lançamento atualizado.' : repeticao !== 'nenhuma' ? `${n} lançamentos criados.` : 'Lançamento salvo.');
      aoFechar();
      recarregar();
    }
  }

  async function apagar(quais: Transacao[]) {
    const ok = await db.remover('financas', quais.map((t) => t.id));
    if (ok) {
      avisar(quais.length > 1 ? `${quais.length} lançamentos apagados.` : 'Lançamento apagado.');
      aoFechar();
      recarregar();
    }
  }

  const titulo = editando ? 'Editar lançamento' : tipo === 'receita' ? 'Nova receita' : 'Nova despesa';

  return (
    <Folha
      aberta={aberta}
      aoFechar={aoFechar}
      titulo={titulo}
      rodape={
        apagando && editando ? (
          <div className="space-y-2">
            <p className="text-sm text-suave">Este lançamento faz parte de uma série de {grupo.length}.</p>
            <div className="flex flex-wrap gap-2">
              <Botao variante="perigo" tamanho="sm" onClick={() => apagar([editando])}>Só este</Botao>
              {proximos.length > 1 && (
                <Botao variante="perigo" tamanho="sm" onClick={() => apagar(proximos)}>Este e os próximos ({proximos.length})</Botao>
              )}
              <Botao variante="perigo" tamanho="sm" onClick={() => apagar(grupo)}>A série inteira ({grupo.length})</Botao>
              <Botao variante="fantasma" tamanho="sm" onClick={() => setApagando(false)}>Cancelar</Botao>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {editando && (
              <Botao
                variante="fantasma"
                aria-label="Apagar lançamento"
                icone={<Trash2 className="h-4 w-4" />}
                onClick={() => (grupo.length > 1 ? setApagando(true) : apagar([editando]))}
              >
                <span className="hidden sm:inline">Apagar</span>
              </Botao>
            )}
            <Botao variante="primario" tamanho="lg" className="flex-1" type="submit" form="form-transacao" disabled={salvando}>
              {salvando
                ? 'Salvando…'
                : editando
                  ? 'Salvar alterações'
                  : repeticao === 'nenhuma' || !Number.isFinite(numero)
                    ? `Salvar ${tipo}`
                    : `Criar ${n} lançamentos de ${dinheiro(valorParcela)}`}
            </Botao>
          </div>
        )
      }
    >
      <form id="form-transacao" onSubmit={salvar} className="space-y-5">
        {!editando && (
          <Segmentado
            valor={tipo}
            aoMudar={trocarTipo}
            opcoes={[
              { valor: 'despesa', rotulo: 'Despesa', cor: '#f08a7e' },
              { valor: 'receita', rotulo: 'Receita', cor: '#7ddba3' },
            ]}
          />
        )}

        <div className="flex items-baseline gap-2 border-b border-linha pb-2 focus-within:border-[#4a5263]">
          <span className="display text-2xl text-fraco">R$</span>
          <input
            autoFocus={!editando}
            inputMode="decimal"
            aria-label="Valor"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ''))}
            placeholder="0,00"
            className="display num w-full bg-transparent text-[40px] leading-none font-semibold text-texto placeholder:text-linha focus:outline-none"
          />
        </div>

        <Campo rotulo="Descrição">
          <Entrada value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={categoria || 'Ex.: mercado do mês'} />
        </Campo>

        <div>
          <span className="mb-2 block text-[13px] font-medium text-suave">Categoria</span>
          <div className="flex flex-wrap gap-1.5">
            {categoriasVisiveis.map((c) => (
              <Chip key={c.id + c.nome} ativo={c.nome === categoria} cor={c.cor} onClick={() => setCategoria(c.nome)}>
                {c.nome}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={repeticao === 'nenhuma' || editando ? 'Data' : 'Primeira data'}>
            <Entrada type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo={tipo === 'receita' ? 'Caiu em' : 'Pago com'}>
            <Seletor value={conta} onChange={(e) => setConta(e.target.value)}>
              {gruposConta.map((g) => (
                <optgroup key={g.tipo} label={ROTULO_CONTA[g.tipo]}>
                  {g.contas.map((c) => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                </optgroup>
              ))}
              {contaLegada && <option value={conta}>{conta}</option>}
            </Seletor>
          </Campo>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-suave">{tipo === 'receita' ? 'Quem recebeu' : 'Quem pagou'}</span>
          <Segmentado
            valor={quem}
            aoMudar={setQuem}
            opcoes={[
              { valor: 'Chamone', rotulo: 'Chamone', cor: COR_PESSOA.Chamone },
              { valor: 'Letícia', rotulo: 'Letícia', cor: COR_PESSOA['Letícia'] },
              { valor: 'Ambos', rotulo: 'Conta conjunta', cor: COR_PESSOA.Ambos },
            ]}
          />
        </div>

        {podeDividir && (
          <div className="rounded-2xl border border-linha-suave bg-campo/60 p-4">
            <Alternar ligado={dividir} aoMudar={setDividir} rotulo={<>Dividir com {outraPessoa(quem as Pessoa)}</>} />
            {dividir && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-suave">
                <span>Parte de {outraPessoa(quem as Pessoa)}:</span>
                {['50', '100'].map((p) => (
                  <Chip key={p} ativo={pct === p} onClick={() => setPct(p)}>{p === '100' ? 'Tudo' : 'Metade'}</Chip>
                ))}
                <div className="flex items-center gap-1">
                  <input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} aria-label="Porcentagem" className="h-8 w-14 rounded-lg border border-linha bg-campo text-center text-sm text-texto focus:outline-none" />
                  <span>%</span>
                </div>
                {Number.isFinite(numero) && (
                  <span className="num w-full text-xs text-fraco">
                    {outraPessoa(quem as Pessoa)} fica devendo {dinheiro(((repeticao === 'parcelado' ? valorParcela : numero) * (lerValor(pct) || 0)) / 100)}
                    {repeticao !== 'nenhuma' ? ' por mês' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {!ehInvest && tipo === 'despesa' && repeticao === 'nenhuma' && (
          <Segmentado
            tamanho="sm"
            valor={fixo ? 'fixo' : 'var'}
            aoMudar={(v) => setFixo(v === 'fixo')}
            opcoes={[
              { valor: 'var', rotulo: 'Gasto variável' },
              { valor: 'fixo', rotulo: 'Conta fixa do mês' },
            ]}
          />
        )}

        {!editando && (
          <div className="rounded-2xl border border-linha-suave bg-campo/60 p-4">
            <span className="mb-2 block text-[13px] font-medium text-suave">Repetir</span>
            <Segmentado
              tamanho="sm"
              valor={repeticao}
              aoMudar={setRepeticao}
              opcoes={[
                { valor: 'nenhuma', rotulo: 'Uma vez' },
                { valor: 'parcelado', rotulo: 'Parcelado' },
                { valor: 'fixo', rotulo: 'Todo mês' },
              ]}
            />
            {repeticao !== 'nenhuma' && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm text-texto">
                  <span>{repeticao === 'parcelado' ? 'Número de parcelas' : 'Por quantos meses'}</span>
                  <input type="number" min={2} max={120} value={qtd} onChange={(e) => setQtd(e.target.value)} className="h-9 w-20 rounded-lg border border-linha bg-campo text-center text-sm font-medium text-texto focus:outline-none" />
                </div>
                {repeticao === 'parcelado' && (
                  <Segmentado
                    tamanho="sm"
                    valor={valorEhTotal ? 'total' : 'parcela'}
                    aoMudar={(v) => setValorEhTotal(v === 'total')}
                    opcoes={[
                      { valor: 'total', rotulo: 'Digitei o valor total' },
                      { valor: 'parcela', rotulo: 'Digitei a parcela' },
                    ]}
                  />
                )}
                {Number.isFinite(numero) && repeticao === 'parcelado' && (
                  <p className="num text-xs text-fraco">
                    {n}× de {dinheiro(valorParcela)} · total {dinheiro(valorParcela * n)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {editando && proximos.length > 1 && (
          <div className="rounded-2xl border border-linha-suave bg-campo/60 p-4">
            <span className="mb-2 block text-[13px] font-medium text-suave">
              Parcela {editando.parcela_atual || '?'} de uma série com {grupo.length} lançamentos
            </span>
            <Segmentado
              tamanho="sm"
              valor={escopo}
              aoMudar={setEscopo}
              opcoes={[
                { valor: 'este', rotulo: 'Alterar só este' },
                { valor: 'proximos', rotulo: `Este e os próximos (${proximos.length})` },
              ]}
            />
          </div>
        )}
        <p className={cx('text-xs text-fraco', !ehInvest && 'hidden')}>Categorias de investimento não entram no saldo do mês; aparecem como aporte.</p>
      </form>
    </Folha>
  );
}
