export type Modalidade = 'mega-sena' | 'lotofacil' | 'quina';

export type StatsPeriod = '10' | '50' | '100' | 'all';

export interface Concurso {
  id: number;
  modalidade: Modalidade;
  concurso: number;
  data_sorteio: string; // YYYY-MM-DD
  dezenas: number[]; // sorted 6 integers
  soma_dezenas: number;
  qtd_pares: number;
  ganhadores_sena: number;
  rateio_sena: number;
  ganhadores_quina: number;
  rateio_quina: number;
  ganhadores_quadra: number;
  rateio_quadra: number;
  acumulado_sena: number;
  arrecadacao_total: number;
  estimativa_premio: number;
  acumulado_virada: number;
  cidade_uf: string;
  observacao: string;
}

export interface FrequencyItem {
  dezena: number;
  frequencia: number;
  percentual: number;
  atraso: number;
  ultimoConcurso: number | null;
}

export interface SumBucket {
  faixa: string;
  min: number;
  max: number;
  quantidade: number;
  percentual: number;
  isInterquartil: boolean;
}

export interface ParityBucket {
  padrao: string;
  pares: number;
  impares: number;
  quantidade: number;
  percentual: number;
  recomendado: boolean;
}

export interface StatsResponse {
  periodo: StatsPeriod;
  totalConcursosBanco: number;
  totalAnalisado: number;
  ultimoConcurso: Concurso | null;
  mediaSoma: number;
  q1Soma: number;
  q3Soma: number;
  frequencias: FrequencyItem[];
  quentes: FrequencyItem[];
  frias: FrequencyItem[];
  maisAtrasadas: FrequencyItem[];
  distribuicaoSoma: SumBucket[];
  distribuicaoParidade: ParityBucket[];
  ultimosConcursos: Concurso[];
  combinacoesHistoricas: string[];
}

export interface GeneratorFilters {
  quantidadeJogos: number;
  dezenasPorJogo: number;
  fixas: number[];
  excluidas: number[];
  paridadesPermitidas: number[]; // number of even balls allowed (for 6-ball core or proportional)
  usarFiltroParidade: boolean;
  usarFiltroSoma: boolean;
  somaMin: number;
  somaMax: number;
  antiSequencia: boolean; // block > 2 consecutive numbers
  distribuicaoLinhasQuadrantes: boolean;
  filtroInedito: boolean;
}

export interface GeneratedGame {
  id: string;
  dezenas: number[];
  soma: number;
  pares: number;
  impares: number;
  maxSequencia: number;
  valorAposta: number;
  inedito: boolean;
}

export interface GenerationResult {
  jogos: GeneratedGame[];
  tempoMs: number;
  tentativas: number;
  aviso?: string;
}

export interface BolaoParticipante {
  id: string;
  nome: string;
  telefone: string;
  cotas_compradas: number;
  pago: boolean;
}

export interface BolaoJogo {
  id: string;
  dezenas: number[];
  valor_aposta: number;
  acertos: number | null;
  premio_estimado: number;
}

export type BolaoStatus = 'aberto' | 'fechado' | 'conferido';

export interface Bolao {
  id: string;
  titulo: string;
  modalidade: Modalidade;
  concurso_alvo: number;
  valor_cota: number;
  qtd_cotas_totais: number;
  status: BolaoStatus;
  created_at: string;
  participantes: BolaoParticipante[];
  jogos: BolaoJogo[];
  resultado_conferido?: {
    concurso: number;
    data_sorteio: string;
    dezenas: number[];
    senas: number;
    quinas: number;
    quadras: number;
    premio_total: number;
  } | null;
}

export interface SyncResponse {
  synced: number;
  latestConcurso: number;
  message: string;
  source: string;
  upToDate: boolean;
}
