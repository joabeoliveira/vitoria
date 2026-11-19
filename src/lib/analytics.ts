import type {
  Concurso,
  FrequencyItem,
  ParityBucket,
  StatsPeriod,
  StatsResponse,
  SumBucket,
} from '../types/lottery';
import { combinationKey } from './megasena';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

export function computeMegaSenaStats(
  allConcursos: Concurso[],
  periodo: StatsPeriod
): StatsResponse {
  const sorted = [...allConcursos].sort((a, b) => a.concurso - b.concurso);
  const totalConcursosBanco = sorted.length;
  const ultimoConcurso = totalConcursosBanco > 0 ? sorted[totalConcursosBanco - 1] : null;

  let slice = sorted;
  if (periodo === '10') slice = sorted.slice(-10);
  else if (periodo === '50') slice = sorted.slice(-50);
  else if (periodo === '100') slice = sorted.slice(-100);

  const totalAnalisado = slice.length;

  // Frequency in selected period
  const freqMap = new Map<number, number>();
  for (let d = 1; d <= 60; d++) freqMap.set(d, 0);

  for (const c of slice) {
    for (const d of c.dezenas) {
      freqMap.set(d, (freqMap.get(d) || 0) + 1);
    }
  }

  // Delay (atraso) is ALWAYS measured against the full official history up to the latest draw
  const lastSeenIndex = new Map<number, number>();
  const lastSeenConcurso = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    for (const d of c.dezenas) {
      lastSeenIndex.set(d, i);
      lastSeenConcurso.set(d, c.concurso);
    }
  }

  const frequencias: FrequencyItem[] = [];
  for (let d = 1; d <= 60; d++) {
    const freq = freqMap.get(d) || 0;
    const lastIdx = lastSeenIndex.get(d);
    const atraso = lastIdx !== undefined ? totalConcursosBanco - 1 - lastIdx : totalConcursosBanco;
    frequencias.push({
      dezena: d,
      frequencia: freq,
      percentual:
        totalAnalisado > 0 ? Math.round((freq / totalAnalisado) * 1000) / 10 : 0,
      atraso,
      ultimoConcurso: lastSeenConcurso.get(d) ?? null,
    });
  }

  const quentes = [...frequencias]
    .sort((a, b) => b.frequencia - a.frequencia || a.dezena - b.dezena)
    .slice(0, 10);

  const frias = [...frequencias]
    .sort((a, b) => a.frequencia - b.frequencia || a.dezena - b.dezena)
    .slice(0, 10);

  const maisAtrasadas = [...frequencias]
    .sort((a, b) => b.atraso - a.atraso || a.dezena - b.dezena)
    .slice(0, 12);

  // Sum distribution
  const sums = slice.map((c) => c.soma_dezenas).sort((a, b) => a - b);
  const mediaSoma =
    sums.length > 0
      ? Math.round((sums.reduce((acc, v) => acc + v, 0) / sums.length) * 10) / 10
      : 183;
  const q1Soma = sums.length > 0 ? percentile(sums, 0.25) : 155;
  const q3Soma = sums.length > 0 ? percentile(sums, 0.75) : 211;

  const sumRanges = [
    { faixa: '< 110', min: 21, max: 109 },
    { faixa: '110–134', min: 110, max: 134 },
    { faixa: '135–154', min: 135, max: 154 },
    { faixa: '155–174', min: 155, max: 174 },
    { faixa: '175–194', min: 175, max: 194 },
    { faixa: '195–214', min: 195, max: 214 },
    { faixa: '215–234', min: 215, max: 234 },
    { faixa: '235–259', min: 235, max: 259 },
    { faixa: '260+', min: 260, max: 345 },
  ];

  const distribuicaoSoma: SumBucket[] = sumRanges.map((r) => {
    const qty = slice.filter((c) => c.soma_dezenas >= r.min && c.soma_dezenas <= r.max).length;
    return {
      faixa: r.faixa,
      min: r.min,
      max: r.max,
      quantidade: qty,
      percentual:
        totalAnalisado > 0 ? Math.round((qty / totalAnalisado) * 1000) / 10 : 0,
      isInterquartil: r.min >= 155 && r.max <= 214,
    };
  });

  // Parity distribution (0P/6I .. 6P/0I)
  const parityCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const c of slice) {
    if (c.qtd_pares >= 0 && c.qtd_pares <= 6) {
      parityCounts[c.qtd_pares]++;
    }
  }

  const distribuicaoParidade: ParityBucket[] = [0, 1, 2, 3, 4, 5, 6].map((pares) => {
    const impares = 6 - pares;
    const qty = parityCounts[pares];
    return {
      padrao: `${pares}P / ${impares}I`,
      pares,
      impares,
      quantidade: qty,
      percentual:
        totalAnalisado > 0 ? Math.round((qty / totalAnalisado) * 1000) / 10 : 0,
      recomendado: pares >= 2 && pares <= 4,
    };
  });

  const ultimosConcursos = [...sorted].reverse().slice(0, 15);
  const combinacoesHistoricas = sorted.map((c) => combinationKey(c.dezenas));

  return {
    periodo,
    totalConcursosBanco,
    totalAnalisado,
    ultimoConcurso,
    mediaSoma,
    q1Soma,
    q3Soma,
    frequencias,
    quentes,
    frias,
    maisAtrasadas,
    distribuicaoSoma,
    distribuicaoParidade,
    ultimosConcursos,
    combinacoesHistoricas,
  };
}
