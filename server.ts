import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { parseMegaSenaCsv, parseBrDateToIso } from './src/lib/csvParser';
import { computeMegaSenaStats } from './src/lib/analytics';
import { calculateTicketPrize, getMegaSenaBetPrice } from './src/lib/megasena';
import type { Bolao, Concurso, StatsPeriod } from './src/types/lottery';

const PORT = 3000;
const ROOT_DIR = process.cwd();
const CSV_SEED_PATH = path.join(ROOT_DIR, 'resultados_ate_3087.csv');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

interface PersistedStore {
  extraConcursos: Concurso[];
  boloes: Bolao[];
}

// In-memory indexed database
const concursosMap = new Map<number, Concurso>();
let boloesList: Bolao[] = [];

function createDefaultStarterBoloes(nextConcurso: number): Bolao[] {
  return [
    {
      id: 'bolao-inicial-1',
      titulo: `Bolão da Equipe — Concurso ${nextConcurso}`,
      modalidade: 'mega-sena',
      concurso_alvo: nextConcurso,
      valor_cota: 9.0,
      qtd_cotas_totais: 8,
      status: 'aberto',
      created_at: new Date().toISOString(),
      participantes: [
        { id: 'p-1', nome: 'Carlos Eduardo', telefone: '(11) 98412-3310', cotas_compradas: 2, pago: true },
        { id: 'p-2', nome: 'Mariana Costa', telefone: '(11) 99104-7721', cotas_compradas: 2, pago: true },
        { id: 'p-3', nome: 'Rafael Almeida', telefone: '(11) 97230-1198', cotas_compradas: 1, pago: true },
        { id: 'p-4', nome: 'Fernanda Lima', telefone: '(11) 98841-5502', cotas_compradas: 2, pago: false },
      ],
      jogos: [
        { id: 'j-1', dezenas: [5, 10, 23, 34, 42, 53], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-2', dezenas: [4, 17, 27, 33, 46, 58], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-3', dezenas: [8, 16, 29, 37, 44, 51], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-4', dezenas: [2, 13, 25, 38, 49, 60], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-5', dezenas: [6, 11, 24, 35, 47, 54], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-6', dezenas: [9, 18, 28, 37, 45, 56], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-7', dezenas: [3, 14, 22, 36, 48, 59], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-8', dezenas: [7, 19, 27, 31, 41, 52], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-9', dezenas: [10, 15, 26, 39, 43, 55], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-10', dezenas: [1, 12, 21, 32, 40, 57], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-11', dezenas: [5, 16, 28, 34, 50, 53], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
        { id: 'j-12', dezenas: [6, 17, 23, 37, 46, 58], valor_aposta: 6.0, acertos: null, premio_estimado: 0 },
      ],
      resultado_conferido: null,
    },
  ];
}

function saveStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const extraConcursos = Array.from(concursosMap.values()).filter((c) => c.concurso > 3087);
    const payload: PersistedStore = {
      extraConcursos,
      boloes: boloesList,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('[Store] Falha ao persistir dados em disco:', err);
  }
}

function loadInitialData(): void {
  // 1. Seed from resultados_ate_3087.csv
  if (fs.existsSync(CSV_SEED_PATH)) {
    const csvText = fs.readFileSync(CSV_SEED_PATH, 'utf8');
    const { concursos, erros } = parseMegaSenaCsv(csvText);
    for (const c of concursos) {
      concursosMap.set(c.concurso, c);
    }
    console.log(
      `[Seed] Carregados ${concursos.length} concursos de resultados_ate_3087.csv (${erros.length} erros).`
    );
  }

  // 2. Overlay persisted extra concursos and boloes
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as PersistedStore;
      if (Array.isArray(parsed.extraConcursos)) {
        for (const c of parsed.extraConcursos) {
          concursosMap.set(c.concurso, c);
        }
      }
      if (Array.isArray(parsed.boloes)) {
        boloesList = parsed.boloes;
      }
    } catch (err) {
      console.error('[Store] Erro ao ler store.json, inicializando novo:', err);
    }
  }

  if (boloesList.length === 0) {
    const maxNum = getMaxConcursoNumber();
    boloesList = createDefaultStarterBoloes(maxNum + 1);
    saveStore();
  }
}

function getAllConcursos(): Concurso[] {
  return Array.from(concursosMap.values()).sort((a, b) => a.concurso - b.concurso);
}

