'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../contexto';
import { Botao, Campo, Chip, Entrada, Folha, Segmentado, confirmar } from '../ui';
import { db } from '@/lib/store';
import { avisar } from '@/lib/toast';
import { hojeISO, lerValor, valorParaCampo } from '@/lib/format';
import { CATEGORIAS_AGENDA, COR_PESSOA, PALETA } from '@/lib/defaults';
import type { Disciplina, Evento, Meta, Pessoa, Quem } from '@/lib/types';

const quemOpcoes = [
  { valor: 'Ambos' as Quem, rotulo: 'Os dois', cor: COR_PESSOA.Ambos },
  { valor: 'Chamone' as Quem, rotulo: 'Chamone', cor: COR_PESSOA.Chamone },
  { valor: 'Letícia' as Quem, rotulo: 'Letícia', cor: COR_PESSOA['Letícia'] },
];

function Rodape({ aoApagar, salvando, texto, form }: { aoApagar?: () => void; salvando: boolean; texto: string; form: string }) {
  return (
    <div className="flex gap-2">
      {aoApagar && (
        <Botao variante="fantasma" icone={<Trash2 className="h-4 w-4" />} onClick={aoApagar} aria-label="Apagar">
          <span className="hidden sm:inline">Apagar</span>
        </Botao>
      )}
      <Botao variante="primario" tamanho="lg" className="flex-1" type="submit" form={form} disabled={salvando}>
        {salvando ? 'Salvando…' : texto}
      </Botao>
    </div>
  );
}

// ---------------- Disciplina ----------------

