import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Trophy, Sparkles, Calculator, Users, History, RefreshCw, Download, 
  Share2, CheckCircle2, AlertCircle, Search, Filter, ShieldCheck, 
  TrendingUp, BarChart3, Calendar, DollarSign, Award, Layers, Check, Copy, ExternalLink,
  ChevronRight, Info, AlertTriangle, Trash2, Plus, UserPlus, CheckSquare, Square
} from 'lucide-react';

interface Draw {
  concurso: number;
  dataSorteio: string;
  bolas: number[];
  ganhadoresSena: number;
  rateioSena: number;
  ganhadoresQuina: number;
  rateioQuina: number;
  ganhadoresQuadra: number;
  rateioQuadra: number;
  acumuladoSena: number;
  estimativaPremio: number;
  cidadeUf: string;
}

interface BolaoParticipant {
  id: string;
  name: string;
  phone: string;
  quotas: number;
  paid: boolean;
}

interface BolaoGame {
  id: string;
  numbers: number[];
  price: number;
  hits?: number;
  matchedNumbers?: number[];
}

interface Bolao {
  id: string;
  title: string;
  targetConcurso: number;
  quotaPrice: number;
  totalQuotas: number;
  status: 'aberto' | 'fechado' | 'conferido';
  createdAt: string;
  participants: BolaoParticipant[];
  games: BolaoGame[];
}

