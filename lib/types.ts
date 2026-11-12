export const PESSOAS = ["Chamone", "Letícia"] as const;
export type Pessoa = (typeof PESSOAS)[number];
export type Quem = Pessoa | "Ambos";

export type TipoTransacao = "despesa" | "receita" | "transferencia";
export type StatusTransacao = "pago" | "previsto";
export type TipoGasto = "Fixo" | "Variável" | "Investimento";

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
  /** Transferência: conta que recebe */
  conta_destino?: string | null;
  /** Contas fixas: 'previsto' até ser marcada como paga */
  status?: StatusTransacao | null;
  recorrencia_id?: string | null;
  competencia?: string | null;
  import_hash?: string | null;
  importacao_id?: string | null;
  created_at?: string;
}

export type TipoConta = "corrente" | "credito" | "beneficio" | "investimento";

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
  saldo_inicial?: number | null;
  saldo_inicial_em?: string | null;
}

export type TipoCategoria = "despesa" | "receita" | "investimento";

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
  transacao_id?: string | null;
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
  carga_horaria?: number | null;
  data_p1?: string | null;
  data_p2?: string | null;
  data_p3?: string | null;
  created_at?: string;
}

export interface Recorrencia {
  id: string;
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoria: string;
  cartao: string;
  quem: Quem;
  divisao_pct: number | null;
  dia: number;
  inicio: string; // YYYY-MM
  fim: string | null; // YYYY-MM
  ativo: boolean;
  /** Meses (YYYY-MM) que o casal apagou de propósito: não são recriados */
  pulados?: string[] | null;
}

export interface Importacao {
  id: string;
  origem: string;
  conta: string;
  arquivo: string | null;
  qtd: number;
  created_at: string;
}

export interface Regra {
  id: string;
  contem: string;
  categoria: string | null;
  quem: Quem | null;
  divisao_pct: number | null;
  transferir_para: string | null;
  ignorar: boolean;
  ordem: number;
}

export interface Aula {
  id: string;
  disciplina_id: string;
  dia_semana: number; // 0 = domingo
  inicio: string; // HH:MM
  fim: string;
  sala: string | null;
  peso: number; // faltas que um encontro vale
}

export interface Presenca {
  id: string;
  disciplina_id: string;
  aula_id: string | null;
  data: string;
  presente: boolean;
  peso: number;
}

export interface AvisoConfig {
  email: string;
  pessoa: Pessoa | null;
  push: boolean;
  email_ativo: boolean;
  email_destino: string | null;
  avisos: string[];
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

export interface ColunaQuadro {
  id: string;
  nome: string;
  ordem: number;
  /** Cards nesta coluna contam como feitos */
  concluida: boolean;
}

export interface ItemChecklist {
  id: string;
  texto: string;
  feito: boolean;
}

export interface Card {
  id: string;
  coluna_id: string;
  titulo: string;
  descricao: string | null;
  quem: Quem;
  /** Projeto/assunto: Casa, Faculdade, Viagem… */
  etiqueta: string | null;
  inicio: string | null; // YYYY-MM-DD
  prazo: string | null; // YYYY-MM-DD
  ordem: number;
  checklist: ItemChecklist[];
  /** Liga o card aos gastos dessa categoria */
  categoria: string | null;
  orcamento: number | null;
  concluido_em: string | null;
  created_at?: string;
}

export type Aba =
  | "inicio"
  | "lancamentos"
  | "cartoes"
  | "orcamento"
  | "metas"
  | "casal"
  | "analises"
  | "faculdade"
  | "agenda"
  | "patrimonio"
  | "contasfixas"
  | "importar"
  | "projetos"
  | "ajustes";
