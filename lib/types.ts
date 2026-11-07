export const PESSOAS = ['Chamone', 'Letícia'] as const;
export type Pessoa = (typeof PESSOAS)[number];
export type Quem = Pessoa | 'Ambos';

export type TipoTransacao = 'despesa' | 'receita';
export type TipoGasto = 'Fixo' | 'Variável' | 'Investimento';

export interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoria: string;
  data: string; // YYYY-MM-DD
  quem: Quem;
  cartao: string;
  tipo_gasto: TipoGasto | string | null;
  parcela_atual: number | null;
  total_parcelas: number | null;
  grupo_id?: string | null;
  /** % da despesa que cabe à outra pessoa (acerto do casal). null = não dividida */
  divisao_pct?: number | null;
  created_at?: string;
}

export type TipoConta = 'corrente' | 'credito' | 'beneficio' | 'investimento';

export interface Conta {
  id: string;
  nome: string;
  tipo: TipoConta;
  cor: string;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  limite: number | null;
  ativo: boolean;
  ordem: number;
}

export type TipoCategoria = 'despesa' | 'receita' | 'investimento';

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoCategoria;
  cor: string;
  orcamento: number | null;
  ativo: boolean;
  ordem: number;
}

export interface Meta {
  id: string;
  nome: string;
  valor_alvo: number;
  valor_atual: number;
  prazo: string | null;
  cor: string;
  quem: Quem;
  created_at?: string;
}

export interface Acerto {
  id: string;
  de: Pessoa;
  para: Pessoa;
  valor: number;
  data: string;
  obs: string | null;
}

export interface FaturaPaga {
  id: string;
  conta: string;
  referencia: string; // YYYY-MM (mês de fechamento)
  pago_em: string;
  valor: number;
}

export interface Disciplina {
  id: string;
  nome: string;
  semestre: string;
  aluno: Pessoa;
  qtd_provas: number;
  nota_p1: number | null;
  peso_p1: number | null;
  nota_p2: number | null;
  peso_p2: number | null;
  nota_p3: number | null;
  peso_p3: number | null;
  faltas: number;
  max_faltas: number;
  created_at?: string;
}

export interface Evento {
  id: string;
  titulo: string;
  data: string;
  hora: string | null;
  categoria: string;
  quem: Quem;
  concluido: boolean;
}

export type Aba =
  | 'inicio'
  | 'lancamentos'
  | 'cartoes'
  | 'orcamento'
  | 'metas'
  | 'casal'
  | 'analises'
  | 'faculdade'
  | 'agenda'
  | 'ajustes';
