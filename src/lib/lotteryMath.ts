import type {
  BolaoJogo,
  Concurso,
  GeneratedGame,
  GeneratorConfig,
  GeneratorResult,
} from '../types/lottery';

// ---------- Combinatorics & Pricing ----------

export function combinationsCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const r = Math.min(k, n - k);
  let num = 1;
  let den = 1;
  for (let i = 1; i <= r; i++) {
    num *= n - r + i;
    den *= i;
  }
  return Math.round(num / den);
}

export function calculateBetPrice(
  dezenasCount: number,
  valorApostaSimples = 5
): { combinacoes: number; valor: number } {
  const combinacoes = combinationsCount(dezenasCount, 6);
  return {
    combinacoes,
    valor: combinacoes * valorApostaSimples,
  };
}

export function gameKey(dezenas: number[]): string {
  return [...dezenas]
    .sort((a, b) => a - b)
    .map((d) => String(d).padStart(2, '0'))
    .join('-');
}

// ---------- Heuristic Checks ----------

export function hasExcessiveSequence(sorted: number[], maxConsecutive = 2): boolean {
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run++;
      if (run > maxConsecutive) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

export function hasBalancedVolanteDistribution(sorted: number[]): boolean {
  // Mega-Sena volante: 6 rows (01-10, 11-20, ..., 51-60) & 4 quadrants
  const rowCounts = new Array<number>(6).fill(0);
  const quadCounts = new Array<number>(4).fill(0);
  const maxPerRow = sorted.length <= 6 ? 3 : Math.ceil(sorted.length / 2);

  for (const n of sorted) {
    const row = Math.floor((n - 1) / 10); // 0..5
    const col = (n - 1) % 10; // 0..9
    rowCounts[row]++;
    if (rowCounts[row] > maxPerRow) return false;

    const qRow = row < 3 ? 0 : 1;
    const qCol = col < 5 ? 0 : 1;
    quadCounts[qRow * 2 + qCol]++;
  }

  const activeQuads = quadCounts.filter((c) => c > 0).length;
  // Require at least 3 quadrants occupied for balanced spread
  return activeQuads >= 3;
}

function sampleWithoutReplacement(pool: number[], count: number): number[] {
  const copy = [...pool];
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = i + Math.floor(Math.random() * (copy.length - i));
    const tmp = copy[i];
    copy[i] = copy[idx];
    copy[idx] = tmp;
    result.push(copy[i]);
  }
  return result;
}

// ---------- Smart Rejection-Sampling Generator (PRD §3.2 & §4) ----------

