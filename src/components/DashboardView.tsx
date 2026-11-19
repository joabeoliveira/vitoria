import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Concurso, StatsPeriod, StatsResponse } from '../types/lottery';
import { formatBrl, formatDezena, formatIsoDateBr } from '../lib/megasena';
import { BallBadge } from './BallBadge';

interface DashboardViewProps {
  stats: StatsResponse | null;
  loading: boolean;
  periodo: StatsPeriod;
  onChangePeriodo: (p: StatsPeriod) => void;
  onQuickGenerateWithNumbers: (fixas: number[]) => void;
  isDark: boolean;
}

const PERIOD_OPTIONS: Array<{ value: StatsPeriod; label: string }> = [
  { value: '10', label: 'Últimos 10' },
  { value: '50', label: 'Últimos 50' },
  { value: '100', label: 'Últimos 100' },
  { value: 'all', label: 'Todo histórico' },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  loading,
  periodo,
  onChangePeriodo,
  onQuickGenerateWithNumbers,
  isDark,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [historyRows, setHistoryRows] = useState<Concurso[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  const pageSize = 10;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({
          search: searchTerm.trim(),
          limit: String(pageSize),
          offset: String(page * pageSize),
        });
        const res = await fetch(`/api/concursos?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setHistoryRows(data.items || []);
          setHistoryTotal(data.total || 0);
        }
      } catch {
        // aborted
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    const timer = setTimeout(loadHistory, 180);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, page, stats?.totalConcursosBanco]);

  if (loading && !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 rounded-xl bg-slate-200 dark:bg-[#131C24]" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 rounded-xl bg-slate-200 dark:bg-[#131C24]" />
          <div className="h-80 rounded-xl bg-slate-200 dark:bg-[#131C24]" />
        </div>
      </div>
    );
  }

  if (!stats || !stats.ultimoConcurso) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Nenhum concurso importado
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Importe o arquivo CSV histórico ou sincronize os resultados oficiais para visualizar as análises.
        </p>
      </div>
    );
  }

  const ultimo = stats.ultimoConcurso;
  const isAcumulado = ultimo.ganhadores_sena === 0;
  const maxHotFreq = stats.quentes[0]?.frequencia || 1;
  const maxDelay = stats.maisAtrasadas[0]?.atraso || 1;
  const totalPages = Math.max(1, Math.ceil(historyTotal / pageSize));

  const gridColor = isDark ? '#1F2C38' : '#E2E8F0';
  const tickColor = isDark ? '#94A3B8' : '#475569';
  const tooltipBg = isDark ? '#111921' : '#FFFFFF';
  const tooltipBorder = isDark ? '#283847' : '#CBD5E1';

  return (
    <div className="space-y-8">
      {/* Section 1: Latest Contest Hero Banner + Period Filter */}
      <section className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-[#208494] dark:text-[#4BB8C9]">
                Mega-Sena
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Concurso #{ultimo.concurso}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatIsoDateBr(ultimo.data_sorteio)}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  isAcumulado
                    ? 'font-semibold text-amber-600 dark:text-amber-400'
                    : 'font-semibold text-emerald-600 dark:text-emerald-400'
                }
              >
                {isAcumulado
                  ? 'Acumulado'
                  : `${ultimo.ganhadores_sena} ganhador(es) na Sena`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {ultimo.dezenas.map((n) => (
                <BallBadge key={n} number={n} variant="teal" size="lg" />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span>
                Soma:{' '}
                <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {ultimo.soma_dezenas}
                </strong>
              </span>
              <span>
                Paridade:{' '}
                <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {ultimo.qtd_pares}P / {6 - ultimo.qtd_pares}I
                </strong>
              </span>
              <span>
                Quina ({ultimo.ganhadores_quina}):{' '}
                <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatBrl(ultimo.rateio_quina)}
                </strong>
              </span>
              <span>
                Quadra ({ultimo.ganhadores_quadra}):{' '}
                <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatBrl(ultimo.rateio_quadra)}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-end lg:items-end justify-between gap-4 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-[#22303D] pt-4 lg:pt-0 lg:pl-6 min-w-[240px]">
            <div className="lg:text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estimativa do próximo prêmio
              </p>
              <p className="mt-1 text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white">
                {formatBrl(ultimo.estimativa_premio || ultimo.acumulado_sena)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Mega da Virada: {formatBrl(ultimo.acumulado_virada)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Historical Metrics + Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Análise Estatística do Histórico
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            Base oficial com {stats.totalConcursosBanco.toLocaleString('pt-BR')} concursos · Exibindo{' '}
            {stats.totalAnalisado.toLocaleString('pt-BR')} concursos no recorte selecionado
          </p>
        </div>

        <div
          role="group"
          aria-label="Filtro de período histórico"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#16212B] border border-slate-200 dark:border-[#22303D] self-start"
        >
          {PERIOD_OPTIONS.map((opt) => {
            const active = periodo === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangePeriodo(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#208494] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4-column KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Dezena mais sorteada</p>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-center gap-2.5">
              <BallBadge number={stats.quentes[0]?.dezena || 10} variant="teal" size="md" />
              <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {stats.quentes[0]?.frequencia}x
              </span>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {stats.quentes[0]?.percentual}%
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Maior atraso atual</p>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-center gap-2.5">
              <BallBadge number={stats.maisAtrasadas[0]?.dezena || 1} variant="delayed" size="md" />
              <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {stats.maisAtrasadas[0]?.atraso}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              concursos sem sair
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Soma média das 6 dezenas</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {stats.mediaSoma}
            </span>
            <span className="text-xs font-mono tabular-nums text-[#208494] dark:text-[#4BB8C9]">
              IQR {stats.q1Soma}–{stats.q3Soma}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Equilíbrio Par/Ímpar (2–4P)</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {Math.round(
                stats.distribuicaoParidade
                  .filter((p) => p.recomendado)
                  .reduce((acc, p) => acc + p.percentual, 0) * 10
              ) / 10}
              %
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              dos sorteios
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: Frequency Rankings (Quentes vs Frias) & Delay Map */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Hot Numbers */}
        <div className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-[#1E2B37]">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Dezenas Mais Sorteadas (Quentes)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Top 10 no recorte selecionado
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onQuickGenerateWithNumbers(stats.quentes.slice(0, 3).map((q) => q.dezena))
                }
                className="text-xs font-medium text-[#208494] dark:text-[#4BB8C9] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Fixar Top 3
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {stats.quentes.map((item, idx) => (
                <div key={item.dezena} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-mono tabular-nums text-slate-400">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <BallBadge number={item.dezena} variant="hot" size="sm" />
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-[#192530] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#208494]"
                      style={{ width: `${Math.max(8, (item.frequencia / maxHotFreq) * 100)}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs font-mono tabular-nums text-slate-700 dark:text-slate-200">
                    {item.frequencia}x{' '}
                    <span className="text-slate-400">({item.percentual}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cold Numbers */}
        <div className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-[#1E2B37]">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Dezenas Menos Sorteadas (Frias)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Menor ocorrência no recorte selecionado
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {stats.frias.map((item, idx) => (
                <div key={item.dezena} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-mono tabular-nums text-slate-400">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <BallBadge number={item.dezena} variant="cold" size="sm" />
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-[#192530] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
                      style={{ width: `${Math.max(8, (item.frequencia / maxHotFreq) * 100)}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs font-mono tabular-nums text-slate-700 dark:text-slate-200">
                    {item.frequencia}x{' '}
                    <span className="text-slate-400">({item.percentual}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Delay Map */}
        <div className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-5">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-[#1E2B37]">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Mapa de Atraso
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Concursos consecutivos sem aparecer
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onQuickGenerateWithNumbers(stats.maisAtrasadas.slice(0, 3).map((d) => d.dezena))
              }
              className="text-xs font-medium text-[#208494] dark:text-[#4BB8C9] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Usar Top 3
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {stats.maisAtrasadas.slice(0, 10).map((item) => (
              <div key={item.dezena} className="flex items-center gap-3">
                <BallBadge number={item.dezena} variant="delayed" size="sm" />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200 font-medium">
                      {item.atraso} concursos sem sair
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      Último: #{item.ultimoConcurso ?? '—'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-[#192530] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.max(10, (item.atraso / maxDelay) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Sum Curve & Parity Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Distribuição da Soma das Dezenas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              Faixa interquartil destacada em verde-petróleo ({stats.q1Soma}–{stats.q3Soma} · média{' '}
              {stats.mediaSoma})
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.distribuicaoSoma}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="faixa"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, _name: string, props: { payload?: { percentual?: number } }) => [
                    `${value} sorteios (${props.payload?.percentual ?? 0}%)`,
                    'Ocorrências',
                  ]}
                />
                <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                  {stats.distribuicaoSoma.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.isInterquartil ? '#208494' : isDark ? '#33485B' : '#94A3B8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Proporção Pares / Ímpares
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Padrões 2P/4I, 3P/3I e 4P/2I em destaque concentram a maioria dos resultados
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.distribuicaoParidade}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="padrao"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, _name: string, props: { payload?: { quantidade?: number } }) => [
                    `${value}% (${props.payload?.quantidade ?? 0} concursos)`,
                    'Frequência',
                  ]}
                />
                <Bar dataKey="percentual" radius={[4, 4, 0, 0]}>
                  {stats.distribuicaoParidade.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.recomendado ? '#238B8B' : isDark ? '#33485B' : '#94A3B8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Section 4: Searchable Official Draw History Table */}
      <section className="rounded-xl border border-slate-200 dark:border-[#22303D] bg-white dark:bg-[#111921] overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-[#22303D]">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Histórico Oficial de Concursos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {historyTotal.toLocaleString('pt-BR')} concurso(s) encontrado(s)
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar concurso, data, dezena ou UF..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#283847] bg-slate-50 dark:bg-[#0D141B] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#208494]/40 focus:border-[#208494]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#22303D] text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0E151C]">
                <th className="py-3 px-4">Concurso</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Dezenas Sorteadas</th>
                <th className="py-3 px-4 text-right">Soma</th>
                <th className="py-3 px-4 text-right">Par/Ímpar</th>
                <th className="py-3 px-4 text-right">Sena</th>
                <th className="py-3 px-4 text-right">Rateio / Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1B2631] text-xs">
              {historyLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="py-3.5 px-4">
                      <div className="h-5 rounded bg-slate-100 dark:bg-[#17222D] animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : historyRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-500 dark:text-slate-400">
                    Nenhum concurso encontrado para &ldquo;{searchTerm}&rdquo;.
                  </td>
                </tr>
              ) : (
                historyRows.map((c) => (
                  <tr
                    key={c.concurso}
                    className="hover:bg-slate-50 dark:hover:bg-[#15202A] transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      #{c.concurso}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatIsoDateBr(c.data_sorteio)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {c.dezenas.map((d) => (
                          <BallBadge key={d} number={d} variant="neutral" size="xs" />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                      {c.soma_dezenas}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {c.qtd_pares}P / {6 - c.qtd_pares}I
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {c.ganhadores_sena > 0 ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {c.ganhadores_sena} {c.cidade_uf ? `(${c.cidade_uf})` : ''}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Acumulou
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {c.ganhadores_sena > 0
                        ? formatBrl(c.rateio_sena)
                        : formatBrl(c.acumulado_sena || c.estimativa_premio)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#22303D] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#283847] text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-[#192530] cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#283847] text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-[#192530] cursor-pointer disabled:cursor-not-allowed"
            >
              Próxima
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