function getMaxConcursoNumber(): number {
  let max = 0;
  for (const k of concursosMap.keys()) {
    if (k > max) max = k;
  }
  return max;
}

function recalculateBolaoCota(bolao: Bolao): void {
  const totalCost = bolao.jogos.reduce((acc, j) => acc + j.valor_aposta, 0);
  if (bolao.qtd_cotas_totais > 0) {
    bolao.valor_cota = Math.round((totalCost / bolao.qtd_cotas_totais) * 100) / 100;
  }
}

interface ExternalApiDraw {
  concurso?: number;
  numero?: number;
  data?: string;
  dataApuracao?: string;
  dezenas?: string[];
  listaDezenas?: string[];
  premiacoes?: Array<{
    faixa?: number;
    descricao?: string;
    ganhadores?: number;
    valorPremio?: number;
  }>;
  listaRateioPremio?: Array<{
    faixa?: number;
    numeroDeGanhadores?: number;
    valorPremio?: number;
  }>;
  valorAcumuladoProximoConcurso?: number;
  valorArrecadado?: number;
  valorEstimadoProximoConcurso?: number;
  valorAcumuladoConcursoEspecial?: number;
  local?: string;
  observacao?: string;
}

function mapExternalDrawToConcurso(raw: ExternalApiDraw): Concurso | null {
  const numero = Number(raw.concurso ?? raw.numero ?? 0);
  if (!Number.isFinite(numero) || numero <= 0) return null;

  const rawBalls = raw.dezenas ?? raw.listaDezenas ?? [];
  const dezenas = rawBalls
    .map((b) => Number.parseInt(String(b), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 60)
    .sort((a, b) => a - b);

  if (dezenas.length !== 6) return null;

  const dateRaw = raw.data ?? raw.dataApuracao ?? '';
  let dataIso = new Date().toISOString().slice(0, 10);
  try {
    if (dateRaw) dataIso = parseBrDateToIso(dateRaw);
  } catch {
    // keep fallback
  }

  let g6 = 0, r6 = 0, g5 = 0, r5 = 0, g4 = 0, r4 = 0;

  if (Array.isArray(raw.premiacoes)) {
    for (const p of raw.premiacoes) {
      if (p.faixa === 1 || p.descricao?.includes('6')) {
        g6 = p.ganhadores ?? 0;
        r6 = p.valorPremio ?? 0;
      } else if (p.faixa === 2 || p.descricao?.includes('5')) {
        g5 = p.ganhadores ?? 0;
        r5 = p.valorPremio ?? 0;
      } else if (p.faixa === 3 || p.descricao?.includes('4')) {
        g4 = p.ganhadores ?? 0;
        r4 = p.valorPremio ?? 0;
      }
    }
  } else if (Array.isArray(raw.listaRateioPremio)) {
    for (const p of raw.listaRateioPremio) {
      if (p.faixa === 1) {
        g6 = p.numeroDeGanhadores ?? 0;
        r6 = p.valorPremio ?? 0;
      } else if (p.faixa === 2) {
        g5 = p.numeroDeGanhadores ?? 0;
        r5 = p.valorPremio ?? 0;
      } else if (p.faixa === 3) {
        g4 = p.numeroDeGanhadores ?? 0;
        r4 = p.valorPremio ?? 0;
      }
    }
  }

  return {
    id: numero,
    modalidade: 'mega-sena',
    concurso: numero,
    data_sorteio: dataIso,
    dezenas,
    soma_dezenas: dezenas.reduce((a, b) => a + b, 0),
    qtd_pares: dezenas.filter((n) => n % 2 === 0).length,
    ganhadores_sena: g6,
    rateio_sena: r6,
    ganhadores_quina: g5,
    rateio_quina: r5,
    ganhadores_quadra: g4,
    rateio_quadra: r4,
    acumulado_sena: raw.valorAcumuladoProximoConcurso ?? 0,
    arrecadacao_total: raw.valorArrecadado ?? 0,
    estimativa_premio: raw.valorEstimadoProximoConcurso ?? 0,
    acumulado_virada: raw.valorAcumuladoConcursoEspecial ?? 0,
    cidade_uf: raw.local ?? '',
    observacao: raw.observacao ?? '',
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 4500): Promise<ExternalApiDraw | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ExternalApiDraw;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function startServer() {
  loadInitialData();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // --- API ROUTES ---

  // 1. Dashboard stats
  app.get('/api/stats', (req, res) => {
    const rawPeriod = String(req.query.periodo || 'all');
    const periodo: StatsPeriod =
      rawPeriod === '10' || rawPeriod === '50' || rawPeriod === '100'
        ? rawPeriod
        : 'all';
    const stats = computeMegaSenaStats(getAllConcursos(), periodo);
    res.json(stats);
  });

  // 2. Searchable paginated concursos history
  app.get('/api/concursos', (req, res) => {
    const search = String(req.query.search || '').trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 25)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    let all = getAllConcursos().reverse();
    if (search) {
      all = all.filter((c) => {
        const numStr = String(c.concurso);
        const ballsStr = c.dezenas.map((d) => String(d).padStart(2, '0')).join(' ');
        return (
          numStr.includes(search) ||
          c.data_sorteio.includes(search) ||
          ballsStr.includes(search) ||
          c.cidade_uf.toLowerCase().includes(search)
        );
      });
    }

    res.json({
      total: all.length,
      items: all.slice(offset, offset + limit),
    });
  });

  // 3. Get single concurso by number
  app.get('/api/concursos/:numero', (req, res) => {
    const num = Number(req.params.numero);
    const found = concursosMap.get(num);
    if (!found) {
      res.status(404).json({ error: `Concurso ${num} não encontrado na base.` });
      return;
    }
    res.json(found);
  });

  // 4. Import / re-seed CSV (PRD 2.1)
  app.post('/api/concursos/import-csv', (req, res) => {
    const csvContent = typeof req.body?.csv === 'string' ? req.body.csv : '';
    if (!csvContent.trim()) {
      res.status(400).json({ error: 'Conteúdo CSV ausente.' });
      return;
    }

    const { concursos, erros } = parseMegaSenaCsv(csvContent);
    if (concursos.length === 0) {
      res.status(400).json({
        error: 'Nenhum concurso válido encontrado no arquivo CSV.',
        erros: erros.slice(0, 10),
      });
      return;
    }

    let inserted = 0;
    let updated = 0;
    for (const c of concursos) {
      if (concursosMap.has(c.concurso)) updated++;
      else inserted++;
      concursosMap.set(c.concurso, c);
    }

    saveStore();
    res.json({
      totalProcessados: concursos.length,
      inseridos: inserted,
      atualizados: updated,
      erros: erros.slice(0, 10),
      latestConcurso: getMaxConcursoNumber(),
    });
  });

  // 5. Incremental API Sync (PRD 2.2)
  app.post('/api/sync-concursos', async (req, res) => {
    const currentMax = getMaxConcursoNumber();

    // Optional manual draw upsert support
    if (req.body?.manualDraw) {
      const m = req.body.manualDraw as {
        concurso: number;
        data_sorteio: string;
        dezenas: number[];
        estimativa_premio?: number;
        rateio_sena?: number;
        rateio_quina?: number;
        rateio_quadra?: number;
        ganhadores_sena?: number;
      };
      const numero = Number(m.concurso);
      const dezenas = Array.isArray(m.dezenas)
        ? [...new Set(m.dezenas.map(Number).filter((n) => n >= 1 && n <= 60))].sort((a, b) => a - b)
        : [];
      if (!numero || dezenas.length !== 6) {
        res.status(400).json({ error: 'Informe número do concurso e 6 dezenas distintas (1 a 60).' });
        return;
      }
      const existing = concursosMap.get(numero);
      const novo: Concurso = {
        id: numero,
        modalidade: 'mega-sena',
        concurso: numero,
        data_sorteio: m.data_sorteio || new Date().toISOString().slice(0, 10),
        dezenas,
        soma_dezenas: dezenas.reduce((a, b) => a + b, 0),
        qtd_pares: dezenas.filter((n) => n % 2 === 0).length,
        ganhadores_sena: Number(m.ganhadores_sena ?? existing?.ganhadores_sena ?? 0),
        rateio_sena: Number(m.rateio_sena ?? existing?.rateio_sena ?? 0),
        ganhadores_quina: existing?.ganhadores_quina ?? 0,
        rateio_quina: Number(m.rateio_quina ?? existing?.rateio_quina ?? 0),
        ganhadores_quadra: existing?.ganhadores_quadra ?? 0,
        rateio_quadra: Number(m.rateio_quadra ?? existing?.rateio_quadra ?? 0),
        acumulado_sena: existing?.acumulado_sena ?? 0,
        arrecadacao_total: existing?.arrecadacao_total ?? 0,
        estimativa_premio: Number(m.estimativa_premio ?? existing?.estimativa_premio ?? 0),
        acumulado_virada: existing?.acumulado_virada ?? 0,
        cidade_uf: existing?.cidade_uf ?? '',
        observacao: 'Cadastrado manualmente via sincronização',
      };
      concursosMap.set(numero, novo);
      saveStore();
      res.json({
        synced: 1,
        latestConcurso: getMaxConcursoNumber(),
        message: `Concurso #${numero} salvo com sucesso (UPSERT sem duplicação).`,
        source: 'manual',
        upToDate: true,
      });
      return;
    }

    // Attempt incremental fetch from public Loterias API
    const endpoints = [
      { name: 'Loterias Caixa API', url: 'https://loteriascaixa-api.herokuapp.com/api/megasena/latest' },
      { name: 'Portal Loterias Caixa', url: 'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena' },
    ];

    let latestExternal: Concurso | null = null;
    let usedSource = 'local';

    for (const ep of endpoints) {
      const data = await fetchJsonWithTimeout(ep.url, 4000);
      if (data) {
        const mapped = mapExternalDrawToConcurso(data);
        if (mapped) {
          latestExternal = mapped;
          usedSource = ep.name;
          break;
        }
      }
    }

    if (!latestExternal) {
      res.json({
        synced: 0,
        latestConcurso: currentMax,
        message: `Base local verificada até o concurso #${currentMax}. API pública indisponível no momento — você pode importar CSV ou registrar um novo concurso manualmente.`,
        source: 'base-local',
        upToDate: true,
      });
      return;
    }

    if (latestExternal.concurso <= currentMax) {
      // Upsert latest if equal to refresh rateios without duplicating
      if (latestExternal.concurso === currentMax) {
        const existing = concursosMap.get(currentMax);
        concursosMap.set(currentMax, { ...existing, ...latestExternal });
        saveStore();
      }
      res.json({
        synced: 0,
        latestConcurso: currentMax,
        message: `Sua base já está atualizada no concurso #${currentMax} (consulta via ${usedSource}).`,
        source: usedSource,
        upToDate: true,
      });
      return;
    }

    // Fetch missing intermediate draws (capped at 15 per sync)
    let syncedCount = 0;
    const startNum = Math.max(currentMax + 1, latestExternal.concurso - 14);
    for (let num = startNum; num < latestExternal.concurso; num++) {
      const intermediate = await fetchJsonWithTimeout(
        `https://loteriascaixa-api.herokuapp.com/api/megasena/${num}`,
        3000
      );
      if (intermediate) {
        const mapped = mapExternalDrawToConcurso(intermediate);
        if (mapped) {
          concursosMap.set(mapped.concurso, mapped);
          syncedCount++;
        }
      }
    }

    concursosMap.set(latestExternal.concurso, latestExternal);
    syncedCount++;
    saveStore();

    res.json({
      synced: syncedCount,
      latestConcurso: getMaxConcursoNumber(),
      message: `${syncedCount} novo(s) concurso(s) sincronizado(s) via ${usedSource} até #${getMaxConcursoNumber()}.`,
      source: usedSource,
      upToDate: true,
    });
  });

  // --- BOLÕES CRUD & CHECKER ---

  app.get('/api/boloes', (_req, res) => {
    res.json({ boloes: boloesList });
  });

  app.post('/api/boloes', (req, res) => {
    const titulo = String(req.body?.titulo || '').trim();
    const concursoAlvo = Number(req.body?.concurso_alvo || getMaxConcursoNumber() + 1);
    const qtdCotas = Math.max(1, Number(req.body?.qtd_cotas_totais || 10));
    const initialJogos = Array.isArray(req.body?.jogos) ? req.body.jogos : [];

    if (!titulo) {
      res.status(400).json({ error: 'Informe um título para o bolão.' });
      return;
    }

    const mappedJogos = initialJogos
      .filter((j: unknown) => Array.isArray(j) && j.length >= 6 && j.length <= 15)
      .map((dezenas: number[]) => {
        const sorted = [...new Set(dezenas.map(Number))].sort((a, b) => a - b);
        return {
          id: `j-${crypto.randomUUID().slice(0, 8)}`,
          dezenas: sorted,
          valor_aposta: getMegaSenaBetPrice(sorted.length),
          acertos: null,
          premio_estimado: 0,
        };
      });

    const novoBolao: Bolao = {
      id: `bolao-${crypto.randomUUID().slice(0, 8)}`,
      titulo,
      modalidade: 'mega-sena',
      concurso_alvo: concursoAlvo,
      valor_cota: 0,
      qtd_cotas_totais: qtdCotas,
      status: 'aberto',
      created_at: new Date().toISOString(),
      participantes: [],
      jogos: mappedJogos,
      resultado_conferido: null,
    };

    recalculateBolaoCota(novoBolao);
    boloesList.unshift(novoBolao);
    saveStore();
    res.status(201).json(novoBolao);
  });

  app.patch('/api/boloes/:id', (req, res) => {
    const bolao = boloesList.find((b) => b.id === req.params.id);
    if (!bolao) {
      res.status(404).json({ error: 'Bolão não encontrado.' });
      return;
    }
    if (typeof req.body?.titulo === 'string' && req.body.titulo.trim()) {
      bolao.titulo = req.body.titulo.trim();
    }
    if (req.body?.concurso_alvo) {
      bolao.concurso_alvo = Number(req.body.concurso_alvo);
    }
    if (req.body?.qtd_cotas_totais) {
      bolao.qtd_cotas_totais = Math.max(1, Number(req.body.qtd_cotas_totais));
    }
    if (
      req.body?.status === 'aberto' ||
      req.body?.status === 'fechado' ||
      req.body?.status === 'conferido'
    ) {
      bolao.status = req.body.status;
    }
    recalculateBolaoCota(bolao);
    saveStore();
    res.json(bolao);
  });

  app.delete('/api/boloes/:id', (req, res) => {
    const before = boloesList.length;
    boloesList = boloesList.filter((b) => b.id !== req.params.id);
    if (boloesList.length === before) {
      res.status(404).json({ error: 'Bolão não encontrado.' });
      return;
    }
    saveStore();
    res.json({ deleted: true });
  });

  // Add participant
  app.post('/api/boloes/:id/participantes', (req, res) => {
    const bolao = boloesList.find((b) => b.id === req.params.id);
    if (!bolao) {
      res.status(404).json({ error: 'Bolão não encontrado.' });
      return;
    }
    const nome = String(req.body?.nome || '').trim();
    const telefone = String(req.body?.telefone || '').trim();
    const cotas = Math.max(1, Number(req.body?.cotas_compradas || 1));
    const pago = Boolean(req.body?.pago);

    if (!nome) {
      res.status(400).json({ error: 'Informe o nome do participante.' });
      return;
    }

    bolao.participantes.push({
      id: `p-${crypto.randomUUID().slice(0, 8)}`,
      nome,
      telefone,
      cotas_compradas: cotas,
      pago,
    });
    saveStore();
    res.status(201).json(bolao);
  });

  // Toggle participant paid or update
  app.patch('/api/boloes/:id/participantes/:pid', (req, res) => {
    const bolao = boloesList.find((b) => b.id === req.params.id);
    if (!bolao) {
      res.status(404).json({ error: 'Bolão não encontrado.' });
      return;
    }
    const p = bolao.participantes.find((item) => item.id === req.params.pid);
    if (!p) {
      res.status(404).json({ error: 'Participante não encontrado.' });
      return;
    }
    if (typeof req.body?.pago === 'boolean') p.pago = req.body.pago;
    if (req.body?.cotas_compradas) p.cotas_compradas = Math.max(1, Number(req.body.cotas_compradas));
    saveStore();
    res.json(bolao);
  });

  // Delete participant
  app.delete('/api/boloes/:id/participantes/:pid', (req, res) => {
    const bolao = boloesList.find((b) => b.id === req.params.id);
    if (!bolao) {
      res.status(404).json({ error: 'Bolão não encontrado.' });
      return;
    }
    bolao.participantes = bolao.participantes.filter((item) => item.id !== req.params.pid);
    saveStore();
    res.json(bolao);
  });

  // Add batch or single games to bolao
  app.post('/api/boloes/:id/jogos', (req, res) => {
    const bolao = boloesList.find((b) => b.id === req.params.id);
    if (!bolao) {
      res.status(404).json({ error: 'Bolão não encontrado.' });
      return;
    }
    const incoming: number[][] = Array.isArray(req.body?.jogos)
      ? req.body.jogos
      : Array.isArray(req.body?.dezenas)
      ? [req.body.dezenas]
      : [];

    if (incoming.length === 0) {
      res.status(400).json({ error: 'Informe ao menos um jogo válido.' });
      return;
    }

    let added = 0;
    for (const rawGame of incoming) {
      if (!Array.isArray(rawGame)) continue;
      const sorted = [...new Set(rawGame.map(Number).filter((n) => n >= 1 && n <= 60))].sort(
        (a, b) => a - b
      );
      if (sorted.length < 6 || sorted.length > 15) continue;
      bolao.jogos.push({
        id: `j-${crypto.randomUUID().slice(0, 8)}`,
        dezenas: sorted,
        valor_aposta: getMegaSenaBetPrice(sorted.length),
        acertos: null,
        premio_estimado: 0,
      });
      added++;
    }

    recalculateBolaoCota(bolao);
    saveStore();
    res.status(201).json({ bolao, added });
  });

  // Remove game from bolao
  app.delete('/api/boloes/:id/jogos/:jid', (req, res) => {
    const bolao = boloesList.find((b) => b.id === req.params.id);
    if (!bolao) {
      res.status(404).json({ error: 'Bolão não encontrado.' });
      return;
    }
    bolao.jogos = bolao.jogos.filter((j) => j.id !== req.params.jid);
    recalculateBolaoCota(bolao);
    saveStore();
    res.json(bolao);
  });

  // Automatic batch checker (PRD 3.4)
  app.post('/api/boloes/:id/conferir', (req, res) => {
    const bolao = boloesList.find((b) => b.id === req.params.id);
    if (!bolao) {
      res.status(404).json({ error: 'Bolão não encontrado.' });
      return;
    }

    let drawnDezenas: number[] = [];
    let concursoRef: Concurso | undefined;
    let concursoNumero = bolao.concurso_alvo;
    let dataSorteio = new Date().toISOString().slice(0, 10);

    if (req.body?.concursoNumero) {
      concursoNumero = Number(req.body.concursoNumero);
      concursoRef = concursosMap.get(concursoNumero);
      if (!concursoRef) {
        res.status(404).json({ error: `Concurso #${concursoNumero} não encontrado na base oficial.` });
        return;
      }
      drawnDezenas = concursoRef.dezenas;
      dataSorteio = concursoRef.data_sorteio;
    } else if (Array.isArray(req.body?.dezenas)) {
      drawnDezenas = [...new Set(req.body.dezenas.map(Number).filter((n: number) => n >= 1 && n <= 60))].sort(
        (a: number, b: number) => a - b
      );
      if (drawnDezenas.length !== 6) {
        res.status(400).json({ error: 'Informe exatamente 6 dezenas sorteadas distintas (01 a 60).' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Informe um número de concurso ou 6 dezenas para conferência.' });
      return;
    }

    // Use latest known rateios as fallback estimate when manually checking an unreleased contest
    const latestDraw = concursosMap.get(getMaxConcursoNumber());
    const rateioRef = concursoRef ?? {
      rateio_sena: latestDraw?.estimativa_premio || 40000000,
      rateio_quina: latestDraw?.rateio_quina || 25000,
      rateio_quadra: latestDraw?.rateio_quadra || 600,
    };

    let totalSenas = 0;
    let totalQuinas = 0;
    let totalQuadras = 0;
    let totalPremio = 0;

    for (const jogo of bolao.jogos) {
      const result = calculateTicketPrize(jogo.dezenas, drawnDezenas, rateioRef);
      jogo.acertos = result.acertos;
      jogo.premio_estimado = result.premio;
      totalSenas += result.senas;
      totalQuinas += result.quinas;
      totalQuadras += result.quadras;
      totalPremio += result.premio;
    }

    bolao.status = 'conferido';
    bolao.resultado_conferido = {
      concurso: concursoNumero,
      data_sorteio: dataSorteio,
      dezenas: drawnDezenas,
      senas: totalSenas,
      quinas: totalQuinas,
      quadras: totalQuadras,
      premio_total: Math.round(totalPremio * 100) / 100,
    };

    saveStore();
    res.json(bolao);
  });

  // --- VITE / STATIC SERVING ---
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Vitória] Servidor em execução na porta ${PORT}`);
  });
}

startServer();