export function generateSmartGames(
  config: GeneratorConfig,
  historicalKeys: Set<string>
): GeneratorResult {
  const start = performance.now();
  const {
    quantidadeJogos,
    dezenasPorJogo,
    valorApostaSimples,
    fixas,
    excluidas,
    filtrarParidade,
    paridadesPermitidas,
    filtrarSoma,
    somaMin,
    somaMax,
    antiSequencia,
    distribuicaoVolante,
    filtroInedito,
  } = config;

  const fixedUnique = Array.from(new Set(fixas)).sort((a, b) => a - b);
  const excludedSet = new Set(excluidas);
  const fixedSet = new Set(fixedUnique);

  if (fixedUnique.length > dezenasPorJogo) {
    return {
      jogos: [],
      tempoMs: Number((performance.now() - start).toFixed(1)),
      tentativas: 0,
      aviso: `Você travou ${fixedUnique.length} dezenas fixas, mas o jogo tem apenas ${dezenasPorJogo} dezenas.`,
    };
  }

  const pool: number[] = [];
  for (let n = 1; n <= 60; n++) {
    if (!excludedSet.has(n) && !fixedSet.has(n)) {
      pool.push(n);
    }
  }

  const needed = dezenasPorJogo - fixedUnique.length;
  if (pool.length < needed) {
    return {
      jogos: [],
      tempoMs: Number((performance.now() - start).toFixed(1)),
      tentativas: 0,
      aviso: `Restam apenas ${pool.length} dezenas disponíveis após fixas e excluídas — são necessárias ${needed} para completar cada jogo.`,
    };
  }

  if (filtrarParidade && dezenasPorJogo === 6 && paridadesPermitidas.length === 0) {
    return {
      jogos: [],
      tempoMs: Number((performance.now() - start).toFixed(1)),
      tentativas: 0,
      aviso: 'Selecione ao menos uma proporção de Pares/Ímpares ou desative o filtro de paridade.',
    };
  }

  const { combinacoes, valor } = calculateBetPrice(dezenasPorJogo, valorApostaSimples);
  const generatedKeys = new Set<string>();
  const jogos: GeneratedGame[] = [];

  // Scale sum range proportionally when user selects >6 numbers per game
  const scaleFactor = dezenasPorJogo / 6;
  const effectiveSomaMin = Math.round(somaMin * scaleFactor);
  const effectiveSomaMax = Math.round(somaMax * scaleFactor);

  const maxIterations = Math.min(60000, Math.max(12000, quantidadeJogos * 800));
  let tentativas = 0;

  while (jogos.length < quantidadeJogos && tentativas < maxIterations) {
    tentativas++;
    const picked = needed > 0 ? sampleWithoutReplacement(pool, needed) : [];
    const candidate = [...fixedUnique, ...picked].sort((a, b) => a - b);
    const key = gameKey(candidate);

    if (generatedKeys.has(key)) continue;

    const pares = candidate.filter((n) => n % 2 === 0).length;
    const soma = candidate.reduce((acc, n) => acc + n, 0);

    // 1. Parity filter
    if (filtrarParidade) {
      if (dezenasPorJogo === 6) {
        if (!paridadesPermitidas.includes(pares)) continue;
      } else {
        const minEven = Math.floor(dezenasPorJogo * 0.3);
        const maxEven = Math.ceil(dezenasPorJogo * 0.7);
        if (pares < minEven || pares > maxEven) continue;
      }
    }

    // 2. Sum range filter
    if (filtrarSoma) {
      if (soma < effectiveSomaMin || soma > effectiveSomaMax) continue;
    }

    // 3. Anti-sequence filter (max 2 consecutive)
    if (antiSequencia && hasExcessiveSequence(candidate, 2)) continue;

    // 4. Row & Quadrant distribution filter
    if (distribuicaoVolante && !hasBalancedVolanteDistribution(candidate)) continue;

    // 5. Historical uniqueness filter (only exact 6-number match against historical draws)
    const isHistoricallyDrawn = dezenasPorJogo === 6 && historicalKeys.has(key);
    if (filtroInedito && isHistoricallyDrawn) continue;

    generatedKeys.add(key);
    jogos.push({
      id: `gen-${Date.now()}-${jogos.length}-${Math.random().toString(36).slice(2, 6)}`,
      dezenas: candidate,
      soma,
      pares,
      impares: dezenasPorJogo - pares,
      valorAposta: valor,
      combinacoesEquivalentes: combinacoes,
      inedito: !isHistoricallyDrawn,
    });
  }

  const tempoMs = Number((performance.now() - start).toFixed(1));
  let aviso: string | null = null;

  if (jogos.length === 0) {
    aviso =
      'Nenhuma combinação atendeu simultaneamente a todos os filtros. Tente relaxar a faixa de soma, paridade ou liberar mais dezenas no volante.';
  } else if (jogos.length < quantidadeJogos) {
    aviso = `Foram gerados ${jogos.length} de ${quantidadeJogos} jogos solicitados dentro do limite de segurança (${tentativas.toLocaleString('pt-BR')} tentativas). Considere ampliar os filtros para gerar um lote maior.`;
  }

  return { jogos, tempoMs, tentativas, aviso };
}

// ---------- Desdobramento Completo & Fechamentos Reduzidos (PRD §3.3) ----------

export function generateFullCombinations(
  selectedNumbers: number[],
  choose = 6
): number[][] {
  const sorted = [...selectedNumbers].sort((a, b) => a - b);
  const result: number[][] = [];
  const current: number[] = [];

  function backtrack(start: number) {
    if (current.length === choose) {
      result.push([...current]);
      return;
    }
    const remaining = choose - current.length;
    for (let i = start; i <= sorted.length - remaining; i++) {
      current.push(sorted[i]);
      backtrack(i + 1);
      current.pop();
    }
  }

  backtrack(0);
  return result;
}