export function DisciplinaForm({ aberta, aoFechar, editando, aluno }: { aberta: boolean; aoFechar: () => void; editando: Disciplina | null; aluno: Pessoa }) {
  const { recarregar } = useApp();
  const d = editando;
  const campoNota = (v: number | null | undefined) => (v === null || v === undefined ? '' : valorParaCampo(v));
  const [nome, setNome] = useState(d?.nome || '');
  const [semestre, setSemestre] = useState(d?.semestre || '2026.2');
  const [qtd, setQtd] = useState(String(d?.qtd_provas || 2));
  const [notas, setNotas] = useState([campoNota(d?.nota_p1), campoNota(d?.nota_p2), campoNota(d?.nota_p3)]);
  const [pesos, setPesos] = useState([String(d?.peso_p1 || 1), String(d?.peso_p2 || 1), String(d?.peso_p3 || 1)]);
  const [faltas, setFaltas] = useState(String(d?.faltas ?? 0));
  const [maxFaltas, setMaxFaltas] = useState(String(d?.max_faltas ?? 16));
  const [salvando, setSalvando] = useState(false);
  const dono = d?.aluno || aluno;

  const lerNota = (s: string) => (s.trim() === '' ? null : Math.min(Math.max(lerValor(s), 0), 100));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return avisar('Digite o nome da disciplina.', 'erro');
    setSalvando(true);
    const payload = {
      nome: nome.trim(),
      semestre,
      aluno: dono,
      qtd_provas: Number(qtd),
      nota_p1: lerNota(notas[0]),
      peso_p1: lerValor(pesos[0]) || 1,
      nota_p2: lerNota(notas[1]),
      peso_p2: lerValor(pesos[1]) || 1,
      nota_p3: lerNota(notas[2]),
      peso_p3: lerValor(pesos[2]) || 1,
      faltas: parseInt(faltas) || 0,
      max_faltas: parseInt(maxFaltas) || 16,
    };
    const ok = d ? await db.atualizar('disciplinas', d.id, payload) : await db.inserir('disciplinas', payload);
    setSalvando(false);
    if (ok) {
      avisar(d ? 'Disciplina atualizada.' : 'Disciplina adicionada.');
      aoFechar();
      recarregar();
    }
  }

  async function apagar() {
    if (!d || !(await confirmar(`Apagar ${d.nome}?`, { texto: 'As notas e faltas desta disciplina serão perdidas.' }))) return;
    if (await db.remover('disciplinas', d.id)) {
      avisar('Disciplina apagada.');
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={d ? `Editar ${d.nome}` : `Nova disciplina de ${dono}`} rodape={<Rodape form="form-disc" salvando={salvando} texto={d ? 'Salvar alterações' : 'Adicionar disciplina'} aoApagar={d ? apagar : undefined} />}>
      <form id="form-disc" onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome">
          <Entrada autoFocus={!d} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Resistência dos Materiais" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Semestre">
            <Entrada value={semestre} onChange={(e) => setSemestre(e.target.value)} placeholder="2026.2" />
          </Campo>
          <Campo rotulo="Provas">
            <Segmentado valor={qtd} aoMudar={setQtd} opcoes={['1', '2', '3'].map((v) => ({ valor: v, rotulo: v }))} />
          </Campo>
        </div>
        <div className="space-y-2 rounded-2xl border border-linha-suave bg-campo/60 p-4">
          <div className="grid grid-cols-[1fr_1fr_80px] gap-3 text-[13px] text-suave">
            <span>Prova</span>
            <span>Nota (0–100)</span>
            <span>Peso</span>
          </div>
          {Array.from({ length: Number(qtd) }, (_, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_80px] items-center gap-3">
              <span className="text-sm text-texto">P{i + 1}</span>
              <Entrada inputMode="decimal" value={notas[i]} placeholder="pendente" onChange={(e) => setNotas((n) => n.map((x, j) => (j === i ? e.target.value : x)))} />
              <Entrada inputMode="decimal" value={pesos[i]} onChange={(e) => setPesos((p) => p.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
          <p className="pt-1 text-xs text-fraco">Deixe em branco a prova que ainda não aconteceu: o app calcula quanto falta.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Faltas">
            <Entrada type="number" min={0} value={faltas} onChange={(e) => setFaltas(e.target.value)} />
          </Campo>
          <Campo rotulo="Limite de faltas">
            <Entrada type="number" min={1} value={maxFaltas} onChange={(e) => setMaxFaltas(e.target.value)} />
          </Campo>
        </div>
      </form>
    </Folha>
  );
}

// ---------------- Agenda ----------------

export function EventoForm({ aberta, aoFechar, editando, inicial }: { aberta: boolean; aoFechar: () => void; editando: Evento | null; inicial?: Partial<Evento> }) {
  const { recarregar } = useApp();
  const b = editando || inicial || {};
  const [titulo, setTitulo] = useState(b.titulo || '');
  const [data, setData] = useState(b.data || hojeISO());
  const [hora, setHora] = useState(b.hora || '');
  const [categoria, setCategoria] = useState(b.categoria || 'Pessoal / Lazer');
  const [quem, setQuem] = useState<Quem>((b.quem as Quem) || 'Ambos');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return avisar('Dê um nome ao compromisso.', 'erro');
    setSalvando(true);
    const payload = { titulo: titulo.trim(), data, hora: hora || null, categoria, quem };
    const ok = editando ? await db.atualizar('agenda', editando.id, payload) : await db.inserir('agenda', { ...payload, concluido: false });
    setSalvando(false);
    if (ok) {
      avisar(editando ? 'Compromisso atualizado.' : 'Compromisso salvo.');
      aoFechar();
      recarregar();
    }
  }

  async function apagar() {
    if (!editando || !(await confirmar('Apagar este compromisso?'))) return;
    if (await db.remover('agenda', editando.id)) {
      avisar('Compromisso apagado.');
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={editando ? 'Editar compromisso' : 'Novo compromisso'} rodape={<Rodape form="form-evento" salvando={salvando} texto={editando ? 'Salvar alterações' : 'Salvar compromisso'} aoApagar={editando ? apagar : undefined} />}>
      <form id="form-evento" onSubmit={salvar} className="space-y-4">
        <Campo rotulo="O quê">
          <Entrada autoFocus={!editando} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Prova de Estática, pagar IPVA" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dia">
            <Entrada type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="Horário" dica="Opcional">
            <Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </Campo>
        </div>
        <div>
          <span className="mb-2 block text-[13px] font-medium text-suave">Tipo</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS_AGENDA.map((c) => (
              <Chip key={c} ativo={c === categoria} onClick={() => setCategoria(c)}>{c}</Chip>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-suave">De quem</span>
          <Segmentado valor={quem} aoMudar={setQuem} opcoes={quemOpcoes} />
        </div>
      </form>
    </Folha>
  );
}

// ---------------- Meta ----------------

export function MetaForm({ aberta, aoFechar, editando }: { aberta: boolean; aoFechar: () => void; editando: Meta | null }) {
  const { recarregar } = useApp();
  const m = editando;
  const [nome, setNome] = useState(m?.nome || '');
  const [alvo, setAlvo] = useState(valorParaCampo(m?.valor_alvo));
  const [atual, setAtual] = useState(valorParaCampo(m?.valor_atual ?? 0));
  const [prazo, setPrazo] = useState(m?.prazo || '');
  const [cor, setCor] = useState(m?.cor || PALETA[0]);
  const [quem, setQuem] = useState<Quem>(m?.quem || 'Ambos');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const vAlvo = lerValor(alvo);
    if (!nome.trim() || !(vAlvo > 0)) return avisar('Preencha o nome e quanto quer juntar.', 'erro');
    setSalvando(true);
    const payload = { nome: nome.trim(), valor_alvo: vAlvo, valor_atual: lerValor(atual) || 0, prazo: prazo || null, cor, quem };
    const ok = m ? await db.atualizar('metas', m.id, payload) : await db.inserir('metas', payload);
    setSalvando(false);
    if (ok) {
      avisar(m ? 'Meta atualizada.' : 'Meta criada.');
      aoFechar();
      recarregar();
    }
  }

  async function apagar() {
    if (!m || !(await confirmar(`Apagar a meta "${m.nome}"?`, { texto: 'O valor guardado não é afetado nos lançamentos; só a meta some.' }))) return;
    if (await db.remover('metas', m.id)) {
      avisar('Meta apagada.');
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={m ? 'Editar meta' : 'Nova meta'} rodape={<Rodape form="form-meta" salvando={salvando} texto={m ? 'Salvar alterações' : 'Criar meta'} aoApagar={m ? apagar : undefined} />}>
      <form id="form-meta" onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Para quê">
          <Entrada autoFocus={!m} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Reserva de emergência, viagem" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quanto juntar (R$)">
            <Entrada inputMode="decimal" value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="10.000" />
          </Campo>
          <Campo rotulo="Já guardado (R$)">
            <Entrada inputMode="decimal" value={atual} onChange={(e) => setAtual(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Até quando" dica="Opcional: com prazo, o app mostra quanto guardar por mês.">
          <Entrada type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </Campo>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-suave">De quem</span>
          <Segmentado valor={quem} aoMudar={setQuem} opcoes={quemOpcoes} />
        </div>
        <div>
          <span className="mb-2 block text-[13px] font-medium text-suave">Cor</span>
          <div className="flex flex-wrap gap-2">
            {PALETA.map((c) => (
              <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setCor(c)} className="h-8 w-8 cursor-pointer rounded-full" style={{ backgroundColor: c, boxShadow: cor === c ? `0 0 0 2px #1b1e25, 0 0 0 4px ${c}` : undefined }} />
            ))}
          </div>
        </div>
      </form>
    </Folha>
  );
}

