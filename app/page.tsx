'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, CartesianGrid, Legend 
} from 'recharts';
import { 
  Wallet, GraduationCap, AlertTriangle, 
  Plus, Trash2, X, Users, CreditCard, LogOut, Lock, FileSpreadsheet, Download,
  UserPlus, Calendar, CheckSquare, Square, Clock, Landmark, ShoppingBag,
  ArrowUpRight, ArrowDownRight, PieChart as PieChartIcon, Activity, Pencil
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
  'Investimentos (CDB/XP)': '#14B8A6',
  'Imprevistos': '#F97316',
  'Salário / Renda': '#22C55E',
  'Outros': '#64748B'
};

const CORES_GRAFICO = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

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
  const [aba, setAba] = useState<'financas' | 'analises' | 'faculdade' | 'agenda'>('financas');
  const [loading, setLoading] = useState(true);
  const [menuFabAberto, setMenuFabAberto] = useState(false);

  // Filtros Finanças (Iniciando com 'Todos' para não esconder os dados passados)
  const [filtroQuem, setFiltroQuem] = useState('Todos');
  const [filtroCartao, setFiltroCartao] = useState('Todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('Todos');
  const [alunoFaculdade, setAlunoFaculdade] = useState<'Chamone' | 'Letícia'>('Chamone');

  // Modais
  const [modalFin, setModalFin] = useState(false);
  const [modalDisc, setModalDisc] = useState(false);
  const [modalAgenda, setModalAgenda] = useState(false);

  // Formulário Finanças
  const [idEditandoFin, setIdEditandoFin] = useState<string | null>(null);
  const [descFin, setDescFin] = useState('');
  const [valorFin, setValorFin] = useState('');
  const [tipoFin, setTipoFin] = useState('despesa');
  const [catFin, setCatFin] = useState('Alimentação / Mercado');
  const [dataFin, setDataFin] = useState(new Date().toISOString().split('T')[0]);
  const [quemFin, setQuemFin] = useState('Chamone');
  const [cartaoFin, setCartaoFin] = useState('Conta Corrente / Pix');
  const [tipoGastoFin, setTipoGastoFin] = useState('Variável');
  
  // Recorrência e Parcelamento
  const [modoRepeticao, setModoRepeticao] = useState<'nenhuma' | 'parcelado' | 'fixo'>('nenhuma');
  const [qtdRepeticao, setQtdRepeticao] = useState('2');

  // Formulário Faculdade
  const [idEditandoDisc, setIdEditandoDisc] = useState<string | null>(null);
  const [nomeDisc, setNomeDisc] = useState('');
  const [semestreDisc, setSemestreDisc] = useState('2026.2');
  const [qtdProvasDisc, setQtdProvasDisc] = useState('2');
  const [p1Disc, setP1Disc] = useState('');
  const [pesoP1Disc, setPesoP1Disc] = useState('1');
  const [p2Disc, setP2Disc] = useState('');
  const [pesoP2Disc, setPesoP2Disc] = useState('1');
  const [p3Disc, setP3Disc] = useState('');
  const [pesoP3Disc, setPesoP3Disc] = useState('1');
  const [faltasDisc, setFaltasDisc] = useState('0');
  const [maxFaltasDisc, setMaxFaltasDisc] = useState('16');

  // Formulário Agenda
  const [tituloAgenda, setTituloAgenda] = useState('');
  const [dataAgenda, setDataAgenda] = useState(new Date().toISOString().split('T')[0]);
  const [horaAgenda, setHoraAgenda] = useState('09:00');
  const [catAgenda, setCatAgenda] = useState('Faculdade / Prova');
  const [quemAgenda, setQuemAgenda] = useState('Ambos');

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

  function exportarParaExcel() {
    if (financas.length === 0 && disciplinas.length === 0) return alert('Sem dados para exportar.');
    const workbook = XLSX.utils.book_new();

    if (financas.length > 0) {
      const dadosFin = financas.map(f => ({
        'Descrição': f.descricao, 'Quem': f.quem || 'Chamone', 'Conta/Cartão': f.cartao || 'Conta Corrente',
        'Categoria': f.categoria, 'Tipo': f.tipo, 'Classificação': f.tipo_gasto || 'Variável',
        'Data': f.data.split('-').reverse().join('/'), 'Valor (R$)': Number(f.valor),
        'Parcela/Recorrência': f.total_parcelas > 1 ? `${f.parcela_atual}/${f.total_parcelas}` : 'Única'
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dadosFin), "Finanças");
    }
    
    if (disciplinas.length > 0) {
      const dadosDisc = disciplinas.map(d => {
        let somaNotas = (Number(d.nota_p1 || 0) * Number(d.peso_p1 || 1));
        let somaPesos = Number(d.peso_p1 || 1);
        if (d.qtd_provas >= 2) { somaNotas += (Number(d.nota_p2 || 0) * Number(d.peso_p2 || 1)); somaPesos += Number(d.peso_p2 || 1); }
        if (d.qtd_provas >= 3) { somaNotas += (Number(d.nota_p3 || 0) * Number(d.peso_p3 || 1)); somaPesos += Number(d.peso_p3 || 1); }
        const media = somaNotas / (somaPesos || 1);

        return {
          'Aluno': d.aluno || 'Chamone', 'Disciplina': d.nome, 'Semestre': d.semestre, 'Qtd Provas': d.qtd_provas || 2,
          'P1': Number(d.nota_p1 || 0), 'P2': d.qtd_provas >= 2 ? Number(d.nota_p2 || 0) : '-', 'P3': d.qtd_provas >= 3 ? Number(d.nota_p3 || 0) : '-',
          'Média': Number(media.toFixed(1)), 'Faltas': Number(d.faltas || 0), 'Max Faltas': Number(d.max_faltas || 16),
          'Status': d.faltas > d.max_faltas ? 'Reprovado Faltas' : media < 40 ? 'Reprovado Nota' : media < 60 ? 'Exame Especial' : 'Aprovado'
        };
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dadosDisc), "Faculdade");
    }

    XLSX.writeFile(workbook, `ChaChaFinance_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // --- CRUD FINANÇAS ---
  function abrirNovaTransacao(tipo: string, catPadrao: string) {
    setIdEditandoFin(null);
    setTipoFin(tipo);
    setCatFin(catPadrao);
    setDescFin('');
    setValorFin('');
    setModoRepeticao('nenhuma');
    setQtdRepeticao('2');
    setModalFin(true);
    setMenuFabAberto(false);
  }

  function abrirEdicaoTransacao(f: any) {
    setIdEditandoFin(f.id);
    setDescFin(f.descricao || '');
    setValorFin(String(f.valor || 0));
    setTipoFin(f.tipo || 'despesa');
    setCatFin(f.categoria || 'Outros');
    setDataFin(f.data);
    setQuemFin(f.quem || 'Chamone');
    setCartaoFin(f.cartao || 'Conta Corrente / Pix');
    setTipoGastoFin(f.tipo_gasto || 'Variável');
    setModoRepeticao('nenhuma');
    setModalFin(true);
  }

  async function salvarTransacao(e: React.FormEvent) {
    e.preventDefault();
    if (!valorFin) return alert('Digite um valor!');
    
    if (idEditandoFin) {
      await supabase.from('financas').update({
        descricao: descFin,
        valor: parseFloat(valorFin),
        tipo: tipoFin,
        categoria: catFin,
        data: dataFin,
        quem: quemFin,
        cartao: cartaoFin,
        tipo_gasto: tipoGastoFin
      }).eq('id', idEditandoFin);
    } else {
      const isRepetido = modoRepeticao !== 'nenhuma';
      const numRepeticoes = isRepetido ? parseInt(qtdRepeticao) || 1 : 1;
      const transacoesParaSalvar = [];
      const dataBase = new Date(dataFin + 'T12:00:00');

      for (let i = 1; i <= numRepeticoes; i++) {
        const dataParcela = new Date(dataBase);
        dataParcela.setMonth(dataBase.getMonth() + (i - 1));
        
        let descFinal = descFin || catFin;
        if (modoRepeticao === 'parcelado') descFinal += ` (${i}/${numRepeticoes})`;
        else if (modoRepeticao === 'fixo' && numRepeticoes > 1) descFinal += ` (Fixo Mês ${i})`;

        transacoesParaSalvar.push({
          descricao: descFinal, 
          valor: parseFloat(valorFin), 
          tipo: tipoFin, 
          categoria: catFin,
          data: dataParcela.toISOString().split('T')[0], 
          quem: quemFin, 
          cartao: cartaoFin,
          parcela_atual: i, 
          total_parcelas: modoRepeticao === 'parcelado' ? numRepeticoes : 1, 
          tipo_gasto: tipoGastoFin
        });
      }
      await supabase.from('financas').insert(transacoesParaSalvar);
    }
    
    setModalFin(false); 
    carregarDados();
  }

  async function removerTransacao(id: string) {
    if (confirm('Tem certeza que deseja apagar este lançamento?')) { 
      await supabase.from('financas').delete().eq('id', id); 
      carregarDados(); 
    }
  }

  // --- CRUD FACULDADE ---
  function abrirNovaDisciplina() {
    setIdEditandoDisc(null);
    setNomeDisc(''); setSemestreDisc('2026.2'); setQtdProvasDisc('2');
    setP1Disc(''); setPesoP1Disc('1'); setP2Disc(''); setPesoP2Disc('1'); setP3Disc(''); setPesoP3Disc('1');
    setFaltasDisc('0'); setMaxFaltasDisc('16');
    setModalDisc(true);
    setMenuFabAberto(false);
  }

  function abrirEdicaoDisciplina(d: any) {
    setIdEditandoDisc(d.id);
    setNomeDisc(d.nome);
    setSemestreDisc(d.semestre);
    setQtdProvasDisc(d.qtd_provas ? String(d.qtd_provas) : '2');
    setP1Disc(d.nota_p1 !== null ? String(d.nota_p1) : '');
    setPesoP1Disc(d.peso_p1 ? String(d.peso_p1) : '1');
    setP2Disc(d.nota_p2 !== null ? String(d.nota_p2) : '');
    setPesoP2Disc(d.peso_p2 ? String(d.peso_p2) : '1');
    setP3Disc(d.nota_p3 !== null ? String(d.nota_p3) : '');
    setPesoP3Disc(d.peso_p3 ? String(d.peso_p3) : '1');
    setFaltasDisc(String(d.faltas || 0));
    setMaxFaltasDisc(String(d.max_faltas || 16));
    setModalDisc(true);
  }

  async function salvarDisciplina(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeDisc) return alert('Digite o nome da disciplina!');

    const payload = {
      nome: nomeDisc,
      semestre: semestreDisc,
      aluno: alunoFaculdade,
      qtd_provas: parseInt(qtdProvasDisc) || 2,
      nota_p1: parseFloat(p1Disc) || 0,
      peso_p1: parseFloat(pesoP1Disc) || 1,
      nota_p2: parseFloat(p2Disc) || 0,
      peso_p2: parseFloat(pesoP2Disc) || 1,
      nota_p3: parseFloat(p3Disc) || 0,
      peso_p3: parseFloat(pesoP3Disc) || 1,
      faltas: parseInt(faltasDisc) || 0,
      max_faltas: parseInt(maxFaltasDisc) || 16
    };

    if (idEditandoDisc) {
      await supabase.from('disciplinas').update(payload).eq('id', idEditandoDisc);
    } else {
      await supabase.from('disciplinas').insert([payload]);
    }
    
    setModalDisc(false);
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

  // --- LÓGICA DE PROTEÇÃO DE DADOS (FILTRO DE INVESTIMENTOS BLINDADO) ---
  // Impede que dados legados sem rótulo correto quebrem o sistema
  const isInvestimento = (f: any) => {
    const cat = (f.categoria || '').toLowerCase();
    const tg = (f.tipo_gasto || '').toLowerCase();
    const desc = (f.descricao || '').toLowerCase();
    
    return cat.includes('investimento') || 
           tg.includes('investimento') || 
           desc.includes('investimento') || 
           desc.includes('cdb') || 
           desc.includes('xp');
  };

  // --- FILTRAGEM INTELIGENTE DE PERÍODO ---
  const financasFiltradas = financas.filter(f => {
    const passQuem = filtroQuem === 'Todos' || f.quem === filtroQuem;
    const passCartao = filtroCartao === 'Todos' || f.cartao === filtroCartao;
    
    let passPeriodo = true;
    if (filtroPeriodo !== 'Todos' && f.data) {
      const dataGasto = new Date(f.data + 'T12:00:00');
      const hoje = new Date(); // Considerando a data atual
      
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

  // --- MATEMÁTICA FINANCEIRA BLINDADA ---
  // Somar Receitas (excluindo os investimentos que foram lançados como receita por acidente)
  const receitas = financasFiltradas.filter(f => f.tipo === 'receita' && !isInvestimento(f)).reduce((acc, cur) => acc + Number(cur.valor), 0);
  
  // Somar Despesas (excluindo qualquer tipo de investimento)
  const despesas = financasFiltradas.filter(f => f.tipo === 'despesa' && !isInvestimento(f)).reduce((acc, cur) => acc + Number(cur.valor), 0);
  
  // Somar Investimentos (Captura todos, sejam eles receitas ou despesas passadas)
  const investimentos = financasFiltradas.filter(f => isInvestimento(f)).reduce((acc, cur) => acc + Number(cur.valor), 0);

  const saldoMes = receitas - despesas;
  
  const despesasFixas = financasFiltradas.filter(f => f.tipo === 'despesa' && !isInvestimento(f) && ((f.tipo_gasto || '') === 'Fixo' || (f.descricao || '').includes('Fixo'))).reduce((acc, cur) => acc + Number(cur.valor), 0);
  const despesasVariaveis = despesas - despesasFixas;

  // --- PREPARAÇÃO DE DADOS PARA OS GRÁFICOS ---
  const despesasPorCategoria = financasFiltradas.filter(f => f.tipo === 'despesa' && !isInvestimento(f)).reduce((acc: any[], cur) => {
    const nomeCategoria = cur.categoria || 'Não Categorizado';
    const idx = acc.findIndex(item => item.name === nomeCategoria);
    if (idx >= 0) acc[idx].value += Number(cur.valor);
    else acc.push({ name: nomeCategoria, value: Number(cur.valor) });
    return acc;
  }, []);

  const gastosPorCartao = financasFiltradas.filter(f => f.tipo === 'despesa' && !isInvestimento(f)).reduce((acc: any[], cur) => {
    const cartaoNome = cur.cartao || 'Conta Corrente / Pix';
    const idx = acc.findIndex(item => item.name === cartaoNome);
    if (idx >= 0) acc[idx].value += Number(cur.valor);
    else acc.push({ name: cartaoNome, value: Number(cur.valor) });
    return acc;
  }, []);

  const gastosPorPessoa = [
    { name: 'Chamone', valor: financasFiltradas.filter(f => f.tipo === 'despesa' && f.quem === 'Chamone' && !isInvestimento(f)).reduce((a, c) => a + Number(c.valor), 0), fill: '#3B82F6' },
    { name: 'Letícia', valor: financasFiltradas.filter(f => f.tipo === 'despesa' && f.quem === 'Letícia' && !isInvestimento(f)).reduce((a, c) => a + Number(c.valor), 0), fill: '#D946EF' },
    { name: 'Ambos (Casa)', valor: financasFiltradas.filter(f => f.tipo === 'despesa' && f.quem === 'Ambos' && !isInvestimento(f)).reduce((a, c) => a + Number(c.valor), 0), fill: '#8B5CF6' }
  ].filter(item => item.valor > 0);

  const fixasVsVariaveis = [
    { name: 'Fixas', valor: despesasFixas, fill: '#EF4444' },
    { name: 'Variáveis', valor: despesasVariaveis, fill: '#F59E0B' }
  ];

  // --- CÁLCULOS ACADÊMICOS INDIVIDUAIS ---
  const disciplinasFiltradas = disciplinas.filter(d => (d.aluno || 'Chamone') === alunoFaculdade);
  const totalDisciplinas = disciplinasFiltradas.length;
  
  const mediaGeralCR = totalDisciplinas > 0 
    ? (disciplinasFiltradas.reduce((acc, d) => {
        let somaNotas = (Number(d.nota_p1 || 0) * Number(d.peso_p1 || 1));
        let somaPesos = Number(d.peso_p1 || 1);
        if (d.qtd_provas >= 2) { somaNotas += (Number(d.nota_p2 || 0) * Number(d.peso_p2 || 1)); somaPesos += Number(d.peso_p2 || 1); }
        if (d.qtd_provas >= 3) { somaNotas += (Number(d.nota_p3 || 0) * Number(d.peso_p3 || 1)); somaPesos += Number(d.peso_p3 || 1); }
        return acc + (somaNotas / (somaPesos || 1));
      }, 0) / totalDisciplinas).toFixed(1)
    : '0.0';

  const disciplinasAprovadas = disciplinasFiltradas.filter(d => {
    let somaNotas = (Number(d.nota_p1 || 0) * Number(d.peso_p1 || 1));
    let somaPesos = Number(d.peso_p1 || 1);
    if (d.qtd_provas >= 2) { somaNotas += (Number(d.nota_p2 || 0) * Number(d.peso_p2 || 1)); somaPesos += Number(d.peso_p2 || 1); }
    if (d.qtd_provas >= 3) { somaNotas += (Number(d.nota_p3 || 0) * Number(d.peso_p3 || 1)); somaPesos += Number(d.peso_p3 || 1); }
    const m = somaNotas / (somaPesos || 1);
    return m >= 60 && d.faltas <= d.max_faltas;
  }).length;

  const notaNecessaria60 = Math.max(0, ((60 * (simPesoP1 + simPesoP2)) - (simP1 * simPesoP1)) / simPesoP2).toFixed(1);
  const notaNecessaria40 = Math.max(0, ((40 * (simPesoP1 + simPesoP2)) - (simP1 * simPesoP1)) / simPesoP2).toFixed(1);

  // ==========================================
  // TELA DE LOGIN & CADASTRO
  // ==========================================
  if (!sessao) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4 text-slate-100 font-sans">
        <div className="bg-[#1E1E1E] border border-slate-800 w-full max-w-sm rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 mb-6 mx-auto">
            {modoCadastro ? <UserPlus className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-100">{modoCadastro ? 'Criar Nova Conta' : 'Acesso Restrito'}</h2>
          <p className="text-sm text-slate-400 text-center mt-2 mb-8">Central Financeira Exclusiva</p>

          <form onSubmit={autenticarUsuario} className="space-y-4">
            <div>
              <input type="email" required value={emailLogin} onChange={e => setEmailLogin(e.target.value)} placeholder="E-mail" className="w-full bg-[#2A2A2A] border border-transparent rounded-xl p-3.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" />
            </div>
            <div>
              <input type="password" required value={senhaLogin} onChange={e => setSenhaLogin(e.target.value)} placeholder="Senha" className="w-full bg-[#2A2A2A] border border-transparent rounded-xl p-3.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" />
            </div>
            {erroLogin && <p className="text-xs text-rose-400 font-medium text-center">{erroLogin}</p>}
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer text-sm mt-4">
              {modoCadastro ? 'Criar Conta' : 'Entrar na Plataforma'}
            </button>
          </form>
          <div className="mt-6 text-center border-t border-slate-800 pt-4">
            <button onClick={() => { setModoCadastro(!modoCadastro); setErroLogin(''); }} className="text-sm text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer">
              {modoCadastro ? 'Já tem conta? Faça Login' : 'Novo por aqui? Crie sua conta'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // TELA PRINCIPAL (SAAS LAYOUT)
  // ==========================================
  return (
    <div className="flex h-screen bg-[#121212] text-slate-100 font-sans overflow-hidden">
      
      {/* MENU LATERAL (SIDEBAR) */}
      <aside className="w-64 bg-[#1E1E1E] border-r border-slate-800 hidden md:flex flex-col justify-between">
        <div>
          <div className="h-20 flex items-center px-6 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">ChaCha<span className="text-emerald-400">Finance</span></span>
            </div>
          </div>
          <nav className="p-4 space-y-2">
            <button onClick={() => setAba('financas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${aba === 'financas' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
              <PieChartIcon className="w-5 h-5" /> Dashboard
            </button>
            <button onClick={() => setAba('analises')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${aba === 'analises' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
              <Activity className="w-5 h-5" /> Análises & Gráficos
            </button>
            <button onClick={() => setAba('faculdade')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${aba === 'faculdade' ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
              <GraduationCap className="w-5 h-5" /> Vida Acadêmica
            </button>
            <button onClick={() => setAba('agenda')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${aba === 'agenda' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
              <Calendar className="w-5 h-5" /> Planejamento / Agenda
            </button>
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold uppercase">{sessao.user.email.substring(0,2)}</div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-200 truncate">{sessao.user.email}</p>
              <p className="text-[10px] text-emerald-400">Gestão Compartilhada</p>
            </div>
          </div>
          <button onClick={fazerLogout} className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-rose-400 transition-colors">
            <LogOut className="w-4 h-4" /> Sair da Plataforma
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* HEADER TOP BAR */}
        <header className="h-20 bg-[#121212] border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-100 hidden md:block">
              {aba === 'financas' ? 'Dashboard Financeiro' : aba === 'analises' ? 'Análises Gráficas' : aba === 'faculdade' ? 'Controle Acadêmico' : 'Agenda do Casal'}
            </h2>
            {(aba === 'financas' || aba === 'analises') && (
              <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} className="bg-[#1E1E1E] text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option className="bg-[#1E1E1E] text-slate-200" value="MesAtual">Mês Atual</option>
                <option className="bg-[#1E1E1E] text-slate-200" value="MesAnterior">Mês Passado</option>
                <option className="bg-[#1E1E1E] text-slate-200" value="Trimestre">Últimos 3 Meses</option>
                <option className="bg-[#1E1E1E] text-slate-200" value="Ano">Este Ano</option>
                <option className="bg-[#1E1E1E] text-slate-200" value="Todos">Todo o Histórico</option>
              </select>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportarParaExcel} className="flex items-center gap-2 bg-[#1E1E1E] hover:bg-slate-800 text-slate-300 border border-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <Download className="w-4 h-4" /> <span className="hidden md:inline">Exportar Planilha</span>
            </button>
          </div>
        </header>

        {/* CONTEÚDO SCROLLÁVEL */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm">Carregando seus dados...</p>
            </div>
          ) : (
            <>
              {/* ========================================== */}
              {/* ABA: DASHBOARD FINANÇAS */}
              {/* ========================================== */}
              {aba === 'financas' && (
                <div className="space-y-6 max-w-7xl mx-auto pb-24">
                  {/* BARRA DE FILTROS AVANÇADOS */}
                  <div className="flex flex-wrap gap-4 bg-[#1E1E1E] p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-500" />
                      <select value={filtroQuem} onChange={e => setFiltroQuem(e.target.value)} className="bg-[#1E1E1E] text-sm font-medium text-slate-200 focus:outline-none cursor-pointer">
                        <option className="bg-[#1E1E1E] text-slate-200" value="Todos">Todos os Membros</option>
                        <option className="bg-[#1E1E1E] text-slate-200" value="Chamone">Chamone</option>
                        <option className="bg-[#1E1E1E] text-slate-200" value="Letícia">Letícia</option>
                        <option className="bg-[#1E1E1E] text-slate-200" value="Ambos">Ambos (Compartilhado)</option>
                      </select>
                    </div>
                    <div className="w-px h-6 bg-slate-700 hidden sm:block"></div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-500" />
                      <select value={filtroCartao} onChange={e => setFiltroCartao(e.target.value)} className="bg-[#1E1E1E] text-sm font-medium text-slate-200 focus:outline-none cursor-pointer">
                        <option className="bg-[#1E1E1E] text-slate-200" value="Todos">Todas as Contas e Vales</option>
                        <optgroup label="Contas Bancárias" className="bg-[#1E1E1E] text-slate-400">
                          <option className="text-slate-100" value="Conta Corrente / Pix">Conta Corrente / Pix</option>
                          <option className="text-slate-100" value="XP">XP Investimentos</option>
                          <option className="text-slate-100" value="Inter">Banco Inter</option>
                        </optgroup>
                        <optgroup label="Cartões de Crédito" className="bg-[#1E1E1E] text-slate-400">
                          <option className="text-slate-100" value="Cartão Intercred">Cartão Intercred</option>
                          <option className="text-slate-100" value="Cartão Nubank">Cartão Nubank</option>
                        </optgroup>
                        <optgroup label="Vales Benefício" className="bg-[#1E1E1E] text-slate-400">
                          <option className="text-slate-100" value="Caju VA">Caju (Alimentação)</option>
                          <option className="text-slate-100" value="Caju VR">Caju (Refeição)</option>
                          <option className="text-slate-100" value="Caju Cultura">Caju (Cultura/Saúde)</option>
                          <option className="text-slate-100" value="Caju Mobilidade">Caju (Mobilidade)</option>
                          <option className="text-slate-100" value="VR Padrão">VR Padrão</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* CARDS DE RESUMO AVANÇADOS */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#1E1E1E] border border-slate-800 p-5 rounded-2xl flex flex-col">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" /> <span className="text-xs font-semibold uppercase">Receitas Net</span>
                      </div>
                      <span className="text-2xl font-bold text-slate-100">R$ {receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    
                    <div className="bg-[#1E1E1E] border border-slate-800 p-5 rounded-2xl flex flex-col">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <ArrowDownRight className="w-4 h-4 text-rose-400" /> <span className="text-xs font-semibold uppercase">Despesas</span>
                      </div>
                      <span className="text-2xl font-bold text-slate-100">R$ {despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="bg-[#1E1E1E] border border-slate-800 p-5 rounded-2xl flex flex-col">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Landmark className="w-4 h-4 text-cyan-400" /> <span className="text-xs font-semibold uppercase">Aportes (Inv.)</span>
                      </div>
                      <span className="text-2xl font-bold text-cyan-400">R$ {investimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/10 border border-emerald-500/20 p-5 rounded-2xl flex flex-col">
                      <div className="flex items-center gap-2 text-emerald-400 mb-2">
                        <Wallet className="w-4 h-4" /> <span className="text-xs font-bold uppercase">Saldo (Rec. - Desp.)</span>
                      </div>
                      <span className={`text-2xl font-bold ${saldoMes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {saldoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* LISTA DE TRANSAÇÕES COMPLETA */}
                  <div className="bg-[#1E1E1E] border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-100">Lançamentos do Período Selecionado</h3>
                    </div>
                    <div className="overflow-x-auto p-2">
                      {financasFiltradas.length > 0 ? (
                        <table className="w-full text-left min-w-[600px]">
                          <thead>
                            <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                              <th className="p-3 font-semibold">Data</th>
                              <th className="p-3 font-semibold">Descrição</th>
                              <th className="p-3 font-semibold">Categoria</th>
                              <th className="p-3 font-semibold">Conta</th>
                              <th className="p-3 font-semibold">Pessoa</th>
                              <th className="p-3 font-semibold text-right">Valor</th>
                              <th className="p-3 font-semibold text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {financasFiltradas.map((f) => (
                              <tr key={f.id} className="hover:bg-[#2A2A2A] transition-colors group text-sm">
                                <td className="p-3 text-slate-400">{f.data.split('-').reverse().join('/')}</td>
                                <td className="p-3 font-semibold text-slate-200">
                                  {f.descricao} 
                                  {f.total_parcelas > 1 && <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded ml-2 font-normal text-slate-400">{f.parcela_atual}/{f.total_parcelas}</span>}
                                </td>
                                <td className="p-3">
                                  <span className="px-2 py-1 rounded-md text-[10px] font-medium" style={{ backgroundColor: `${CORES_CATEGORIAS[f.categoria] || '#64748B'}20`, color: CORES_CATEGORIAS[f.categoria] || '#94A3B8' }}>
                                    {f.categoria || 'Legado (Editar)'}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-400">{f.cartao || 'Legado (Editar)'}</td>
                                <td className="p-3 text-slate-400">{f.quem || 'Ambos'}</td>
                                <td className={`p-3 font-bold text-right ${f.tipo === 'receita' ? 'text-emerald-400' : 'text-slate-100'}`}>
                                  {f.tipo === 'receita' ? '+' : '-'} R$ {Number(f.valor).toFixed(2)}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex justify-center items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => abrirEdicaoTransacao(f)} className="text-slate-500 hover:text-cyan-400 transition-colors"><Pencil className="w-4 h-4"/></button>
                                    <button onClick={() => removerTransacao(f.id)} className="text-slate-500 hover:text-rose-400 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (<div className="text-center py-12 text-slate-500 text-sm">Nenhum lançamento encontrado.</div>)}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================== */}
              {/* ABA: ANÁLISES E GRÁFICOS */}
              {/* ========================================== */}
              {aba === 'analises' && (
                <div className="space-y-6 max-w-7xl mx-auto pb-24">
                  <h2 className="text-lg font-bold text-slate-100 mb-6">Gráficos do Período</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Gráfico 1: Categorias */}
                    <div className="bg-[#1E1E1E] border border-slate-800 p-6 rounded-2xl">
                      <h3 className="text-sm font-bold text-slate-200 mb-6 flex items-center gap-2"><PieChartIcon className="w-4 h-4 text-emerald-400"/> Despesas por Categoria</h3>
                      <div className="h-64">
                        {despesasPorCategoria.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={despesasPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={2} stroke="none">
                                {despesasPorCategoria.map((entry, index) => (<Cell key={`cell-${index}`} fill={CORES_CATEGORIAS[entry.name] || CORES_GRAFICO[index % CORES_GRAFICO.length]} />))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#2A2A2A', borderRadius: '8px', color: '#fff' }} formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (<div className="flex items-center justify-center h-full text-sm text-slate-500">Sem despesas para mapear</div>)}
                      </div>
                    </div>

                    {/* Gráfico 2: Divisão Família */}
                    <div className="bg-[#1E1E1E] border border-slate-800 p-6 rounded-2xl">
                      <h3 className="text-sm font-bold text-slate-200 mb-6 flex items-center gap-2"><Users className="w-4 h-4 text-blue-400"/> Divisão de Custos (Família)</h3>
                      <div className="h-64">
                        {gastosPorPessoa.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={gastosPorPessoa} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
                              <XAxis type="number" stroke="#64748b" tickFormatter={(val) => `R$ ${val}`} />
                              <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} textAnchor="end" />
                              <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#2A2A2A', borderRadius: '8px' }} formatter={(val: any) => `R$ ${Number(val).toFixed(2)}`} />
                              <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={30}>
                                {gastosPorPessoa.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (<div className="flex items-center justify-center h-full text-sm text-slate-500">Sem dados</div>)}
                      </div>
                    </div>

                    {/* Gráfico 3: Contas / Cartões */}
                    <div className="bg-[#1E1E1E] border border-slate-800 p-6 rounded-2xl">
                      <h3 className="text-sm font-bold text-slate-200 mb-6 flex items-center gap-2"><CreditCard className="w-4 h-4 text-amber-400"/> Origem dos Gastos (Contas e Cartões)</h3>
                      <div className="h-64">
                        {gastosPorCartao.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={gastosPorCartao} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={2} stroke="none">
                                {gastosPorCartao.map((entry, index) => (<Cell key={`cell-${index}`} fill={CORES_CARTOES[entry.name] || CORES_GRAFICO[index % CORES_GRAFICO.length]} />))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#2A2A2A', borderRadius: '8px' }} formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (<div className="flex items-center justify-center h-full text-sm text-slate-500">Sem dados</div>)}
                      </div>
                    </div>

                    {/* Gráfico 4: Fixo vs Variável */}
                    <div className="bg-[#1E1E1E] border border-slate-800 p-6 rounded-2xl">
                      <h3 className="text-sm font-bold text-slate-200 mb-6 flex items-center gap-2"><Activity className="w-4 h-4 text-rose-400"/> Tipo de Custo (Fixas x Variáveis)</h3>
                      <div className="h-64">
                        {(despesasFixas > 0 || despesasVariaveis > 0) ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={fixasVsVariaveis} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                              <XAxis dataKey="name" stroke="#64748b" />
                              <YAxis stroke="#64748b" tickFormatter={(val) => `R$ ${val}`} />
                              <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#2A2A2A', borderRadius: '8px' }} formatter={(val: any) => `R$ ${Number(val).toFixed(2)}`} cursor={{fill: '#1E1E1E'}}/>
                              <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={50}>
                                {fixasVsVariaveis.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (<div className="flex items-center justify-center h-full text-sm text-slate-500">Sem dados</div>)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================== */}
              {/* ABA: GESTÃO ACADÊMICA */}
              {/* ========================================== */}
              {aba === 'faculdade' && (
                <div className="space-y-6 max-w-7xl mx-auto pb-24 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1E1E1E] p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <GraduationCap className="w-5 h-5 text-cyan-400" />
                      <span className="text-xs font-semibold text-slate-400 uppercase">Visualizar Notas de:</span>
                      <div className="flex gap-1 bg-[#121212] p-1 rounded-lg border border-slate-800">
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#1E1E1E] border border-slate-800 p-5 rounded-xl">
                      <span className="text-[11px] text-slate-400 font-medium block uppercase tracking-wider">CR Ponderado ({alunoFaculdade})</span>
                      <span className={`text-2xl font-bold mt-1 block ${Number(mediaGeralCR) >= 60 ? 'text-cyan-400' : 'text-amber-400'}`}>{mediaGeralCR} <span className="text-xs font-normal text-slate-500">/ 100</span></span>
                    </div>
                    <div className="bg-[#1E1E1E] border border-slate-800 p-5 rounded-xl">
                      <span className="text-[11px] text-slate-400 font-medium block uppercase tracking-wider">Matérias de {alunoFaculdade}</span>
                      <span className="text-2xl font-bold text-slate-100 mt-1 block">{totalDisciplinas}</span>
                    </div>
                    <div className="bg-[#1E1E1E] border border-slate-800 p-5 rounded-xl">
                      <span className="text-[11px] text-slate-400 font-medium block uppercase tracking-wider">Aprovação Garantida (≥ 60)</span>
                      <span className="text-2xl font-bold text-emerald-400 mt-1 block">{disciplinasAprovadas} <span className="text-xs font-normal text-slate-500">/ {totalDisciplinas}</span></span>
                    </div>
                  </div>

                  <div className="bg-[#1E1E1E] border border-slate-800 p-6 rounded-xl">
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-slate-200">Simulador de Notas (Escala 0 a 100)</h3>
                      <p className="text-xs text-slate-400">Calcule a meta de pontos para a próxima prova ou exame final</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#121212] p-4 rounded-lg border border-slate-800">
                      <div>
                        <label className="text-[11px] text-slate-400 font-medium block mb-1">Nota da P1 (0 a 100):</label>
                        <input type="number" max="100" value={simP1 || ''} onChange={e => setSimP1(parseFloat(e.target.value) || 0)} className="w-full bg-[#1E1E1E] border border-slate-800 rounded-lg p-2 text-slate-100 text-xs font-semibold focus:outline-none focus:border-cyan-500" placeholder="Ex: 55" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 font-medium block mb-1">Peso da P1:</label>
                        <input type="number" value={simPesoP1} onChange={e => setSimPesoP1(parseFloat(e.target.value) || 1)} className="w-full bg-[#1E1E1E] border border-slate-800 rounded-lg p-2 text-slate-100 text-xs focus:outline-none focus:border-cyan-500" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 font-medium block mb-1">Peso da P2:</label>
                        <input type="number" value={simPesoP2} onChange={e => setSimPesoP2(parseFloat(e.target.value) || 1)} className="w-full bg-[#1E1E1E] border border-slate-800 rounded-lg p-2 text-slate-100 text-xs focus:outline-none focus:border-cyan-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-lg flex justify-between items-center">
                        <div>
                          <span className="text-[11px] text-emerald-400 font-semibold block uppercase">Aprovação Direta (≥ 60 pts)</span>
                          <span className="text-[11px] text-slate-400">Nota necessária na P2:</span>
                        </div>
                        <span className="text-xl font-bold text-emerald-400">{Number(notaNecessaria60) > 100 ? 'Impossível ❌' : `${notaNecessaria60} pts`}</span>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-lg flex justify-between items-center">
                        <div>
                          <span className="text-[11px] text-amber-400 font-semibold block uppercase">Exame Especial (≥ 40 pts)</span>
                          <span className="text-[11px] text-slate-400">Nota mínima na P2 para não reprovar:</span>
                        </div>
                        <span className="text-xl font-bold text-amber-400">{Number(notaNecessaria40) > 100 ? 'Reprovado ❌' : `${notaNecessaria40} pts`}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1E1E1E] border border-slate-800 p-6 rounded-xl">
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Disciplinas Cadastradas para {alunoFaculdade}</h3>
                    {disciplinasFiltradas.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {disciplinasFiltradas.map((d) => {
                          let somaNotas = (Number(d.nota_p1 || 0) * Number(d.peso_p1 || 1));
                          let somaPesos = Number(d.peso_p1 || 1);
                          if (d.qtd_provas >= 2) { somaNotas += (Number(d.nota_p2 || 0) * Number(d.peso_p2 || 1)); somaPesos += Number(d.peso_p2 || 1); }
                          if (d.qtd_provas >= 3) { somaNotas += (Number(d.nota_p3 || 0) * Number(d.peso_p3 || 1)); somaPesos += Number(d.peso_p3 || 1); }
                          
                          const media = somaNotas / (somaPesos || 1);
                          const riscoFaltas = d.faltas >= d.max_faltas * 0.75;
                          const reprovadoFalta = d.faltas > d.max_faltas;
                          
                          let statusBadge = { texto: 'Aprovado ✅', cor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
                          if (reprovadoFalta) statusBadge = { texto: 'Reprovado Faltas ❌', cor: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
                          else if (media < 40) statusBadge = { texto: 'Reprovado Nota ❌', cor: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
                          else if (media < 60) statusBadge = { texto: 'Exame Especial ⚠️', cor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };

                          return (
                            <div key={d.id} className="bg-[#121212] p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
                              <div>
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <h4 className="font-bold text-sm text-slate-200">{d.nome}</h4>
                                    <span className="text-[11px] text-slate-500 font-medium">{d.semestre}</span>
                                  </div>
                                  <div className="flex items-center">
                                    <button onClick={() => abrirEdicaoDisciplina(d)} className="text-slate-500 hover:text-cyan-400 transition-colors p-1 cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => removerDisciplina(d.id)} className="text-slate-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                                <div className="mt-2.5 inline-block">
                                  <span className={`text-[11px] px-2 py-0.5 rounded font-medium border ${statusBadge.cor}`}>{statusBadge.texto}</span>
                                </div>
                              </div>

                              <div className="bg-[#1E1E1E] p-2.5 rounded-lg border border-slate-800/50 space-y-1.5">
                                <div className="flex justify-between text-[11px] text-slate-400">
                                  <span>P1: <strong className="text-slate-200">{d.nota_p1 || '0'}</strong></span>
                                  {d.qtd_provas >= 2 && <span>P2: <strong className="text-slate-200">{d.nota_p2 || '0'}</strong></span>}
                                  {d.qtd_provas >= 3 && <span>P3: <strong className="text-slate-200">{d.nota_p3 || '0'}</strong></span>}
                                </div>
                                <div className="flex justify-between items-center pt-1.5 border-t border-slate-800/50 text-xs">
                                  <span className="text-slate-400 font-medium">Média Final:</span>
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
              {/* ABA: AGENDA & PLANEJAMENTO */}
              {/* ========================================== */}
              {aba === 'agenda' && (
                <div className="space-y-6 max-w-4xl mx-auto pb-24 animate-fadeIn">
                  <div className="bg-[#1E1E1E] border border-slate-800 p-6 rounded-2xl">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-400" /> Próximos Compromissos & Lembretes
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Provas, vencimentos de contas e eventos importantes.</p>
                      </div>
                      <button onClick={() => setModalAgenda(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-2">
                        <Plus className="w-4 h-4"/> Novo
                      </button>
                    </div>

                    {agenda.length > 0 ? (
                      <div className="space-y-3">
                        {agenda.map((item) => (
                          <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${item.concluido ? 'bg-[#121212]/50 border-slate-800/50 opacity-60' : 'bg-[#121212] border-slate-800 hover:border-slate-700'}`}>
                            <div className="flex items-center gap-4">
                              <button onClick={() => alternarStatusAgenda(item.id, item.concluido)} className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer">
                                {item.concluido ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5" />}
                              </button>
                              <div>
                                <p className={`text-sm font-bold ${item.concluido ? 'line-through text-slate-500' : 'text-slate-200'}`}>{item.titulo}</p>
                                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400"/> {item.data.split('-').reverse().join('/')} às {item.hora}</span>
                                  <span className="px-2 py-0.5 bg-[#1E1E1E] rounded text-slate-300 font-medium border border-slate-800">{item.categoria}</span>
                                  <span className="text-slate-400 font-medium">👤 {item.quem}</span>
                                </div>
                              </div>
                            </div>
                            <button onClick={() => removerAgenda(item.id)} className="text-slate-600 hover:text-rose-400 transition-colors p-1.5 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-500 text-sm">
                        Nenhum compromisso agendado. Clique no botão "Novo" para adicionar!
                      </div>
                    )}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
        
        {/* ========================================== */}
        {/* BOTÃO FLUTUANTE (FAB) GLOBAL */}
        {/* ========================================== */}
        <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
          {menuFabAberto && (
            <div className="flex flex-col gap-2 mb-2 items-end animate-fadeIn">
              <button onClick={() => abrirNovaDisciplina()} className="flex items-center gap-3 bg-[#1E1E1E] border border-slate-700 text-slate-200 px-4 py-2 rounded-full shadow-lg hover:bg-slate-800 transition-colors text-sm font-medium">
                Nova Disciplina <GraduationCap className="w-4 h-4 text-cyan-400"/>
              </button>
              <button onClick={() => abrirNovaTransacao('receita', 'Salário / Renda')} className="flex items-center gap-3 bg-[#1E1E1E] border border-slate-700 text-slate-200 px-4 py-2 rounded-full shadow-lg hover:bg-slate-800 transition-colors text-sm font-medium">
                Nova Receita <ArrowUpRight className="w-4 h-4 text-emerald-400"/>
              </button>
              <button onClick={() => abrirNovaTransacao('despesa', 'Alimentação / Mercado')} className="flex items-center gap-3 bg-[#1E1E1E] border border-slate-700 text-slate-200 px-4 py-2 rounded-full shadow-lg hover:bg-slate-800 transition-colors text-sm font-medium">
                Nova Despesa <ArrowDownRight className="w-4 h-4 text-rose-400"/>
              </button>
            </div>
          )}
          <button 
            onClick={() => setMenuFabAberto(!menuFabAberto)} 
            className={`w-14 h-14 bg-emerald-500 rounded-full shadow-xl flex items-center justify-center text-white hover:bg-emerald-600 transition-transform duration-300 ${menuFabAberto ? 'rotate-45 bg-rose-500 hover:bg-rose-600' : 'hover:scale-105'}`}
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>

      </main>

      {/* ========================================== */}
      {/* MODAL FINANÇAS */}
      {/* ========================================== */}
      {modalFin && (
        <div className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn">
          <div className="bg-[#1E1E1E] border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-[#121212]">
              <h3 className="text-base font-bold text-slate-100">{idEditandoFin ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
              <button onClick={() => setModalFin(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={salvarTransacao} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              
              {!idEditandoFin && (
                <div className="flex bg-[#121212] p-1 rounded-xl border border-slate-800">
                  <button type="button" onClick={() => { setTipoFin('despesa'); setTipoGastoFin('Variável'); }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tipoFin === 'despesa' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Despesa</button>
                  <button type="button" onClick={() => { setTipoFin('receita'); setTipoGastoFin('Variável'); }} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tipoFin === 'receita' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Receita</button>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Valor (R$)</label>
                <input type="number" step="0.01" required value={valorFin} onChange={e => setValorFin(e.target.value)} placeholder="0,00" className="w-full bg-[#121212] border border-slate-700 rounded-xl p-3 text-2xl text-slate-100 font-black focus:outline-none focus:border-emerald-500" />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Descrição</label>
                <input type="text" required value={descFin} onChange={e => setDescFin(e.target.value)} placeholder="Ex: Ifood, Mercado, Salário..." className="w-full bg-[#121212] border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Categoria</label>
                  <select value={catFin} onChange={e => setCatFin(e.target.value)} className="w-full bg-[#121212] text-slate-100 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500">
                    <option className="bg-[#1E1E1E] text-slate-200" value="Alimentação / Mercado">Alimentação / Mercado</option>
                    <option className="bg-[#1E1E1E] text-slate-200" value="FastFood / iFood">FastFood / iFood</option>
                    <option className="bg-[#1E1E1E] text-slate-200" value="Moradia / Aluguel">Moradia / Aluguel</option>
                    <option className="bg-[#1E1E1E] text-slate-200" value="Transporte / Uber">Transporte / Uber</option>
                    <option className="bg-[#1E1E1E] text-slate-200" value="Assinaturas / Streaming">Assinaturas / Streaming</option>
                    <option className="bg-[#1E1E1E] text-slate-200" value="Saúde / Farmácia">Saúde / Farmácia</option>
                    <option className="bg-[#1E1E1E] text-slate-200" value="Lazer / Passeio">Lazer / Passeio</option>
                    <option className="bg-[#1E1E1E] text-slate-200" value="Investimentos (CDB/XP)">Investimentos (CDB/XP)</option>
                    <option className="bg-[#1E1E1E] text-slate-200" value="Salário / Renda">Salário / Renda</option>
                    <option className="bg-[#1E1E1E] text-slate-200" value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Data</label>
                  <input type="date" value={dataFin} onChange={e => setDataFin(e.target.value)} className="w-full bg-[#121212] border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">{tipoFin === 'receita' ? 'Onde Caiu?' : 'Cartão / Forma'}</label>
                  <select value={cartaoFin} onChange={e => setCartaoFin(e.target.value)} className="w-full bg-[#121212] text-slate-100 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500">
                    <optgroup label="Contas" className="bg-[#1E1E1E] text-slate-400">
                      <option className="text-slate-200" value="Conta Corrente / Pix">Conta Corrente / Pix</option>
                      <option className="text-slate-200" value="XP">XP Investimentos</option>
                      <option className="text-slate-200" value="Inter">Banco Inter</option>
                    </optgroup>
                    <optgroup label="Cartões de Crédito" className="bg-[#1E1E1E] text-slate-400">
                      <option className="text-slate-200" value="Cartão Intercred">Cartão Intercred</option>
                      <option className="text-slate-200" value="Cartão Nubank">Cartão Nubank</option>
                    </optgroup>
                    <optgroup label="Vales Benefício" className="bg-[#1E1E1E] text-slate-400">
                      <option className="text-slate-200" value="Caju VA">Caju (Alimentação)</option>
                      <option className="text-slate-200" value="Caju VR">Caju (Refeição)</option>
                      <option className="text-slate-200" value="Caju Cultura">Caju (Cultura)</option>
                      <option className="text-slate-200" value="Caju Mobilidade">Caju (Mobilidade)</option>
                      <option className="text-slate-200" value="VR Padrão">VR Padrão</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">{tipoFin === 'receita' ? 'Quem Recebeu?' : 'Quem Pagou?'}</label>
                  <select value={quemFin} onChange={e => setQuemFin(e.target.value)} className="w-full bg-[#121212] text-slate-100 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500">
                    <option className="bg-[#1E1E1E]" value="Chamone">Chamone</option>
                    <option className="bg-[#1E1E1E]" value="Letícia">Letícia</option>
                    <option className="bg-[#1E1E1E]" value="Ambos">Ambos (Casal)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Classificação do Lançamento</label>
                <select value={tipoGastoFin} onChange={e => setTipoGastoFin(e.target.value)} className="w-full bg-[#121212] text-slate-100 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500">
                  <option className="bg-[#1E1E1E]" value="Variável">Variável / Esporádico</option>
                  <option className="bg-[#1E1E1E]" value="Fixo">Fixo / Recorrente mensalmente</option>
                  <option className="bg-[#1E1E1E]" value="Investimento">Investimento</option>
                </select>
              </div>

              {/* RECORRÊNCIA E PARCELAMENTO SÓ APARECEM NA CRIAÇÃO */}
              {!idEditandoFin && (
                <div className="bg-[#121212] p-4 rounded-xl border border-slate-800 space-y-3">
                  <label className="text-xs font-semibold text-slate-400 block">Deseja parcelar ou repetir?</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setModoRepeticao('nenhuma')} className={`flex-1 py-1.5 rounded border text-xs font-medium ${modoRepeticao === 'nenhuma' ? 'bg-slate-800 border-slate-600 text-white' : 'border-slate-800 text-slate-500'}`}>Não</button>
                    <button type="button" onClick={() => setModoRepeticao('parcelado')} className={`flex-1 py-1.5 rounded border text-xs font-medium ${modoRepeticao === 'parcelado' ? 'bg-slate-800 border-slate-600 text-white' : 'border-slate-800 text-slate-500'}`}>Parcelar</button>
                    <button type="button" onClick={() => setModoRepeticao('fixo')} className={`flex-1 py-1.5 rounded border text-xs font-medium ${modoRepeticao === 'fixo' ? 'bg-slate-800 border-slate-600 text-white' : 'border-slate-800 text-slate-500'}`}>Repetir Mensal</button>
                  </div>
                  
                  {modoRepeticao !== 'nenhuma' && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-300">{modoRepeticao === 'parcelado' ? 'Em quantas parcelas?' : 'Repetir por quantos meses?'}</span>
                      <div className="flex items-center gap-2">
                        <input type="number" min="2" max="60" value={qtdRepeticao} onChange={e => setQtdRepeticao(e.target.value)} className="w-16 bg-[#1E1E1E] border border-slate-700 rounded-lg p-1.5 text-center text-sm font-bold text-white focus:outline-none" />
                        <span className="text-xs text-slate-500">meses</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl mt-6 shadow-lg shadow-emerald-500/20 transition-transform active:scale-95">
                {idEditandoFin ? 'Salvar Edição' : 'Confirmar Lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL FACULDADE */}
      {/* ========================================== */}
      {modalDisc && (
        <div className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn">
          <div className="bg-[#1E1E1E] border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setModalDisc(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5"/></button>
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-cyan-400"/> {idEditandoDisc ? 'Editar' : 'Nova'} Disciplina ({alunoFaculdade})</h3>
            
            <form onSubmit={salvarDisciplina} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-400 font-medium block mb-1">Nome da Disciplina</label>
                  <input type="text" required value={nomeDisc} onChange={e => setNomeDisc(e.target.value)} placeholder="Ex: Cálculo I..." className="w-full bg-[#121212] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Semestre</label>
                  <input type="text" value={semestreDisc} onChange={e => setSemestreDisc(e.target.value)} placeholder="2026.2" className="w-full bg-[#121212] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Provas</label>
                  <select value={qtdProvasDisc} onChange={e => setQtdProvasDisc(e.target.value)} className="w-full bg-[#121212] text-slate-100 border border-slate-800 rounded-xl p-2.5 focus:outline-none focus:border-cyan-500">
                    <option className="bg-[#1E1E1E]" value="1">1</option>
                    <option className="bg-[#1E1E1E]" value="2">2</option>
                    <option className="bg-[#1E1E1E]" value="3">3</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#121212] p-3 rounded-xl border border-slate-800/80">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Nota P1 (0 a 100)</label>
                  <input type="number" max="100" value={p1Disc} onChange={e => setP1Disc(e.target.value)} placeholder="0" className="w-full bg-[#1E1E1E] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Peso P1</label>
                  <input type="number" step="0.1" value={pesoP1Disc} onChange={e => setPesoP1Disc(e.target.value)} className="w-full bg-[#1E1E1E] border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>

              {Number(qtdProvasDisc) >= 2 && (
                <div className="grid grid-cols-2 gap-3 bg-[#121212] p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Nota P2 (0 a 100)</label>
                    <input type="number" max="100" value={p2Disc} onChange={e => setP2Disc(e.target.value)} placeholder="0" className="w-full bg-[#1E1E1E] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Peso P2</label>
                    <input type="number" step="0.1" value={pesoP2Disc} onChange={e => setPesoP2Disc(e.target.value)} className="w-full bg-[#1E1E1E] border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500" />
                  </div>
                </div>
              )}

              {Number(qtdProvasDisc) >= 3 && (
                <div className="grid grid-cols-2 gap-3 bg-[#121212] p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Nota P3 (0 a 100)</label>
                    <input type="number" max="100" value={p3Disc} onChange={e => setP3Disc(e.target.value)} placeholder="0" className="w-full bg-[#1E1E1E] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Peso P3</label>
                    <input type="number" step="0.1" value={pesoP3Disc} onChange={e => setPesoP3Disc(e.target.value)} className="w-full bg-[#1E1E1E] border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Faltas Atuais</label>
                  <input type="number" value={faltasDisc} onChange={e => setFaltasDisc(e.target.value)} className="w-full bg-[#121212] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Limite Máx Faltas</label>
                  <input type="number" value={maxFaltasDisc} onChange={e => setMaxFaltasDisc(e.target.value)} className="w-full bg-[#121212] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>

              <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-3 rounded-xl mt-3 shadow-md cursor-pointer transition-all">
                {idEditandoDisc ? 'Atualizar Disciplina' : 'Salvar Nova Disciplina'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL AGENDA */}
      {/* ========================================== */}
      {modalAgenda && (
        <div className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn">
          <div className="bg-[#1E1E1E] border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => setModalAgenda(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5"/></button>
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-400"/> Novo Compromisso</h3>
            
            <form onSubmit={salvarAgenda} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Título / Evento</label>
                <input type="text" required value={tituloAgenda} onChange={e => setTituloAgenda(e.target.value)} placeholder="Ex: Prova de Cálculo, Pagar Aluguel..." className="w-full bg-[#121212] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Data</label>
                  <input type="date" required value={dataAgenda} onChange={e => setDataAgenda(e.target.value)} className="w-full bg-[#121212] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Horário</label>
                  <input type="time" value={horaAgenda} onChange={e => setHoraAgenda(e.target.value)} className="w-full bg-[#121212] border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Categoria</label>
                  <select value={catAgenda} onChange={e => setCatAgenda(e.target.value)} className="w-full bg-[#121212] text-slate-100 border border-slate-800 rounded-xl p-2.5 focus:outline-none focus:border-amber-500">
                    <option className="bg-[#1E1E1E]" value="Faculdade / Prova">Faculdade / Prova</option>
                    <option className="bg-[#1E1E1E]" value="Finanças / Pagamento">Finanças / Pagamento</option>
                    <option className="bg-[#1E1E1E]" value="Trabalho">Trabalho</option>
                    <option className="bg-[#1E1E1E]" value="Pessoal / Lazer">Pessoal / Lazer</option>
                    <option className="bg-[#1E1E1E]" value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">De quem é?</label>
                  <select value={quemAgenda} onChange={e => setQuemAgenda(e.target.value)} className="w-full bg-[#121212] text-slate-100 border border-slate-800 rounded-xl p-2.5 focus:outline-none focus:border-amber-500">
                    <option className="bg-[#1E1E1E]" value="Ambos">Ambos</option>
                    <option className="bg-[#1E1E1E]" value="Chamone">Chamone</option>
                    <option className="bg-[#1E1E1E]" value="Letícia">Letícia</option>
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