export interface FechamentoPreset {
  id: string;
  nome: string;
  dezenasNecessarias: number;
  garantiaAcerto: 4 | 5;
  condicaoAcerto: 4 | 5 | 6;
  descricao: string;
  /** 1-based index tuples of length 6 */
  matriz: number[][];
}

// Verified mathematical covering designs (1-based index into user's sorted selection)
export const FECHAMENTO_PRESETS: FechamentoPreset[] = [
  {
    id: 'm8-q4-c4',
    nome: '8 dezenas — Quadra garantida (acertando 4)',
    dezenasNecessarias: 8,
    garantiaAcerto: 4,
    condicaoAcerto: 4,
    descricao:
      'Reduz de 28 para apenas 7 jogos (-75,0%) mantendo 100% de garantia matemática de Quadra caso 4 das 8 dezenas sejam sorteadas.',
    // Complement of K3(1,2,3) U K3(4,5,6) U K2(7,8): min vertex cover = 5 > 4
    matriz: [
      [3, 4, 5, 6, 7, 8],
      [2, 4, 5, 6, 7, 8],
      [1, 4, 5, 6, 7, 8],
      [1, 2, 3, 6, 7, 8],
      [1, 2, 3, 5, 7, 8],
      [1, 2, 3, 4, 7, 8],
      [1, 2, 3, 4, 5, 6],
    ],
  },
  {
    id: 'm8-q5-c5',
    nome: '8 dezenas — Quina garantida (acertando 5)',
    dezenasNecessarias: 8,
    garantiaAcerto: 5,
    condicaoAcerto: 5,
    descricao:
      'Reduz de 28 para 12 jogos (-57,1%) garantindo 100% de Quina se 5 dezenas sorteadas estiverem no seu grupo de 8.',
    // Complement of K4(1..4) U K4(5..8): min vertex cover = 6 > 5
    matriz: [
      [3, 4, 5, 6, 7, 8],
      [2, 4, 5, 6, 7, 8],
      [2, 3, 5, 6, 7, 8],
      [1, 4, 5, 6, 7, 8],
      [1, 3, 5, 6, 7, 8],
      [1, 2, 5, 6, 7, 8],
      [1, 2, 3, 4, 7, 8],
      [1, 2, 3, 4, 6, 8],
      [1, 2, 3, 4, 6, 7],
      [1, 2, 3, 4, 5, 8],
      [1, 2, 3, 4, 5, 7],
      [1, 2, 3, 4, 5, 6],
    ],
  },
  {
    id: 'm9-q4-c4',
    nome: '9 dezenas — Quadra garantida (acertando 4)',
    dezenasNecessarias: 9,
    garantiaAcerto: 4,
    condicaoAcerto: 4,
    descricao:
      'Matriz ótima de cobertura C(9,6,4): reduz de 84 para 12 jogos (-85,7%) garantindo 100% de Quadra se acertar 4 entre as 9 dezenas.',
    // 3 group-pairs + 9 Latin-square transversal complements
    matriz: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 7, 8, 9],
      [4, 5, 6, 7, 8, 9],
      [2, 3, 5, 6, 8, 9],
      [2, 3, 4, 6, 7, 9],
      [2, 3, 4, 5, 7, 8],
      [1, 3, 5, 6, 7, 9],
      [1, 3, 4, 6, 7, 8],
      [1, 3, 4, 5, 8, 9],
      [1, 2, 5, 6, 7, 8],
      [1, 2, 4, 6, 8, 9],
      [1, 2, 4, 5, 7, 9],
    ],
  },
  {
    id: 'm10-q4-c5',
    nome: '10 dezenas — Quadra garantida (acertando 5)',
    dezenasNecessarias: 10,
    garantiaAcerto: 4,
    condicaoAcerto: 5,
    descricao:
      'Reduz de 210 para apenas 14 jogos (-93,3%) garantindo 100% de Quadra se acertar 5 entre as 10 dezenas escolhidas.',
    matriz: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 7, 8, 9],
      [1, 2, 4, 7, 8, 10],
      [1, 2, 5, 6, 9, 10],
      [1, 3, 4, 5, 9, 10],
      [1, 3, 5, 7, 8, 10],
      [1, 4, 6, 7, 9, 10],
      [2, 3, 4, 6, 8, 10],
      [2, 3, 5, 6, 7, 8],
      [2, 4, 5, 7, 9, 10],
      [2, 5, 6, 8, 9, 10],
      [3, 4, 5, 6, 7, 9],
      [3, 4, 7, 8, 9, 10],
      [4, 5, 6, 7, 8, 10],
    ],
  },
  {
    id: 'm12-q4-c5',
    nome: '12 dezenas — Quadra garantida (acertando 5)',
    dezenasNecessarias: 12,
    garantiaAcerto: 4,
    condicaoAcerto: 5,
    descricao:
      'Reduz de 924 para 24 jogos (-97,4%) com altíssima cobertura combinatória para grupos de 12 dezenas em bolões.',
    matriz: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 7, 8, 9],
      [1, 2, 3, 10, 11, 12],
      [4, 5, 6, 7, 8, 9],
      [4, 5, 6, 10, 11, 12],
      [7, 8, 9, 10, 11, 12],
      [1, 2, 4, 5, 7, 10],
      [1, 2, 4, 6, 8, 11],
      [1, 2, 5, 6, 9, 12],
      [1, 3, 4, 7, 11, 12],
      [1, 3, 5, 8, 10, 12],
      [1, 3, 6, 9, 10, 11],
      [2, 3, 4, 8, 9, 10],
      [2, 3, 5, 7, 9, 11],
      [2, 3, 6, 7, 8, 12],
      [1, 4, 5, 8, 9, 11],
      [1, 4, 6, 7, 9, 12],
      [1, 5, 6, 7, 8, 10],
      [2, 4, 5, 9, 10, 12],
      [2, 4, 6, 7, 10, 11],
      [2, 5, 6, 8, 11, 12],
      [3, 4, 5, 7, 8, 12],
      [3, 4, 6, 8, 9, 11],
      [3, 5, 6, 9, 10, 11],
    ],
  },
  {
    id: 'm15-q4-c6',
    nome: '15 dezenas — Fechamento para Bolão (acertando 6)',
    dezenasNecessarias: 15,
    garantiaAcerto: 4,
    condicaoAcerto: 6,
    descricao:
      'Reduz de 5.005 para 35 jogos (-99,3%), ideal para bolões coletivos com 15 dezenas selecionadas.',
    matriz: [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 7, 8, 9],
      [1, 2, 3, 10, 11, 12],
      [1, 2, 3, 13, 14, 15],
      [4, 5, 6, 7, 8, 9],
      [4, 5, 6, 10, 11, 12],
      [4, 5, 6, 13, 14, 15],
      [7, 8, 9, 10, 11, 12],
      [7, 8, 9, 13, 14, 15],
      [10, 11, 12, 13, 14, 15],
      [1, 4, 7, 10, 13, 14],
      [2, 5, 8, 11, 14, 15],
      [3, 6, 9, 12, 13, 15],
      [1, 5, 9, 10, 12, 14],
      [2, 6, 7, 11, 13, 15],
      [3, 4, 8, 10, 11, 15],
      [1, 6, 8, 11, 12, 13],
      [2, 4, 9, 10, 12, 15],
      [3, 5, 7, 11, 12, 14],
      [1, 2, 4, 7, 11, 15],
      [1, 3, 5, 8, 12, 14],
      [2, 3, 6, 9, 10, 13],
      [4, 5, 7, 10, 12, 15],
      [4, 6, 8, 11, 13, 14],
      [5, 6, 9, 10, 11, 13],
      [7, 8, 10, 12, 13, 14],
      [7, 9, 11, 12, 13, 15],
      [8, 9, 10, 11, 14, 15],
      [1, 5, 6, 7, 9, 15],
      [2, 4, 6, 8, 9, 14],
      [3, 4, 5, 7, 8, 13],
      [1, 2, 8, 9, 10, 14],
      [1, 3, 7, 9, 11, 12],
      [2, 3, 7, 8, 12, 15],
      [4, 7, 9, 10, 11, 14],
    ],
  },
];