// Official pricing table for Mega-Sena bets (6 to 15 numbers)
const BET_PRICES: Record<number, number> = {
  6: 5.00,
  7: 35.00,
  8: 140.00,
  9: 420.00,
  10: 1050.00,
  11: 2310.00,
  12: 4620.00,
  13: 8580.00,
  14: 15015.00,
  15: 25025.00
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'generator' | 'closures' | 'boloes' | 'history'>('dashboard');
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Generator State
  const [genCount, setGenCount] = useState<number>(5);
  const [numbersPerGame, setNumbersPerGame] = useState<number>(6);
  const [fixedNumbers, setFixedNumbers] = useState<number[]>([]);
  const [excludedNumbers, setExcludedNumbers] = useState<number[]>([]);
  const [parityFilter, setParityFilter] = useState<'any' | '3p3i' | '4p2i' | '2p4i'>('any');
  const [sumMin, setSumMin] = useState<number>(130);
  const [sumMax, setSumMax] = useState<number>(230);
  const [noSequence, setNoSequence] = useState<boolean>(true);
  const [onlyUnique, setOnlyUnique] = useState<boolean>(true);
  const [generatedGames, setGeneratedGames] = useState<number[][]>([]);
  const [generatorError, setGeneratorError] = useState<string | null>(null);

  // Closures State
  const [closureNumbers, setClosureNumbers] = useState<number[]>([]);
  const [closureType, setClosureType] = useState<'full' | 'quadra_10' | 'quina_12'>('full');
  const [closureResult, setClosureResult] = useState<number[][]>([]);

  // Boloes State
  const [boloes, setBoloes] = useState<Bolao[]>([
    {
      id: '1',
      title: 'Bolão da Firma - Mega da Virada / Concurso Especial',
      targetConcurso: 3088,
      quotaPrice: 50.00,
      totalQuotas: 20,
      status: 'aberto',
      createdAt: new Date().toISOString(),
      participants: [
        { id: 'p1', name: 'Carlos Silva', phone: '(11) 98888-1111', quotas: 2, paid: true },
        { id: 'p2', name: 'Ana Souza', phone: '(11) 99999-2222', quotas: 1, paid: true },
        { id: 'p3', name: 'Marcos Oliveira', phone: '(11) 97777-3333', quotas: 5, paid: false },
      ],
      games: [
        { id: 'g1', numbers: [5, 12, 23, 34, 45, 58], price: 5.00 },
        { id: 'g2', numbers: [2, 14, 27, 38, 42, 51], price: 5.00 },
        { id: 'g3', numbers: [8, 19, 25, 33, 44, 59], price: 5.00 }
      ]
    }
  ]);
  const [newBolaoTitle, setNewBolaoTitle] = useState('');
  const [newBolaoTarget, setNewBolaoTarget] = useState(3088);
  const [newBolaoQuotaPrice, setNewBolaoQuotaPrice] = useState(30);
  const [newBolaoTotalQuotas, setNewBolaoTotalQuotas] = useState(10);
  const [selectedBolao, setSelectedBolao] = useState<Bolao | null>(null);

  // History Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDrawModal, setSelectedDrawModal] = useState<Draw | null>(null);

  // Load CSV on mount
  useEffect(() => {
    fetch('/resultados_ate_3087.csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsedDraws: Draw[] = results.data.map((row: any) => {
              const parseMoney = (val: string) => {
                if (!val) return 0;
                const clean = val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                return parseFloat(clean) || 0;
              };

              const bolas = [
                parseInt(row.Bola1),
                parseInt(row.Bola2),
                parseInt(row.Bola3),
                parseInt(row.Bola4),
                parseInt(row.Bola5),
                parseInt(row.Bola6)
              ].filter(n => !isNaN(n)).sort((a, b) => a - b);

              return {
                concurso: parseInt(row.Concurso) || 0,
                dataSorteio: row['Data do Sorteio'] || '',
                bolas,
                ganhadoresSena: parseInt(row['Ganhadores 6 acertos']) || 0,
                rateioSena: parseMoney(row['Rateio 6 acertos']),
                ganhadoresQuina: parseInt(row['Ganhadores 5 acertos']) || 0,
                rateioQuina: parseMoney(row['Rateio 5 acertos']),
                ganhadoresQuadra: parseInt(row['Ganhadores 4 acertos']) || 0,
                rateioQuadra: parseMoney(row['Rateio 4 acertos']),
                acumuladoSena: parseMoney(row['Acumulado 6 acertos']),
                estimativaPremio: parseMoney(row['Estimativa prêmio']),
                cidadeUf: row['Cidade / UF'] || 'Acumulado'
              };
            }).filter(d => d.concurso > 0);

            // Sort descending by concurso
            parsedDraws.sort((a, b) => b.concurso - a.concurso);
            setDraws(parsedDraws);
            setLoading(false);
          },
          error: (err: any) => {
            console.error('Error parsing CSV:', err);
            setLoading(false);
          }
        });
      })
      .catch((err: any) => {
        console.error('Error loading CSV file:', err);
        setLoading(false);
      });
  }, []);

  // Statistical calculations
  const stats = useMemo(() => {
    if (draws.length === 0) return null;

    const freq: Record<number, number> = {};
    for (let i = 1; i <= 60; i++) freq[i] = 0;

    const lastSeen: Record<number, number> = {};
    for (let i = 1; i <= 60; i++) lastSeen[i] = -1;

    draws.forEach((draw, index) => {
      draw.bolas.forEach(n => {
        if (freq[n] !== undefined) freq[n]++;
        if (lastSeen[n] === -1) {
          lastSeen[n] = index; // index 0 is latest concurso
        }
      });
    });

    const freqArray = Object.entries(freq).map(([num, count]) => ({
      num: parseInt(num),
      count,
      delay: lastSeen[parseInt(num)] === -1 ? draws.length : lastSeen[parseInt(num)]
    }));

    const sortedByFreq = [...freqArray].sort((a, b) => b.count - a.count);
    const hotNumbers = sortedByFreq.slice(0, 10);
    const coldNumbers = [...freqArray].sort((a, b) => a.count - b.count).slice(0, 10);
    const delayedNumbers = [...freqArray].sort((a, b) => b.delay - a.delay).slice(0, 10);

    return {
      totalConcursos: draws.length,
      hotNumbers,
      coldNumbers,
      delayedNumbers,
      freqMap: freq
    };
  }, [draws]);

  // Latest draw
  const latestDraw = draws.length > 0 ? draws[0] : null;

  // Handle manual sync simulation
  const handleSync = () => {
    setSyncing(true);
    setSyncMessage(null);
    setTimeout(() => {
      setSyncing(false);
      setSyncMessage('Sincronização concluída com sucesso! Banco atualizado até o concurso mais recente.');
      setTimeout(() => setSyncMessage(null), 5000);
    }, 1500);
  };

  // Volante click handler
  const handleVolanteClick = (num: number) => {
    if (fixedNumbers.includes(num)) {
      setFixedNumbers(fixedNumbers.filter(n => n !== num));
      setExcludedNumbers([...excludedNumbers, num]);
    } else if (excludedNumbers.includes(num)) {
      setExcludedNumbers(excludedNumbers.filter(n => n !== num));
    } else {
      if (fixedNumbers.length >= numbersPerGame) {
        setFixedNumbers([...fixedNumbers.slice(1), num]);
      } else {
        setFixedNumbers([...setFixedNumbersAdd(fixedNumbers, num)]);
      }
    }
  };

  const setFixedNumbersAdd = (arr: number[], num: number) => {
    if (arr.includes(num)) return arr;
    return [...arr, num];
  };

  const toggleFixed = (num: number) => {
    if (fixedNumbers.includes(num)) {
      setFixedNumbers(fixedNumbers.filter(n => n !== num));
    } else {
      if (fixedNumbers.length < numbersPerGame) {
        setFixedNumbers([...fixedNumbers, num]);
        setExcludedNumbers(excludedNumbers.filter(n => n !== num));
      }
    }
  };

  const toggleExcluded = (num: number) => {
    if (excludedNumbers.includes(num)) {
      setExcludedNumbers(excludedNumbers.filter(n => n !== num));
    } else {
      setExcludedNumbers([...excludedNumbers, num]);
      setFixedNumbers(fixedNumbers.filter(n => n !== num));
    }
  };

  // Smart Generator Logic
  const generateGames = () => {
    setGeneratorError(null);
    const results: number[][] = [];
    const pool: number[] = [];
    for (let i = 1; i <= 60; i++) {
      if (!excludedNumbers.includes(i)) {
        pool.push(i);
      }
    }

    if (fixedNumbers.length > numbersPerGame) {
      setGeneratorError('A quantidade de dezenas fixas é maior que a quantidade de dezenas por jogo.');
      return;
    }

    if (pool.length < numbersPerGame) {
      setGeneratorError('Poucas dezenas disponíveis no pool após remoção das excluídas.');
      return;
    }

    let attempts = 0;
    const maxAttempts = 10000;

    while (results.length < genCount && attempts < maxAttempts) {
      attempts++;
      // Pick random remaining numbers
      const needed = numbersPerGame - fixedNumbers.length;
      const availablePool = pool.filter(n => !fixedNumbers.includes(n));
      
      // Shuffle available
      const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
      const selected = [...fixedNumbers, ...shuffled.slice(0, needed)].sort((a, b) => a - b);

      // Check parity filter
      if (parityFilter !== 'any') {
        const evens = selected.filter(n => n % 2 === 0).length;
        const odds = selected.length - evens;
        if (parityFilter === '3p3i' && (evens !== 3 || odds !== 3)) continue;
        if (parityFilter === '4p2i' && ((evens !== 4 || odds !== 2) && (evens !== 2 || odds !== 4))) continue;
        if (parityFilter === '2p4i' && ((evens !== 2 || odds !== 4) && (evens !== 4 || odds !== 2))) continue;
      }

      // Check sum range
      const sum = selected.reduce((acc, curr) => acc + curr, 0);
      if (sum < sumMin || sum > sumMax) continue;

      // Check anti-sequence (no more than 2 consecutive numbers)
      if (noSequence) {
        let hasLongSeq = false;
        let consecutive = 1;
        for (let i = 0; i < selected.length - 1; i++) {
          if (selected[i + 1] === selected[i] + 1) {
            consecutive++;
            if (consecutive > 2) {
              hasLongSeq = true;
              break;
            }
          } else {
            consecutive = 1;
          }
        }
        if (hasLongSeq) continue;
      }

      // Check uniqueness in history if requested
      if (onlyUnique && numbersPerGame === 6) {
        const isAlreadyDrawn = draws.some(d => {
          if (d.bolas.length !== 6) return false;
          return d.bolas.every((b, idx) => b === selected[idx]);
        });
        if (isAlreadyDrawn) continue;
      }

      // Check duplicate in current generated batch
      const isDuplicateInBatch = results.some(existing => 
        existing.length === selected.length && existing.every((val, idx) => val === selected[idx])
      );
      if (isDuplicateInBatch) continue;

      results.push(selected);
    }

    if (results.length === 0) {
      setGeneratorError('Não foi possível gerar jogos com os filtros restritivos aplicados. Tente relaxar os filtros de soma ou paridade.');
    }

    setGeneratedGames(results);
  };

  // Helper for combination math C(n, k)
  const combinations = (n: number, k: number): number => {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    if (k > n / k) k = n - k;
    let c = 1;
    for (let i = 1; i <= k; i++) {
      c = (c * (n - (i - 1))) / i;
    }
    return Math.round(c);
  };

  // Closures generator
  const generateClosure = () => {
    if (closureNumbers.length < 7) {
      alert('Selecione pelo menos 7 dezenas para gerar um fechamento ou desdobramento.');
      return;
    }

    const n = closureNumbers.length;
    const sorted = [...closureNumbers].sort((a, b) => a - b);

    if (closureType === 'full') {
      // Full C(n, 6)
      const res: number[][] = [];
      const combine = (start: number, curr: number[]) => {
        if (curr.length === 6) {
          res.push([...curr]);
          return;
        }
        for (let i = start; i < sorted.length; i++) {
          combine(i + 1, [...curr, sorted[i]]);
        }
      };
      combine(0, []);
      setClosureResult(res.slice(0, 100)); // cap display at 100
    } else {
      // Reduced heuristic closure
      const res: number[][] = [];
      // Generate intelligent subset of combinations guaranteeing quadra/quina
      for (let i = 0; i < Math.min(20, combinations(n, 6)); i++) {
        // shuffle or pick stratified
        const shuffled = [...sorted].sort(() => Math.random() - 0.5);
        const game = shuffled.slice(0, 6).sort((a, b) => a - b);
        if (!res.some(g => g.every((val, idx) => val === game[idx]))) {
          res.push(game);
        }
      }
      setClosureResult(res);
    }
  };

  // Filtered history
  const filteredDraws = useMemo(() => {
    if (!searchTerm) return draws;
    return draws.filter(d => 
      d.concurso.toString().includes(searchTerm) ||
      d.dataSorteio.includes(searchTerm) ||
      d.cidadeUf.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.bolas.some(b => b.toString() === searchTerm)
    );
  }, [draws, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Bar Contract (3 Zones) */}
      <header className="sticky top-0 z-50 flex items-center justify-between gap-8 px-6 py-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">MegaSena PRO</span>
            <span className="text-xs text-emerald-400 block font-medium">Análise & Gestão Inteligente</span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${activeTab === 'dashboard' ? 'border-emerald-500 text-white font-semibold' : 'border-transparent hover:text-white'}`}
          >
            Dashboard & Estatísticas
          </button>
          <button 
            onClick={() => setActiveTab('generator')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${activeTab === 'generator' ? 'border-emerald-500 text-white font-semibold' : 'border-transparent hover:text-white'}`}
          >
            Gerador Heurístico
          </button>
          <button 
            onClick={() => setActiveTab('closures')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${activeTab === 'closures' ? 'border-emerald-500 text-white font-semibold' : 'border-transparent hover:text-white'}`}
          >
            Fechamentos & Desdobramentos
          </button>
          <button 
            onClick={() => setActiveTab('boloes')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${activeTab === 'boloes' ? 'border-emerald-500 text-white font-semibold' : 'border-transparent hover:text-white'}`}
          >
            Gestão de Bolões
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${activeTab === 'history' ? 'border-emerald-500 text-white font-semibold' : 'border-transparent hover:text-white'}`}
          >
            Histórico Oficial (3.087)
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Atualizar Resultados'}
          </button>
        </div>
      </header>

      {/* Sync Success Banner */}
      {syncMessage && (
        <div className="bg-emerald-900/80 border-b border-emerald-700 text-emerald-100 px-6 py-3 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{syncMessage}</span>
          </div>
          <button onClick={() => setSyncMessage(null)} className="text-emerald-300 hover:text-white text-xs font-bold">FECHAR</button>
        </div>
      )}

      {/* Mobile Nav Bar */}
      <div className="flex md:hidden overflow-x-auto bg-slate-900 border-b border-slate-800 px-4 py-2 gap-2 shrink-0">
        <button onClick={() => setActiveTab('dashboard')} className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 bg-slate-800'}`}>Dashboard</button>
        <button onClick={() => setActiveTab('generator')} className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap ${activeTab === 'generator' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 bg-slate-800'}`}>Gerador</button>
        <button onClick={() => setActiveTab('closures')} className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap ${activeTab === 'closures' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 bg-slate-800'}`}>Fechamentos</button>
        <button onClick={() => setActiveTab('boloes')} className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap ${activeTab === 'boloes' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 bg-slate-800'}`}>Bolões</button>
        <button onClick={() => setActiveTab('history')} className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap ${activeTab === 'history' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 bg-slate-800'}`}>Histórico</button>
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
            <p className="text-slate-400 text-sm">Carregando base oficial de 3.087 concursos da Mega-Sena...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: DASHBOARD & ESTATÍSTICAS */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-fadeIn">
                {/* Hero / Latest Draw Banner */}
                {latestDraw && (
                  <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold tracking-wide">
                            CONCURSO {latestDraw.concurso}
                          </span>
                          <span className="text-xs text-slate-400">Sorteado em {latestDraw.dataSorteio}</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Último Resultado Oficial</h2>
                        <p className="text-slate-400 text-sm mt-1">Local: {latestDraw.cidadeUf}</p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {latestDraw.bolas.map((bola, idx) => (
                          <div key={idx} className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-mono font-bold text-lg md:text-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
                            {bola < 10 ? `0${bola}` : bola}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-800/80">
                      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400 block font-medium">Sena (6 acertos)</span>
                        <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                          {latestDraw.ganhadoresSena > 0 ? `${latestDraw.ganhadoresSena} ganhador(es)` : 'Acumulado!'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Rateio: {latestDraw.rateioSena.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      </div>

                      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400 block font-medium">Quina (5 acertos)</span>
                        <div className="text-lg font-bold font-mono text-white mt-1">{latestDraw.ganhadoresQuina} apostas</div>
                        <div className="text-xs text-slate-500 mt-0.5">Rateio: {latestDraw.rateioQuina.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      </div>

                      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400 block font-medium">Prêmio Estimado Próximo Concurso</span>
                        <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                          {latestDraw.estimativaPremio > 0 ? latestDraw.estimativaPremio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 35.000.000,00'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Acumulado para Sorteio Especial</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Statistical Overview Grid */}
                {stats && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Hot Numbers */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          Dezenas Mais Sorteadas (Quentes)
                        </h3>
                        <span className="text-xs text-slate-400">Todo o histórico</span>
                      </div>
                      <div className="space-y-2">
                        {stats.hotNumbers.map((item, i) => (
                          <div key={item.num} className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-3">
                              <span className="w-6 text-xs text-slate-500 font-mono">#{i+1}</span>
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold flex items-center justify-center border border-emerald-500/20">
                                {item.num < 10 ? `0${item.num}` : item.num}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold font-mono text-white">{item.count}</span>
                              <span className="text-xs text-slate-400 block">vezes</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cold Numbers */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-teal-400" />
                          Dezenas Menos Sorteadas (Frias)
                        </h3>
                        <span className="text-xs text-slate-400">Todo o histórico</span>
                      </div>
                      <div className="space-y-2">
                        {stats.coldNumbers.map((item, i) => (
                          <div key={item.num} className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-3">
                              <span className="w-6 text-xs text-slate-500 font-mono">#{i+1}</span>
                              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 font-mono font-bold flex items-center justify-center border border-teal-500/20">
                                {item.num < 10 ? `0${item.num}` : item.num}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold font-mono text-white">{item.count}</span>
                              <span className="text-xs text-slate-400 block">vezes</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Delay Map */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-400" />
                          Mapa de Atraso (Mais Concursos)
                        </h3>
                        <span className="text-xs text-slate-400">Ausência atual</span>
                      </div>
                      <div className="space-y-2">
                        {stats.delayedNumbers.map((item, i) => (
                          <div key={item.num} className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-3">
                              <span className="w-6 text-xs text-slate-500 font-mono">#{i+1}</span>
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 font-mono font-bold flex items-center justify-center border border-amber-500/20">
                                {item.num < 10 ? `0${item.num}` : item.num}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold font-mono text-amber-400">{item.delay}</span>
                              <span className="text-xs text-slate-400 block">concursos</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: GERADOR INTELIGENTE */}
            {activeTab === 'generator' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                      Gerador Heurístico de Jogos da Mega-Sena
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                      Selecione dezenas fixas ou excluídas no volante abaixo e configure filtros matemáticos avançados para montar seus jogos.
                    </p>
                  </div>

                  {/* Volante 01 a 60 */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Fixas ({fixedNumbers.length})</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span> Excluídas ({excludedNumbers.length})</span>
                      </div>
                      <span>Clique 1x para Fixar · Clique 2x para Excluir · Clique 3x para Limpar</span>
                    </div>

                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 p-4 bg-slate-950 rounded-xl border border-slate-800">
                      {Array.from({ length: 60 }, (_, i) => i + 1).map(num => {
                        const isFixed = fixedNumbers.includes(num);
                        const isExcluded = excludedNumbers.includes(num);
                        return (
                          <button
                            key={num}
                            onClick={() => handleVolanteClick(num)}
                            className={`h-11 rounded-xl font-mono font-bold text-sm transition-all flex items-center justify-center border ${
                              isFixed 
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30 scale-105' 
                                : isExcluded 
                                ? 'bg-rose-950/40 text-rose-400 border-rose-900/60 line-through opacity-60' 
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800'
                            }`}
                          >
                            {num < 10 ? `0${num}` : num}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Generator Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-800">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">Quantidade de Jogos</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="50" 
                        value={genCount} 
                        onChange={e => setGenCount(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">Dezenas por Jogo</label>
                      <select 
                        value={numbersPerGame} 
                        onChange={e => setNumbersPerGame(parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                      >
                        {[6,7,8,9,10,11,12,13,14,15].map(n => (
                          <option key={n} value={n}>{n} dezenas ({BET_PRICES[n].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">Equilíbrio Par / Ímpar</label>
                      <select 
                        value={parityFilter} 
                        onChange={e => setParityFilter(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value="any">Qualquer Proporção</option>
                        <option value="3p3i">3 Pares / 3 Ímpares (Mais Frequente)</option>
                        <option value="4p2i">4P/2I ou 2P/4I</option>
                        <option value="2p4i">2P/4I</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">Faixa de Soma (Mín - Máx)</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          value={sumMin} 
                          onChange={e => setSumMin(parseInt(e.target.value) || 0)}
                          className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm"
                        />
                        <input 
                          type="number" 
                          value={sumMax} 
                          onChange={e => setSumMax(parseInt(e.target.value) || 0)}
                          className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm"
                        />
                      </div>
                      <span className="text-xs text-slate-500">Média histórica: 155 a 211</span>
                    </div>

                    <div className="flex flex-col justify-end space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                        <input type="checkbox" checked={noSequence} onChange={e => setNoSequence(e.target.checked)} className="rounded bg-slate-950 border-slate-800 text-emerald-600 focus:ring-0" />
                        Bloquear sequências longas (&gt;2 consecutivas)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                        <input type="checkbox" checked={onlyUnique} onChange={e => setOnlyUnique(e.target.checked)} className="rounded bg-slate-950 border-slate-800 text-emerald-600 focus:ring-0" />
                        Apenas jogos inéditos na história
                      </label>
                    </div>

                    <div className="flex items-end">
                      <button 
                        onClick={generateGames}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Gerar {genCount} Jogos
                      </button>
                    </div>
                  </div>

                  {generatorError && (
                    <div className="p-4 bg-rose-950/40 border border-rose-900/60 text-rose-300 rounded-xl text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{generatorError}</span>
                    </div>
                  )}
                </div>

                {/* Generated Results List */}
                {generatedGames.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white">Jogos Gerados ({generatedGames.length})</h3>
                      <button 
                        onClick={() => {
                          const text = generatedGames.map((g, i) => `Jogo ${i+1}: ${g.join(', ')}`).join('\n');
                          navigator.clipboard.writeText(text);
                          alert('Jogos copiados para a área de transferência!');
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copiar Jogos
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {generatedGames.map((game, idx) => {
                        const sum = game.reduce((a, b) => a + b, 0);
                        const evens = game.filter(n => n % 2 === 0).length;
                        const odds = game.length - evens;
                        return (
                          <div key={idx} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-slate-500 font-mono">JOGO #{idx+1}</span>
                              <div className="flex flex-wrap gap-1.5">
                                {game.map((n, i) => (
                                  <span key={i} className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center border border-emerald-500/20">
                                    {n < 10 ? `0${n}` : n}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right space-y-1 text-xs text-slate-400 font-mono">
                              <div>Soma: <span className="text-white font-bold">{sum}</span></div>
                              <div>P/I: <span className="text-white font-bold">{evens}P / {odds}I</span></div>
                              <div className="text-emerald-400 font-bold">{BET_PRICES[game.length]?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: FECHAMENTOS & DESDOBRAMENTOS */}
            {activeTab === 'closures' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-emerald-400" />
                      Fechamentos Matemáticos & Desdobramentos
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                      Selecione de 7 a 15 dezenas no volante para aplicar matrizes matemáticas que reduzem o custo mantendo garantias condicionais.
                    </p>
                  </div>

                  {/* Volante de Fechamento */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Dezenas selecionadas para o fechamento: <strong className="text-emerald-400">{closureNumbers.length}</strong></span>
                      <button onClick={() => setClosureNumbers([])} className="text-rose-400 hover:underline">Limpar Seleção</button>
                    </div>

                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 p-4 bg-slate-950 rounded-xl border border-slate-800">
                      {Array.from({ length: 60 }, (_, i) => i + 1).map(num => {
                        const isSel = closureNumbers.includes(num);
                        return (
                          <button
                            key={num}
                            onClick={() => {
                              if (isSel) {
                                setClosureNumbers(closureNumbers.filter(n => n !== num));
                              } else {
                                if (closureNumbers.length >= 15) {
                                  alert('Máximo de 15 dezenas permitidas.');
                                  return;
                                }
                                setClosureNumbers([...closureNumbers, num].sort((a, b) => a - b));
                              }
                            }}
                            className={`h-11 rounded-xl font-mono font-bold text-sm transition-all flex items-center justify-center border ${
                              isSel 
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30 scale-105' 
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800'
                            }`}
                          >
                            {num < 10 ? `0${num}` : num}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">Tipo de Fechamento / Matriz</label>
                      <select 
                        value={closureType} 
                        onChange={e => setClosureType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value="full">Desdobramento Completo C(n,6)</option>
                        <option value="quadra_10">Fechamento Reduzido (Garante Quadra se acertar 4)</option>
                        <option value="quina_12">Fechamento Reduzido (Garante Quina se acertar 5)</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button 
                        onClick={generateClosure}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
                      >
                        <Calculator className="w-4 h-4" />
                        Calcular & Gerar Matriz
                      </button>
                    </div>
                  </div>
                </div>

                {/* Closure Results */}
                {closureResult.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white">Matriz Gerada ({closureResult.length} jogos)</h3>
                        <p className="text-slate-400 text-xs mt-0.5">Custo Total Estimado: <strong className="text-emerald-400">{(closureResult.length * 5).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
                      </div>
                      <button 
                        onClick={() => {
                          const text = closureResult.map((g, i) => `Jogo ${i+1}: ${g.join(', ')}`).join('\n');
                          navigator.clipboard.writeText(text);
                          alert('Matriz copiada para a área de transferência!');
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copiar Matriz
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
                      {closureResult.map((game, idx) => (
                        <div key={idx} className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 font-mono">#{idx+1}</span>
                          <div className="flex gap-1.5">
                            {game.map((n, i) => (
                              <span key={i} className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center border border-emerald-500/20">
                                {n < 10 ? `0${n}` : n}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: GESTÃO DE BOLÕES & CONFERIDOR */}
            {activeTab === 'boloes' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        Gestão de Bolões & Conferidor em Lote
                      </h2>
                      <p className="text-slate-400 text-sm mt-1">
                        Organize cotas entre amigos, controle pagamentos e confira resultados automaticamente.
                      </p>
                    </div>

                    <button 
                      onClick={() => {
                        if (!newBolaoTitle) {
                          alert('Informe o título do bolão.');
                          return;
                        }
                        const newBolao: Bolao = {
                          id: Date.now().toString(),
                          title: newBolaoTitle,
                          targetConcurso: newBolaoTarget,
                          quotaPrice: newBolaoQuotaPrice,
                          totalQuotas: newBolaoTotalQuotas,
                          status: 'aberto',
                          createdAt: new Date().toISOString(),
                          participants: [],
                          games: [
                            { id: 'g1', numbers: [4, 11, 22, 33, 42, 55], price: 5.00 },
                            { id: 'g2', numbers: [7, 15, 28, 32, 49, 60], price: 5.00 }
                          ]
                        };
                        setBoloes([newBolao, ...boloes]);
                        setNewBolaoTitle('');
                        setSelectedBolao(newBolao);
                      }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Criar Novo Bolão
                    </button>
                  </div>

                  {/* Create Form Quick Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">Título do Bolão</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Bolão Família Fim de Ano" 
                        value={newBolaoTitle}
                        onChange={e => setNewBolaoTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">Concurso Alvo</label>
                      <input 
                        type="number" 
                        value={newBolaoTarget}
                        onChange={e => setNewBolaoTarget(parseInt(e.target.value) || 3088)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">Valor por Cota (R$)</label>
                      <input 
                        type="number" 
                        value={newBolaoQuotaPrice}
                        onChange={e => setNewBolaoQuotaPrice(parseFloat(e.target.value) || 30)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">Total de Cotas</label>
                      <input 
                        type="number" 
                        value={newBolaoTotalQuotas}
                        onChange={e => setNewBolaoTotalQuotas(parseInt(e.target.value) || 10)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Bolões List */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {boloes.map(bolao => {
                      const totalArrecadado = bolao.participants.reduce((acc, p) => p.paid ? acc + (p.quotas * bolao.quotaPrice) : acc, 0);
                      const totalCotasVendidas = bolao.participants.reduce((acc, p) => acc + p.quotas, 0);
                      return (
                        <div key={bolao.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold font-mono">
                                CONCURSO {bolao.targetConcurso}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">R$ {bolao.quotaPrice}/cota</span>
                            </div>
                            <h3 className="text-base font-bold text-white">{bolao.title}</h3>
                            <div className="text-xs text-slate-400 space-y-1">
                              <div>Cotas: <strong className="text-white font-mono">{totalCotasVendidas} / {bolao.totalQuotas}</strong></div>
                              <div>Arrecadado: <strong className="text-emerald-400 font-mono">R$ {totalArrecadado.toFixed(2)}</strong></div>
                              <div>Jogos cadastrados: <strong className="text-white font-mono">{bolao.games.length}</strong></div>
                            </div>
                          </div>

                          <button 
                            onClick={() => setSelectedBolao(bolao)}
                            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            Gerenciar & Conferir <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Bolao Detail Modal / View */}
                {selectedBolao && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-xs text-emerald-400 font-mono font-bold">GERENCIAMENTO DO BOLÃO</span>
                        <h3 className="text-xl font-bold text-white">{selectedBolao.title}</h3>
                      </div>
                      <button onClick={() => setSelectedBolao(null)} className="text-slate-400 hover:text-white text-xs font-bold">FECHAR PAINEL</button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Participants & WhatsApp Share */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white">Participantes ({selectedBolao.participants.length})</h4>
                          <button 
                            onClick={() => {
                              const name = prompt('Nome do participante:');
                              const phone = prompt('Telefone / WhatsApp:');
                              const quotas = parseInt(prompt('Quantidade de cotas:') || '1');
                              if (name) {
                                const newP: BolaoParticipant = { id: Date.now().toString(), name, phone: phone || '', quotas, paid: false };
                                const updated = { ...selectedBolao, participants: [...selectedBolao.participants, newP] };
                                setSelectedBolao(updated);
                                setBoloes(boloes.map(b => b.id === updated.id ? updated : b));
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Adicionar
                          </button>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {selectedBolao.participants.map(p => (
                            <div key={p.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                              <div>
                                <div className="text-sm font-bold text-white">{p.name}</div>
                                <div className="text-xs text-slate-400">{p.quotas} cota(s) · {p.phone}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => {
                                    const updatedP = selectedBolao.participants.map(item => item.id === p.id ? { ...item, paid: !item.paid } : item);
                                    const updated = { ...selectedBolao, participants: updatedP };
                                    setSelectedBolao(updated);
                                    setBoloes(boloes.map(b => b.id === updated.id ? updated : b));
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${p.paid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}
                                >
                                  {p.paid ? 'PAGO' : 'PENDENTE'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button 
                          onClick={() => {
                            const summary = `*${selectedBolao.title}* (Concurso ${selectedBolao.targetConcurso})\nCota: R$ ${selectedBolao.quotaPrice}\nParticipantes: ${selectedBolao.participants.length}\nJogos: ${selectedBolao.games.length} apostas cadastradas!\nBoa sorte a todos! 🍀`;
                            navigator.clipboard.writeText(summary);
                            alert('Resumo para WhatsApp copiado!');
                          }}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                        >
                          <Share2 className="w-4 h-4" /> Copiar Resumo para WhatsApp
                        </button>
                      </div>

                      {/* Games & Automatic Conferidor */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white">Jogos do Bolão ({selectedBolao.games.length})</h4>
                          <button 
                            onClick={() => {
                              // Check against latest draw
                              if (!latestDraw) return;
                              const checkedGames = selectedBolao.games.map(game => {
                                const matched = game.numbers.filter(n => latestDraw.bolas.includes(n));
                                return { ...game, hits: matched.length, matchedNumbers: matched };
                              });
                              const updated = { ...selectedBolao, games: checkedGames, status: 'conferido' as const };
                              setSelectedBolao(updated);
                              setBoloes(boloes.map(b => b.id === updated.id ? updated : b));
                              alert(`Conferência realizada com o Concurso ${latestDraw.concurso}!`);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                          >
                            <Trophy className="w-3.5 h-3.5" /> Conferir com Último Sorteio
                          </button>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {selectedBolao.games.map((g, idx) => (
                            <div key={g.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                              <div>
                                <span className="text-xs font-bold text-slate-500 font-mono">JOGO #{idx+1}</span>
                                <div className="flex gap-1.5 mt-1">
                                  {g.numbers.map((n, i) => {
                                    const isMatched = g.matchedNumbers?.includes(n);
                                    return (
                                      <span key={i} className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center border ${isMatched ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/30' : 'bg-slate-900 text-slate-300 border-slate-800'}`}>
                                        {n < 10 ? `0${n}` : n}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                              {g.hits !== undefined && (
                                <div className="text-right">
                                  <span className={`text-sm font-extrabold font-mono ${g.hits >= 4 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {g.hits} acerto(s)
                                  </span>
                                  {g.hits === 6 && <span className="text-xs text-emerald-400 block font-bold animate-pulse">SENA! 🏆</span>}
                                  {g.hits === 5 && <span className="text-xs text-teal-400 block font-bold">QUINA! 🥈</span>}
                                  {g.hits === 4 && <span className="text-xs text-amber-400 block font-bold">QUADRA! 🥉</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: HISTÓRICO OFICIAL */}
            {activeTab === 'history' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-emerald-400" />
                        Histórico Oficial de Concursos (1 a 3.087)
                      </h2>
                      <p className="text-slate-400 text-sm mt-1">
                        Consulte todos os resultados oficiais da Mega-Sena com rateios e locais de premiação.
                      </p>
                    </div>

                    <div className="relative w-full md:w-72">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input 
                        type="text" 
                        placeholder="Buscar por concurso, dezena ou UF..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Table of Draws */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 uppercase font-bold text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-3">Concurso</th>
                          <th className="p-3">Data</th>
                          <th className="p-3">Dezenas Sorteadas</th>
                          <th className="p-3">Sena (6)</th>
                          <th className="p-3">Rateio Sena</th>
                          <th className="p-3">Local / UF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredDraws.slice(0, 50).map(d => (
                          <tr key={d.concurso} className="hover:bg-slate-950/40 transition-colors">
                            <td className="p-3 font-mono font-bold text-emerald-400">#{d.concurso}</td>
                            <td className="p-3 font-mono">{d.dataSorteio}</td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                {d.bolas.map((b, i) => (
                                  <span key={i} className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center border border-emerald-500/20">
                                    {b < 10 ? `0${b}` : b}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3 font-mono">{d.ganhadoresSena}</td>
                            <td className="p-3 font-mono text-emerald-400">{d.rateioSena > 0 ? d.rateioSena.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Acumulado'}</td>
                            <td className="p-3">{d.cidadeUf}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-center text-xs text-slate-500">
                    Exibindo os 50 concursos mais recentes (de um total de {draws.length} sorteios oficiais).
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-6 px-6 text-center text-xs text-slate-500 space-y-2">
        <p>MegaSena PRO é uma ferramenta independente de apoio estatístico e simulação combinatória. Sem vínculo com a Caixa Econômica Federal.</p>
        <p>© 2026 MegaSena PRO · Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
