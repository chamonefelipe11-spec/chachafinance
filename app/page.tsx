'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, CartesianGrid, Legend 
} from 'recharts';
import { 
  Wallet, GraduationCap, ArrowUpRight, ArrowDownRight, AlertTriangle, 
  CheckCircle, Plus, Trash2, TrendingUp, BookOpen, Calculator, X, 
  Award, Users, CreditCard, LogOut, Lock, Download, FileSpreadsheet, 
  UserPlus, Calendar, CheckSquare, Square, Clock, Bell
} from 'lucide-react';

const CORES_CATEGORIAS: { [key: string]: string } = {
  'Alimentação / Mercado': '#F59E0B',
  'FastFood / iFood': '#EF4444',
  'Moradia / Aluguel': '#3B82F6',
  'Transporte / Uber': '#10B981',
  'Assinaturas / Streaming': '#8B5CF6',
  'Saúde / Farmácia': '#EC4899',
  'Lazer / Passeio': '#06B6D4',
  'Educação / EAD': '#6366F1',
  'Roupas / Beleza': '#D946EF',
  'Investimentos (CDB/XP)': '#10B981',
  'Imprevistos': '#F97316',
  'Salário / Renda': '#22C55E',
  'Outros': '#64748B'
};

const CORES_GRAFICO = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const CORES_CARTOES: { [key: string]: string } = {
  'Caju': '#EF4444',
  'Intercred': '#F97316',
  'Nubank': '#8B5CF6',
  'XP': '#1E293B',
  'Débito / Pix': '#10B981',
  'Outro': '#64748B'
};