export function applyFechamentoPreset(
  preset: FechamentoPreset,
  selectedNumbers: number[]
): number[][] {
  const sorted = [...selectedNumbers].sort((a, b) => a - b);
  return preset.matriz.map((row) =>
    row.map((idx) => sorted[idx - 1]).sort((a, b) => a - b)
  );
}

export function verifyMatrixCoverage(preset: FechamentoPreset): {
  totalCasos: number;
  casosCobertos: number;
  percentualCobertura: number;
} {
  const n = preset.dezenasNecessarias;
  const k = preset.condicaoAcerto;
  const target = preset.garantiaAcerto;
  const universe = Array.from({ length: n }, (_, i) => i + 1);
  const allSubsets = generateFullCombinations(universe, k);

  let cobertos = 0;
  for (const drawn of allSubsets) {
    const drawnSet = new Set(drawn);
    let hit = false;
    for (const block of preset.matriz) {
      let count = 0;
      for (const item of block) {
        if (drawnSet.has(item)) count++;
      }
      if (count >= target) {
        hit = true;
        break;
      }
    }
    if (hit) cobertos++;
  }

  return {
    totalCasos: allSubsets.length,
    casosCobertos: cobertos,
    percentualCobertura:
      allSubsets.length > 0
        ? Number(((cobertos / allSubsets.length) * 100).toFixed(2))
        : 0,
  };
}

