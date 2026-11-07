import type { Categoria, Conta, Quem } from './types';

/** Usados enquanto as tabelas `contas` e `categorias` ainda não existem no Supabase. */
export const CONTAS_PADRAO: Conta[] = [
  { nome: 'Conta Corrente / Pix', tipo: 'corrente', cor: '#6CCB9F' },
  { nome: 'Banco Inter', tipo: 'corrente', cor: '#F2A65A' },
  { nome: 'XP Investimentos', tipo: 'investimento', cor: '#6FC3E8' },
  { nome: 'Cartão Nubank', tipo: 'credito', cor: '#A891F0' },
  { nome: 'Cartão Intercred', tipo: 'credito', cor: '#E3B860' },
  { nome: 'Caju VA', tipo: 'beneficio', cor: '#F08A7E' },
  { nome: 'Caju VR', tipo: 'beneficio', cor: '#EE9F7A' },
  { nome: 'Caju Cultura', tipo: 'beneficio', cor: '#D79BE8' },
  { nome: 'Caju Mobilidade', tipo: 'beneficio', cor: '#7FA7E8' },
  { nome: 'VR Padrão', tipo: 'beneficio', cor: '#EE93BD' },
].map((c, i) => ({
  ...c,
  id: `padrao-conta-${i}`,
  tipo: c.tipo as Conta['tipo'],
  dia_fechamento: null,
  dia_vencimento: null,
  limite: null,
  ativo: true,
  ordem: i,
}));

export const CATEGORIAS_PADRAO: Categoria[] = [
  { nome: 'Alimentação / Mercado', tipo: 'despesa', cor: '#E3B860' },
  { nome: 'FastFood / iFood', tipo: 'despesa', cor: '#F08A7E' },
  { nome: 'Moradia / Aluguel', tipo: 'despesa', cor: '#7FA7E8' },
  { nome: 'Casa / Manutenção', tipo: 'despesa', cor: '#C9A27E' },
  { nome: 'Transporte / Uber', tipo: 'despesa', cor: '#6CCB9F' },
  { nome: 'Assinaturas / Streaming', tipo: 'despesa', cor: '#A891F0' },
  { nome: 'Saúde / Farmácia', tipo: 'despesa', cor: '#EE93BD' },
  { nome: 'Lazer / Passeio', tipo: 'despesa', cor: '#5FC4D0' },
  { nome: 'Educação / EAD', tipo: 'despesa', cor: '#8E9BF5' },
  { nome: 'Roupas / Beleza', tipo: 'despesa', cor: '#D79BE8' },
  { nome: 'Presentes', tipo: 'despesa', cor: '#E0848F' },
  { nome: 'Imprevistos', tipo: 'despesa', cor: '#F2A65A' },
  { nome: 'Outros', tipo: 'despesa', cor: '#8F96A3' },
  { nome: 'Salário / Renda', tipo: 'receita', cor: '#7DDBA3' },
  { nome: 'Freela / Extra', tipo: 'receita', cor: '#B5E07A' },
  { nome: 'Reembolso', tipo: 'receita', cor: '#9FD8C4' },
  { nome: 'Investimentos (CDB/XP)', tipo: 'investimento', cor: '#6FC3E8' },
].map((c, i) => ({
  ...c,
  id: `padrao-cat-${i}`,
  tipo: c.tipo as Categoria['tipo'],
  orcamento: null,
  ativo: true,
  ordem: i,
}));

export const COR_PESSOA: Record<Quem, string> = {
  Chamone: '#4F8FE8',
  'Letícia': '#D46A96',
  Ambos: '#B38A2E',
};

export const PALETA = [
  '#7FB2FF', '#E7A3F0', '#6CCB9F', '#E3B860', '#F08A7E', '#A891F0',
  '#5FC4D0', '#EE93BD', '#F2A65A', '#8E9BF5', '#C9A27E', '#B5E07A', '#8F96A3',
];

export const CATEGORIAS_AGENDA = ['Faculdade / Prova', 'Finanças / Pagamento', 'Trabalho', 'Casa', 'Pessoal / Lazer', 'Saúde', 'Outros'];

/** Cores de marcas de gráfico (validadas para daltonismo no fundo escuro) */
export const COR_GRAFICO = { entrada: '#2AA695', saida: '#E0654F', investe: '#3A8FC2', fixa: '#8E7CE0', variavel: '#B38A2E' };

export const NOTA_APROVACAO = 60;
export const NOTA_EXAME = 40;