export default function Dashboard() {
  const [sessao, setSessao] = useState<any>(null);
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [modoCadastro, setModoCadastro] = useState(false);

  // Estados Globais
  const [financas, setFinancas] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);
  const [aba, setAba] = useState<'financas' | 'faculdade' | 'agenda'>('financas');
  const [loading, setLoading] = useState(true);

  // Filtros Finanças
  const [filtroQuem, setFiltroQuem] = useState('Todos');
  const [filtroCartao, setFiltroCartao] = useState('Todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('Todos');
  const [alunoFaculdade, setAlunoFaculdade] = useState<'Chamone' | 'Letícia'>('Chamone');

  // Modais
  const [modalFin, setModalFin] = useState(false);
  const [modalDisc, setModalDisc] = useState(false);
  const [modalAgenda, setModalAgenda] = useState(false);

  // Formulário Finanças
  const [descFin, setDescFin] = useState('');
  const [valorFin, setValorFin] = useState('');
  const [tipoFin, setTipoFin] = useState('despesa');
  const [catFin, setCatFin] = useState('Alimentação / Mercado');
  const [dataFin, setDataFin] = useState(new Date().toISOString().split('T')[0]);
  const [quemFin, setQuemFin] = useState('Chamone');
  const [cartaoFin, setCartaoFin] = useState('Débito / Pix');
  const [tipoGastoFin, setTipoGastoFin] = useState('Variável');
  const [parceladoFin, setParceladoFin] = useState(false);
  const [totalParcelasFin, setTotalParcelasFin] = useState('1');

  // Formulário Faculdade
  const [nomeDisc, setNomeDisc] = useState('');
  const [semestreDisc, setSemestreDisc] = useState('2026.1');
  const [p1Disc, setP1Disc] = useState('');
  const [pesoP1Disc, setPesoP1Disc] = useState('1');
  const [p2Disc, setP2Disc] = useState('');
  const [pesoP2Disc, setPesoP2Disc] = useState('1');
  const [faltasDisc, setFaltasDisc] = useState('0');
  const [maxFaltasDisc, setMaxFaltasDisc] = useState('16');

  // Formulário Agenda
  const [tituloAgenda, setTituloAgenda] = useState('');
  const [dataAgenda, setDataAgenda] = useState(new Date().toISOString().split('T')[0]);
  const [horaAgenda, setHoraAgenda] = useState('09:00');
  const [catAgenda, setCatAgenda] = useState('Faculdade / Prova');
  const [quemAgenda, setQuemAgenda] = useState('Ambos');

  // Simulador Preditivo
  const [simP1, setSimP1] = useState<number>(0);
  const [simPesoP1, setSimPesoP1] = useState<number>(1);
  const [simPesoP2, setSimPesoP2] = useState<number>(1);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      if (session) carregarDados();
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
      if (session) carregarDados();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function autenticarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setErroLogin('');
    if (modoCadastro) {
      const { error } = await supabase.auth.signUp({ email: emailLogin, password: senhaLogin });
      if (error) setErroLogin(error.message);
      else alert('Conta criada com sucesso! Você já pode entrar.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: emailLogin, password: senhaLogin });
      if (error) setErroLogin('E-mail ou senha incorretos.');
    }
  }

  async function fazerLogout() {
    await supabase.auth.signOut();
    setFinancas([]); setDisciplinas([]); setAgenda([]);
  }

  async function carregarDados() {
    setLoading(true);
    const { data: fin } = await supabase.from('financas').select('*').order('data', { ascending: false });
    const { data: disc } = await supabase.from('disciplinas').select('*').order('created_at', { ascending: false });
    const { data: ag } = await supabase.from('agenda').select('*').order('data', { ascending: true });
    
    if (fin) setFinancas(fin);
    if (disc) setDisciplinas(disc);
    if (ag) setAgenda(ag);
    setLoading(false);
  }

  // --- EXPORTAR EXCEL (.XLSX) ---
  function exportarParaExcel() {
    if (financas.length === 0 && disciplinas.length === 0) return alert('Sem dados para exportar.');
    const workbook = XLSX.utils.book_new();

    if (financas.length > 0) {
      const dadosFin = financas.map(f => ({
        'Descrição': f.descricao, 'Quem': f.quem || 'Chamone', 'Conta/Cartão': f.cartao || 'Débito',
        'Categoria': f.categoria, 'Tipo': f.tipo, 'Classificação': f.tipo_gasto || 'Variável',
        'Data': f.data.split('-').reverse().join('/'), 'Valor (R$)': Number(f.valor),
        'Parcela': f.total_parcelas > 1 ? `${f.parcela_atual}/${f.total_parcelas}` : 'À vista'
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dadosFin), "Finanças");
    }

    if (disciplinas.length > 0) {
      const dadosDisc = disciplinas.map(d => {
        const media = ((Number(d.nota_p1 || 0) * Number(d.peso_p1 || 1)) + (Number(d.nota_p2 || 0) * Number(d.peso_p2 || 1))) / (Number(d.peso_p1 || 1) + Number(d.peso_p2 || 1));
        return {
          'Aluno': d.aluno || 'Chamone', 'Disciplina': d.nome, 'Semestre': d.semestre,
          'P1': Number(d.nota_p1 || 0), 'Peso P1': Number(d.peso_p1 || 1),
          'P2': Number(d.nota_p2 || 0), 'Peso P2': Number(d.peso_p2 || 1),
          'Média': Number(media.toFixed(1)), 'Faltas': Number(d.faltas || 0), 'Max Faltas': Number(d.max_faltas || 16),
          'Status': d.faltas > d.max_faltas ? 'Reprovado Faltas' : media < 40 ? 'Reprovado Nota' : media < 60 ? 'Exame Especial' : 'Aprovado'
        };
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dadosDisc), "Faculdade");
    }

    XLSX.writeFile(workbook, `Central_Controle_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // --- CRUD FINANÇAS ---
  async function salvarTransacao(e: React.FormEvent) {
    e.preventDefault();
    if (!valorFin) return alert('Digite um valor!');
    const numParcelas = parceladoFin && tipoFin === 'despesa' ? parseInt(totalParcelasFin) || 1 : 1;
    const transacoesParaSalvar = [];
    const dataBase = new Date(dataFin + 'T12:00:00');

    for (let i = 1; i <= numParcelas; i++) {
      const dataParcela = new Date(dataBase);
      dataParcela.setMonth(dataBase.getMonth() + (i - 1));
      const descFinal = numParcelas > 1 ? `${descFin || catFin} (${i}/${numParcelas})` : (descFin || catFin);

      transacoesParaSalvar.push({
        descricao: descFinal, valor: parseFloat(valorFin), tipo: tipoFin, categoria: catFin,
        data: dataParcela.toISOString().split('T')[0], quem: quemFin, cartao: cartaoFin,
        parcela_atual: i, total_parcelas: numParcelas, tipo_gasto: tipoGastoFin
      });
    }
    await supabase.from('financas').insert(transacoesParaSalvar);
    setModalFin(false); setDescFin(''); setValorFin(''); setParceladoFin(false); setTotalParcelasFin('1');
    carregarDados();
  }

  async function removerTransacao(id: string) {
    if (confirm('Apagar lançamento?')) { await supabase.from('financas').delete().eq('id', id); carregarDados(); }
  }

  // --- CRUD FACULDADE ---
  async function salvarDisciplina(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeDisc) return alert('Digite o nome da disciplina!');
    await supabase.from('disciplinas').insert([{
      nome: nomeDisc, semestre: semestreDisc, nota_p1: p1Disc ? parseFloat(p1Disc) : 0,
      peso_p1: parseFloat(pesoP1Disc) || 1, nota_p2: p2Disc ? parseFloat(p2Disc) : 0,
      peso_p2: parseFloat(pesoP2Disc) || 1, faltas: parseInt(faltasDisc) || 0,
      max_faltas: parseInt(maxFaltasDisc) || 16, aluno: alunoFaculdade
    }]);
    setModalDisc(false); setNomeDisc(''); setP1Disc(''); setP2Disc('');
    carregarDados();
  }

  async function removerDisciplina(id: string) {
    if (confirm('Apagar disciplina?')) { await supabase.from('disciplinas').delete().eq('id', id); carregarDados(); }
  }

  // --- CRUD AGENDA ---
  async function salvarAgenda(e: React.FormEvent) {
    e.preventDefault();
    if (!tituloAgenda) return alert('Digite o compromisso!');
    await supabase.from('agenda').insert([{
      titulo: tituloAgenda, data: dataAgenda, hora: horaAgenda, categoria: catAgenda, quem: quemAgenda
    }]);
    setModalAgenda(false); setTituloAgenda('');
    carregarDados();
  }

  async function alternarStatusAgenda(id: string, statusAtual: boolean) {
    await supabase.from('agenda').update({ concluido: !statusAtual }).eq('id', id);
    carregarDados();
  }

  async function removerAgenda(id: string) {
    if (confirm('Apagar evento?')) { await supabase.from('agenda').delete().eq('id', id); carregarDados(); }
  }

  // --- FILTRAGEM INTELIGENTE (PESSOA + CARTÃO + PERÍODO) ---
  const financasFiltradas = financas.filter(f => {
    const passQuem = filtroQuem === 'Todos' || f.quem === filtroQuem;
    const passCartao = filtroCartao === 'Todos' || f.cartao === filtroCartao;
    
    let passPeriodo = true;
    if (filtroPeriodo !== 'Todos' && f.data) {
      const dataGasto = new Date(f.data + 'T12:00:00');
      const hoje = new Date();
      
      if (filtroPeriodo === 'MesAtual') {
        passPeriodo = dataGasto.getMonth() === hoje.getMonth() && dataGasto.getFullYear() === hoje.getFullYear();
      } else if (filtroPeriodo === 'MesAnterior') {
        const mesPassado = new Date();
        mesPassado.setMonth(hoje.getMonth() - 1);
        passPeriodo = dataGasto.getMonth() === mesPassado.getMonth() && dataGasto.getFullYear() === mesPassado.getFullYear();
      } else if (filtroPeriodo === 'Trimestre') {
        const tresMesesAtras = new Date();
        tresMesesAtras.setMonth(hoje.getMonth() - 3);
        passPeriodo = dataGasto >= tresMesesAtras && dataGasto <= hoje;
      } else if (filtroPeriodo === 'Ano') {
        passPeriodo = dataGasto.getFullYear() === hoje.getFullYear();
      }
    }

    return passQuem && passCartao && passPeriodo;
  });

  // --- CÁLCULOS FINANCEIROS ---
  const receitas = financasFiltradas.filter(f => f.tipo === 'receita').reduce((acc, cur) => acc + Number(cur.valor), 0);
  const despesas = financasFiltradas.filter(f => f.tipo === 'despesa').reduce((acc, cur) => acc + Number(cur.valor), 0);
  const saldo = receitas - despesas;
  const despesasFixas = financasFiltradas.filter(f => f.tipo === 'despesa' && f.tipo_gasto === 'Fixo').reduce((acc, cur) => acc + Number(cur.valor), 0);
  const despesasVariaveis = financasFiltradas.filter(f => f.tipo === 'despesa' && f.tipo_gasto === 'Variável').reduce((acc, cur) => acc + Number(cur.valor), 0);
  const investimentos = financasFiltradas.filter(f => f.tipo === 'despesa' && f.tipo_gasto === 'Investimento').reduce((acc, cur) => acc + Number(cur.valor), 0);
  const taxaPoupança = receitas > 0 ? (((saldo + investimentos) / receitas) * 100).toFixed(1) : '0';

  const despesasPorCategoria = financasFiltradas.filter(f => f.tipo === 'despesa').reduce((acc: any[], cur) => {
    const idx = acc.findIndex(item => item.name === cur.categoria);
    if (idx >= 0) acc[idx].value += Number(cur.valor);
    else acc.push({ name: cur.categoria, value: Number(cur.valor) });
    return acc;
  }, []);

  const gastosPorCartao = financasFiltradas.filter(f => f.tipo === 'despesa').reduce((acc: any[], cur) => {
    const cartaoNome = cur.cartao || 'Débito / Pix';
    const idx = acc.findIndex(item => item.name === cartaoNome);
    if (idx >= 0) acc[idx].value += Number(cur.valor);
    else acc.push({ name: cartaoNome, value: Number(cur.valor) });
    return acc;
  }, []);

  const gastosPorPessoa = [
    { name: 'Chamone', valor: financasFiltradas.filter(f => f.tipo === 'despesa' && f.quem === 'Chamone').reduce((a, c) => a + Number(c.valor), 0), fill: '#3B82F6' },
    { name: 'Letícia', valor: financasFiltradas.filter(f => f.tipo === 'despesa' && f.quem === 'Letícia').reduce((a, c) => a + Number(c.valor), 0), fill: '#D946EF' },
    { name: 'Ambos (Casa)', valor: financasFiltradas.filter(f => f.tipo === 'despesa' && f.quem === 'Ambos').reduce((a, c) => a + Number(c.valor), 0), fill: '#8B5CF6' }
  ];

  // --- CÁLCULOS ACADÊMICOS INDIVIDUAIS ---
  const disciplinasFiltradas = disciplinas.filter(d => (d.aluno || 'Chamone') === alunoFaculdade);
  const totalDisciplinas = disciplinasFiltradas.length;
  const mediaGeralCR = totalDisciplinas > 0 
    ? (disciplinasFiltradas.reduce((acc, d) => {
        const m = ((Number(d.nota_p1 || 0) * Number(d.peso_p1 || 1)) + (Number(d.nota_p2 || 0) * Number(d.peso_p2 || 1))) / (Number(d.peso_p1 || 1) + Number(d.peso_p2 || 1));
        return acc + m;
      }, 0) / totalDisciplinas).toFixed(1)
    : '0.0';

  const disciplinasAprovadas = disciplinasFiltradas.filter(d => {
    const m = ((Number(d.nota_p1 || 0) * Number(d.peso_p1 || 1)) + (Number(d.nota_p2 || 0) * Number(d.peso_p2 || 1))) / (Number(d.peso_p1 || 1) + Number(d.peso_p2 || 1));
    return m >= 60 && d.faltas <= d.max_faltas;
  }).length;

  const notaNecessaria60 = Math.max(0, ((60 * (simPesoP1 + simPesoP2)) - (simP1 * simPesoP1)) / simPesoP2).toFixed(1);
  const notaNecessaria40 = Math.max(0, ((40 * (simPesoP1 + simPesoP2)) - (simP1 * simPesoP1)) / simPesoP2).toFixed(1);

  // ==========================================
  // TELA DE LOGIN & CADASTRO
  // ==========================================
  if (!sessao) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 text-slate-100 font-sans">
        <div className="bg-[#111726] border border-slate-800/80 w-full max-w-sm rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 mb-6 mx-auto border border-emerald-500/20">
            {modoCadastro ? <UserPlus className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <h2 className="text-xl font-bold text-center text-slate-100">{modoCadastro ? 'Criar Nova Conta' : 'Acesso Restrito'}</h2>
          <p className="text-xs text-slate-400 text-center mt-1 mb-6">Central Chamone & Letícia</p>

          <form onSubmit={autenticarUsuario} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">E-mail</label>
              <input type="email" required value={emailLogin} onChange={e => setEmailLogin(e.target.value)} placeholder="seu@email.com" className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Senha</label>
              <input type="password" required value={senhaLogin} onChange={e => setSenhaLogin(e.target.value)} placeholder="••••••••" className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors" />
            </div>

            {erroLogin && <p className="text-xs text-rose-400 font-medium text-center">{erroLogin}</p>}

            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 rounded-xl transition-all cursor-pointer text-sm shadow-lg shadow-emerald-500/10 mt-2">
              {modoCadastro ? 'Criar Conta e Entrar' : 'Entrar na Central'}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-slate-800/60 pt-4">
            <button onClick={() => { setModoCadastro(!modoCadastro); setErroLogin(''); }} className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer">
              {modoCadastro ? 'Já possui uma conta? Voltar ao Login' : 'Primeiro acesso? Crie sua conta aqui'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // TELA PRINCIPAL
  // ==========================================
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans p-4 md:p-8">
      {/* HEADER */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 pb-6 border-b border-slate-800/60">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">Central de Controle</h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1 flex items-center gap-2">
            <span>Gestão Chamone & Letícia</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">{sessao.user.email}</span>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between">
          <div className="flex bg-[#111726] p-1 rounded-xl border border-slate-800/80">
            <button onClick={() => setAba('financas')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer ${aba === 'financas' ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'}`}>
              <Wallet className="w-4 h-4" /> Finanças
            </button>
            <button onClick={() => setAba('faculdade')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer ${aba === 'faculdade' ? 'bg-slate-800 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-white'}`}>
              <GraduationCap className="w-4 h-4" /> Faculdade
            </button>
            <button onClick={() => setAba('agenda')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer ${aba === 'agenda' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400 hover:text-white'}`}>
              <Calendar className="w-4 h-4" /> Agenda
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (aba === 'financas') setModalFin(true);
                else if (aba === 'faculdade') setModalDisc(true);
                else setModalAgenda(true);
              }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs md:text-sm shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{aba === 'financas' ? 'Novo Lançamento' : aba === 'faculdade' ? 'Nova Disciplina' : 'Novo Compromisso'}</span>
            </button>

            <button onClick={fazerLogout} title="Sair" className="p-2.5 bg-[#111726] hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800/80 rounded-xl transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium">Carregando dados...</p>
        </div>
      ) : (
        <>
          {/* ========================================== */}
          {/* MÓDULO 1: FINANÇAS PESSOAIS */}
          {/* ========================================== */}
          {aba === 'financas' && (
            <div className="space-y-6 animate-fadeIn">
              {/* FILTROS COM SELETOR DE PERÍODO */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111726] p-4 rounded-2xl border border-slate-800/60">
                <div className="flex flex-wrap items-center gap-4">
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Pessoa:</span>
                    <div className="flex gap-1 bg-[#0b0f19] p-1 rounded-lg border border-slate-800">
                      {[
                        { id: 'Todos', label: 'Todos (Geral)' },
                        { id: 'Chamone', label: 'Chamone' },
                        { id: 'Letícia', label: 'Letícia' },
                        { id: 'Ambos', label: 'Ambos (Casal)' }
                      ].map((q) => (
                        <button key={q.id} onClick={() => setFiltroQuem(q.id)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${filtroQuem === q.id ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-500 hover:text-slate-300'}`}>
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Conta:</span>
                    <select value={filtroCartao} onChange={e => setFiltroCartao(e.target.value)} className="bg-[#0b0f19] border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500">
                      <option value="Todos">Todas</option>
                      <option value="Caju">Caju</option>
                      <option value="Intercred">Intercred</option>
                      <option value="Nubank">Nubank</option>
                      <option value="XP">XP</option>
                      <option value="Débito / Pix">Débito / Pix</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Período:</span>
                    <select 
                      value={filtroPeriodo} 
                      onChange={e => setFiltroPeriodo(e.target.value)} 
                      className="bg-[#0b0f19] border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-400 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Todos">Todo o Período</option>
                      <option value="MesAtual">Mês Atual</option>
                      <option value="MesAnterior">Mês Anterior</option>
                      <option value="Trimestre">Últimos 3 Meses</option>
                      <option value="Ano">Ano Atual</option>
                    </select>
                  </div>

                </div>

                <button onClick={exportarParaExcel} className="flex items-center gap-2 bg-[#0b0f19] hover:bg-emerald-500/10 text-slate-300 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/30 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Baixar Planilha Excel (.xlsx)</span>
                </button>
              </div>

              {/* CARDS KPI */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-[#111726] border border-slate-800/60 p-4 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium block">Receitas</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">R$ {receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-[#111726] border border-slate-800/60 p-4 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium block">Despesas Fixas</span>
                  <span className="text-lg font-bold text-rose-400 mt-1 block">R$ {despesasFixas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-[#111726] border border-slate-800/60 p-4 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium block">Despesas Variáveis</span>
                  <span className="text-lg font-bold text-amber-400 mt-1 block">R$ {despesasVariaveis.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-[#111726] border border-slate-800/60 p-4 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium block">Investimentos</span>
                  <span className="text-lg font-bold text-cyan-400 mt-1 block">R$ {investimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-[#111726] border border-slate-800/60 p-4 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium block">Saldo Líquido</span>
                  <span className={`text-lg font-bold mt-1 block ${saldo >= 0 ? 'text-blue-400' : 'text-rose-500'}`}>R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-[#111726] border border-slate-800/60 p-4 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium block">Poupança</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">{taxaPoupança}%</span>
                </div>
              </div>

              {/* GRÁFICOS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-[#111726] border border-slate-800/60 p-5 rounded-xl">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Divisão de Custos (Família)</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gastosPorPessoa} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} textAnchor="end" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }} formatter={(val: any) => `R$ ${Number(val).toFixed(2)}`} />
                        <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                          {gastosPorPessoa.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#111726] border border-slate-800/60 p-5 rounded-xl">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Gastos por Cartão</h3>
                  <div className="h-52">
                    {gastosPorCartao.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={gastosPorCartao} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4}>
                            {gastosPorCartao.map((entry, index) => (<Cell key={`cell-${index}`} fill={CORES_CARTOES[entry.name] || CORES_GRAFICO[index % CORES_GRAFICO.length]} />))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }} formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (<div className="flex items-center justify-center h-full text-xs text-slate-500">Sem dados</div>)}
                  </div>
                </div>

                <div className="bg-[#111726] border border-slate-800/60 p-5 rounded-xl">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Categorias</h3>
                  <div className="h-52">
                    {despesasPorCategoria.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={despesasPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4}>
                            {despesasPorCategoria.map((entry, index) => (<Cell key={`cell-${index}`} fill={CORES_CATEGORIAS[entry.name] || CORES_GRAFICO[index % CORES_GRAFICO.length]} />))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }} formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (<div className="flex items-center justify-center h-full text-xs text-slate-500">Sem dados</div>)}
                  </div>
                </div>
              </div>

              {/* TABELA DE LANÇAMENTOS */}
              <div className="bg-[#111726] border border-slate-800/60 p-5 rounded-xl">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Histórico Detalhado</h3>
                {financasFiltradas.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase font-semibold">
                          <th className="pb-3">Descrição</th>
                          <th className="pb-3">Quem</th>
                          <th className="pb-3">Conta / Cartão</th>
                          <th className="pb-3">Categoria</th>
                          <th className="pb-3">Tipo</th>
                          <th className="pb-3">Data</th>
                          <th className="pb-3 text-right">Valor</th>
                          <th className="pb-3 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-xs">
                        {financasFiltradas.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="py-3.5 font-medium text-slate-200">
                              {f.descricao}
                              {f.total_parcelas > 1 && (<span className="ml-2 text-[10px] bg-[#0b0f19] text-slate-300 px-1.5 py-0.5 rounded border border-slate-800 font-normal">{f.parcela_atual}/{f.total_parcelas}</span>)}
                            </td>
                            <td className="py-3.5"><span className="text-slate-300 font-medium">{f.quem || 'Chamone'}</span></td>
                            <td className="py-3.5 text-slate-400">{f.cartao || 'Débito / Pix'}</td>
                            <td className="py-3.5"><span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: `${CORES_CATEGORIAS[f.categoria] || '#64748B'}15`, color: CORES_CATEGORIAS[f.categoria] || '#94A3B8' }}>{f.categoria}</span></td>
                            <td className="py-3.5 text-slate-400">{f.tipo_gasto || 'Variável'}</td>
                            <td className="py-3.5 text-slate-400">{f.data.split('-').reverse().join('/')}</td>
                            <td className={`py-3.5 text-right font-semibold ${f.tipo === 'receita' ? 'text-emerald-400' : 'text-slate-200'}`}>{f.tipo === 'receita' ? '+' : '-'} R$ {Number(f.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="py-3.5 text-center"><button onClick={() => removerTransacao(f.id)} className="text-slate-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (<div className="text-center py-8 text-slate-500 text-xs">Nenhum lançamento com esses filtros.</div>)}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* MÓDULO 2: GESTÃO ACADÊMICA */}
          {/* ========================================== */}
          {aba === 'faculdade' && (
            <div className="space-y-6 animate-fadeIn">
              {/* SELETOR DE ALUNO E EXPORTAÇÃO */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111726] p-4 rounded-2xl border border-slate-800/60">
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-5 h-5 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase">Visualizar Notas de:</span>
                  <div className="flex gap-1 bg-[#0b0f19] p-1 rounded-lg border border-slate-800">
                    {(['Chamone', 'Letícia'] as const).map((aluno) => (
                      <button 
                        key={aluno}
                        onClick={() => setAlunoFaculdade(aluno)}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${alunoFaculdade === aluno ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        {aluno}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={exportarParaExcel} className="flex items-center gap-2 bg-[#0b0f19] hover:bg-cyan-500/10 text-slate-300 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/30 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm">
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                  <span>Baixar Planilha de Notas (.xlsx)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#111726] border border-slate-800/60 p-5 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium block uppercase tracking-wider">CR Ponderado ({alunoFaculdade})</span>
                  <span className={`text-2xl font-bold mt-1 block ${Number(mediaGeralCR) >= 60 ? 'text-cyan-400' : 'text-amber-400'}`}>{mediaGeralCR} <span className="text-xs font-normal text-slate-500">/ 100</span></span>
                </div>
                <div className="bg-[#111726] border border-slate-800/60 p-5 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium block uppercase tracking-wider">Matérias de {alunoFaculdade}</span>
                  <span className="text-2xl font-bold text-slate-100 mt-1 block">{totalDisciplinas}</span>
                </div>
                <div className="bg-[#111726] border border-slate-800/60 p-5 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium block uppercase tracking-wider">Aprovação Garantida (≥ 60)</span>
                  <span className="text-2xl font-bold text-emerald-400 mt-1 block">{disciplinasAprovadas} <span className="text-xs font-normal text-slate-500">/ {totalDisciplinas}</span></span>
                </div>
              </div>

              {/* SIMULADOR PREDITIVO */}
              <div className="bg-[#111726] border border-slate-800/60 p-6 rounded-xl">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-200">Simulador de Notas (Escala 0 a 100)</h3>
                  <p className="text-xs text-slate-400">Calcule a meta de pontos para a próxima prova ou exame final</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#0b0f19] p-4 rounded-lg border border-slate-800/60">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1">Nota da P1 (0 a 100):</label>
                    <input type="number" max="100" value={simP1 || ''} onChange={e => setSimP1(parseFloat(e.target.value) || 0)} className="w-full bg-[#111726] border border-slate-800 rounded-lg p-2 text-slate-100 text-xs font-semibold focus:outline-none focus:border-cyan-500" placeholder="Ex: 55" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1">Peso da P1:</label>
                    <input type="number" value={simPesoP1} onChange={e => setSimPesoP1(parseFloat(e.target.value) || 1)} className="w-full bg-[#111726] border border-slate-800 rounded-lg p-2 text-slate-100 text-xs focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1">Peso da P2:</label>
                    <input type="number" value={simPesoP2} onChange={e => setSimPesoP2(parseFloat(e.target.value) || 1)} className="w-full bg-[#111726] border border-slate-800 rounded-lg p-2 text-slate-100 text-xs focus:outline-none focus:border-cyan-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-3.5 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-emerald-400 font-semibold block uppercase">Aprovação Direta (≥ 60 pts)</span>
                      <span className="text-[11px] text-slate-400">Nota necessária na P2:</span>
                    </div>
                    <span className="text-xl font-bold text-emerald-400">{Number(notaNecessaria60) > 100 ? 'Impossível ❌' : `${notaNecessaria60} pts`}</span>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/20 p-3.5 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-amber-400 font-semibold block uppercase">Exame Especial (≥ 40 pts)</span>
                      <span className="text-[11px] text-slate-400">Nota mínima na P2 para não reprovar:</span>
                    </div>
                    <span className="text-xl font-bold text-amber-400">{Number(notaNecessaria40) > 100 ? 'Reprovado ❌' : `${notaNecessaria40} pts`}</span>
                  </div>
                </div>
              </div>

              {/* LISTA DE DISCIPLINAS */}
              <div className="bg-[#111726] border border-slate-800/60 p-6 rounded-xl">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Disciplinas Cadastradas para {alunoFaculdade}</h3>
                {disciplinasFiltradas.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {disciplinasFiltradas.map((d) => {
                      const media = ((Number(d.nota_p1 || 0) * Number(d.peso_p1 || 1)) + (Number(d.nota_p2 || 0) * Number(d.peso_p2 || 1))) / (Number(d.peso_p1 || 1) + Number(d.peso_p2 || 1));
                      const riscoFaltas = d.faltas >= d.max_faltas * 0.75;
                      const reprovadoFalta = d.faltas > d.max_faltas;
                      
                      let statusBadge = { texto: 'Aprovado ✅', cor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
                      if (reprovadoFalta) statusBadge = { texto: 'Reprovado Faltas ❌', cor: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
                      else if (media < 40) statusBadge = { texto: 'Reprovado Nota ❌', cor: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
                      else if (media < 60) statusBadge = { texto: 'Exame Especial ⚠️', cor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };

                      return (
                        <div key={d.id} className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800/80 flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h4 className="font-bold text-sm text-slate-200">{d.nome}</h4>
                                <span className="text-[11px] text-slate-500 font-medium">{d.semestre}</span>
                              </div>
                              <button onClick={() => removerDisciplina(d.id)} className="text-slate-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="mt-2.5 inline-block">
                              <span className={`text-[11px] px-2 py-0.5 rounded font-medium border ${statusBadge.cor}`}>{statusBadge.texto}</span>
                            </div>
                          </div>

                          <div className="bg-[#111726] p-2.5 rounded-lg border border-slate-800/40 space-y-1.5">
                            <div className="flex justify-between text-[11px] text-slate-400">
                              <span>P1 (Peso {d.peso_p1}): <strong className="text-slate-200">{d.nota_p1 || '0'}</strong></span>
                              <span>P2 (Peso {d.peso_p2}): <strong className="text-slate-200">{d.nota_p2 || '0'}</strong></span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-slate-800/60 text-xs">
                              <span className="text-slate-400 font-medium">Média:</span>
                              <span className="font-bold text-sm text-slate-100">{media.toFixed(1)}</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                              <span>Faltas: <strong className={riscoFaltas ? 'text-rose-400' : 'text-slate-200'}>{d.faltas}</strong> / {d.max_faltas}</span>
                              {riscoFaltas && <span className="text-rose-400 font-semibold flex items-center gap-1 text-[10px]"><AlertTriangle className="w-3 h-3"/> Risco</span>}
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full transition-all duration-300 ${riscoFaltas ? 'bg-rose-500' : 'bg-cyan-500'}`} style={{ width: `${Math.min((d.faltas / d.max_faltas) * 100, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (<div className="text-center py-8 text-slate-500 text-xs">Nenhuma matéria cadastrada para {alunoFaculdade}.</div>)}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* MÓDULO 3: AGENDA & PRÓXIMOS EVENTOS */}
          {/* ========================================== */}
          {aba === 'agenda' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#111726] border border-slate-800/60 p-6 rounded-xl">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" /> Próximos Compromissos & Lembretes
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Anote aqui provas, vencimentos de contas e eventos importantes dos próximos dias</p>
                  </div>
                </div>

                {agenda.length > 0 ? (
                  <div className="space-y-2.5">
                    {agenda.map((item) => (
                      <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${item.concluido ? 'bg-[#0b0f19]/40 border-slate-800/40 opacity-50' : 'bg-[#0b0f19] border-slate-800/80 hover:border-slate-700'}`}>
                        <div className="flex items-center gap-3.5">
                          <button onClick={() => alternarStatusAgenda(item.id, item.concluido)} className="text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer">
                            {item.concluido ? <CheckSquare className="w-5 h-5 text-emerald-400" /> : <Square className="w-5 h-5" />}
                          </button>
                          <div>
                            <p className={`text-sm font-semibold ${item.concluido ? 'line-through text-slate-500' : 'text-slate-200'}`}>{item.titulo}</p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400"/> {item.data.split('-').reverse().join('/')} às {item.hora}</span>
                              <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300 font-medium">{item.categoria}</span>
                              <span className="text-slate-400 font-medium">👤 {item.quem}</span>
                            </div>
                          </div>
                        </div>

                        <button onClick={() => removerAgenda(item.id)} className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    Nenhum compromisso agendado. Clique no botão "+ Novo Compromisso" no topo para adicionar!
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================== */}
      {/* MODAIS DE CADASTRO */}
      {/* ========================================== */}
      {modalFin && (
        <div className="fixed inset-0 bg-[#090d16]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#111726] border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setModalFin(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5"/></button>
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-400"/> Novo Lançamento</h3>
            
            <form onSubmit={salvarTransacao} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Tipo de Transação</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setTipoFin('despesa'); setCatFin('Alimentação / Mercado'); }} className={`py-2 rounded-lg font-semibold border cursor-pointer ${tipoFin === 'despesa' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-[#0b0f19] text-slate-400 border-slate-800'}`}>Despesa (-)</button>
                  <button type="button" onClick={() => { setTipoFin('receita'); setCatFin('Salário / Renda'); }} className={`py-2 rounded-lg font-semibold border cursor-pointer ${tipoFin === 'receita' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-[#0b0f19] text-slate-400 border-slate-800'}`}>Receita (+)</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#0b0f19] p-3 rounded-xl border border-slate-800/80">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">{tipoFin === 'receita' ? 'Quem Recebeu?' : 'Quem Pagou?'}</label>
                  <select value={quemFin} onChange={e => setQuemFin(e.target.value)} className="w-full bg-[#111726] border border-slate-800 rounded-lg p-2 font-medium text-slate-100">
                    <option value="Chamone">Chamone</option>
                    <option value="Letícia">Letícia</option>
                    <option value="Ambos">Ambos</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">{tipoFin === 'receita' ? 'Onde Caiu?' : 'Cartão / Forma'}</label>
                  <select value={cartaoFin} onChange={e => setCartaoFin(e.target.value)} className="w-full bg-[#111726] border border-slate-800 rounded-lg p-2 font-medium text-slate-100">
                    <option value="Débito / Pix">Débito / Pix</option>
                    <option value="Caju">Caju</option>
                    <option value="Intercred">Intercred</option>
                    <option value="Nubank">Nubank</option>
                    <option value="XP">XP</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Valor Total (R$)</label>
                  <input type="number" step="0.01" required value={valorFin} onChange={e => setValorFin(e.target.value)} placeholder="0.00" className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Classificação</label>
                  <select value={tipoGastoFin} onChange={e => setTipoGastoFin(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500">
                    <option value="Variável">Variável</option>
                    <option value="Fixo">Fixo</option>
                    {tipoFin === 'despesa' && <option value="Investimento">Investimento</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Descrição</label>
                <input type="text" value={descFin} onChange={e => setDescFin(e.target.value)} placeholder="Ex: Ifood, Aluguel, Aporte..." className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Categoria</label>
                  <select value={catFin} onChange={e => setCatFin(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500">
                    <option value="Alimentação / Mercado">Alimentação / Mercado</option>
                    <option value="FastFood / iFood">FastFood / iFood</option>
                    <option value="Moradia / Aluguel">Moradia / Aluguel</option>
                    <option value="Transporte / Uber">Transporte / Uber</option>
                    <option value="Assinaturas / Streaming">Assinaturas / Streaming</option>
                    <option value="Saúde / Farmácia">Saúde / Farmácia</option>
                    <option value="Lazer / Passeio">Lazer / Passeio</option>
                    <option value="Educação / EAD">Educação / EAD</option>
                    <option value="Roupas / Beleza">Roupas / Beleza</option>
                    <option value="Investimentos (CDB/XP)">Investimentos (CDB/XP)</option>
                    <option value="Imprevistos">Imprevistos</option>
                    <option value="Salário / Renda">Salário / Renda</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Data</label>
                  <input type="date" value={dataFin} onChange={e => setDataFin(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              {tipoFin === 'despesa' && (
                <div className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-300">
                    <input type="checkbox" checked={parceladoFin} onChange={e => setParceladoFin(e.target.checked)} className="rounded bg-slate-900 border-slate-700 w-4 h-4 text-emerald-500 focus:ring-0" />
                    <span>Compra Parcelada?</span>
                  </label>
                  {parceladoFin && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Qtd:</span>
                      <input type="number" min="2" max="36" value={totalParcelasFin} onChange={e => setTotalParcelasFin(e.target.value)} className="w-14 bg-[#111726] border border-slate-800 rounded-lg p-1 text-center font-bold text-slate-100" />
                      <span className="text-slate-400">x</span>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 rounded-xl mt-3 shadow-md cursor-pointer transition-all">
                {parceladoFin && tipoFin === 'despesa' ? `Salvar ${totalParcelasFin} Parcelas` : 'Salvar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {modalDisc && (
        <div className="fixed inset-0 bg-[#090d16]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#111726] border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setModalDisc(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5"/></button>
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-cyan-400"/> Nova Disciplina ({alunoFaculdade})</h3>
            
            <form onSubmit={salvarDisciplina} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-400 font-medium block mb-1">Nome da Disciplina</label>
                  <input type="text" required value={nomeDisc} onChange={e => setNomeDisc(e.target.value)} placeholder="Ex: Cálculo I..." className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Semestre</label>
                  <input type="text" value={semestreDisc} onChange={e => setSemestreDisc(e.target.value)} placeholder="2026.1" className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#0b0f19] p-3 rounded-xl border border-slate-800/80">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Nota P1 (0 a 100)</label>
                  <input type="number" max="100" value={p1Disc} onChange={e => setP1Disc(e.target.value)} placeholder="0" className="w-full bg-[#111726] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Peso P1</label>
                  <input type="number" step="0.1" value={pesoP1Disc} onChange={e => setPesoP1Disc(e.target.value)} className="w-full bg-[#111726] border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#0b0f19] p-3 rounded-xl border border-slate-800/80">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Nota P2 (0 a 100)</label>
                  <input type="number" max="100" value={p2Disc} onChange={e => setP2Disc(e.target.value)} placeholder="0" className="w-full bg-[#111726] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Peso P2</label>
                  <input type="number" step="0.1" value={pesoP2Disc} onChange={e => setPesoP2Disc(e.target.value)} className="w-full bg-[#111726] border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Faltas Atuais</label>
                  <input type="number" value={faltasDisc} onChange={e => setFaltasDisc(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Limite Máx Faltas</label>
                  <input type="number" value={maxFaltasDisc} onChange={e => setMaxFaltasDisc(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>

              <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-3 rounded-xl mt-3 shadow-md cursor-pointer transition-all">
                Salvar Disciplina
              </button>
            </form>
          </div>
        </div>
      )}

      {modalAgenda && (
        <div className="fixed inset-0 bg-[#090d16]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#111726] border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => setModalAgenda(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5"/></button>
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-400"/> Novo Compromisso</h3>
            
            <form onSubmit={salvarAgenda} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Título / Evento</label>
                <input type="text" required value={tituloAgenda} onChange={e => setTituloAgenda(e.target.value)} placeholder="Ex: Prova de Cálculo, Pagar Aluguel..." className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Data</label>
                  <input type="date" required value={dataAgenda} onChange={e => setDataAgenda(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Horário</label>
                  <input type="time" value={horaAgenda} onChange={e => setHoraAgenda(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Categoria</label>
                  <select value={catAgenda} onChange={e => setCatAgenda(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500">
                    <option value="Faculdade / Prova">Faculdade / Prova</option>
                    <option value="Finanças / Pagamento">Finanças / Pagamento</option>
                    <option value="Trabalho">Trabalho</option>
                    <option value="Pessoal / Lazer">Pessoal / Lazer</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">De quem é?</label>
                  <select value={quemAgenda} onChange={e => setQuemAgenda(e.target.value)} className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500">
                    <option value="Ambos">Ambos</option>
                    <option value="Chamone">Chamone</option>
                    <option value="Letícia">Letícia</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl mt-3 shadow-md cursor-pointer transition-all">
                Salvar Compromisso
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