// ---------- Ticket Checking (Conferidor em Lote) ----------

export interface CheckedGameResult {
  jogo: BolaoJogo;
  acertos: number;
  dezenasAcertadas: number[];
  premioEstimado: number;
  faixa: 'Sena' | 'Quina' | 'Quadra' | null;
}

export interface BatchCheckSummary {
  resultados: CheckedGameResult[];
  totalSenas: number;
  totalQuinas: number;
  totalQuadras: number;
  premioTotalEstimado: number;
}

export function checkBolaoGames(
  jogos: BolaoJogo[],
  dezenasSorteadas: number[],
  concursoOficial?: Concurso | null
): BatchCheckSummary {
  const drawnSet = new Set(dezenasSorteadas);
  const rateioSena = concursoOficial?.rateioSena || concursoOficial?.estimativaPremio || 0;
  const rateioQuina = concursoOficial?.rateioQuina || 0;
  const rateioQuadra = concursoOficial?.rateioQuadra || 0;

  let totalSenas = 0;
  let totalQuinas = 0;
  let totalQuadras = 0;
  let premioTotalEstimado = 0;

  const resultados: CheckedGameResult[] = jogos.map((jogo) => {
    const dezenasAcertadas = jogo.dezenas.filter((d) => drawnSet.has(d));
    const acertos = dezenasAcertadas.length;
    const n = jogo.dezenas.length;

    // Multi-number bet prize multiplier (official Caixa combinatorial table)
    let senas = 0;
    let quinas = 0;
    let quadras = 0;

    if (acertos === 6) {
      senas = 1;
      quinas = 6 * (n - 6);
      quadras = 15 * combinationsCount(n - 6, 2);
    } else if (acertos === 5) {
      quinas = n - 5;
      quadras = 5 * combinationsCount(n - 5, 2);
    } else if (acertos === 4) {
      quadras = combinationsCount(n - 4, 2);
    }

    totalSenas += senas;
    totalQuinas += quinas;
    totalQuadras += quadras;

    const premioEstimado =
      senas * rateioSena + quinas * rateioQuina + quadras * rateioQuadra;
    premioTotalEstimado += premioEstimado;

    const faixa: CheckedGameResult['faixa'] =
      acertos >= 6 ? 'Sena' : acertos === 5 ? 'Quina' : acertos === 4 ? 'Quadra' : null;

    return {
      jogo: { ...jogo, acertos, premioEstimado },
      acertos,
      dezenasAcertadas,
      premioEstimado,
      faixa,
    };
  });

  return {
    resultados,
    totalSenas,
    totalQuinas,
    totalQuadras,
    premioTotalEstimado,
  };
}
