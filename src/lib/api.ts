import type {
  Bolao,
  Concurso,
  DashboardStats,
  PeriodoFiltro,
} from '../types/lottery';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro na requisição (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function fetchStats(periodo: PeriodoFiltro): Promise<DashboardStats> {
  return apiFetch<DashboardStats>(`/api/stats?periodo=${periodo}`);
}

export function fetchHistoricalKeys(): Promise<{ total: number; keys: string[] }> {
  return apiFetch<{ total: number; keys: string[] }>('/api/concursos/keys');
}

export function fetchConcursos(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{
  items: Concurso[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('pageSize', String(params.pageSize));
  if (params.search) q.set('search', params.search);
  return apiFetch(`/api/concursos?${q.toString()}`);
}

export function fetchConcursoByNumber(numero: number): Promise<Concurso> {
  return apiFetch<Concurso>(`/api/concursos/${numero}`);
}

export function syncConcursos(): Promise<{
  status: string;
  novosConcursos: number;
  ultimoConcurso: number;
  totalConcursos: number;
  mensagem: string;
}> {
  return apiFetch('/api/sync-concursos', { method: 'POST' });
}

export function importCsvText(csv: string): Promise<{
  ok: boolean;
  processados: number;
  inseridos: number;
  atualizados: number;
  erros: number;
  totalConcursos: number;
  ultimoConcurso: number | null;
}> {
  return apiFetch('/api/import-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv }),
  });
}

export function upsertManualConcurso(payload: Partial<Concurso>): Promise<{
  action: 'inserted' | 'updated';
  concurso: Concurso;
  totalConcursos: number;
}> {
  return apiFetch('/api/concursos/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchBoloes(): Promise<Bolao[]> {
  return apiFetch<Bolao[]>('/api/boloes');
}

export function createBolaoApi(bolao: Partial<Bolao>): Promise<Bolao> {
  return apiFetch<Bolao>('/api/boloes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bolao),
  });
}

export function updateBolaoApi(bolao: Bolao): Promise<Bolao> {
  return apiFetch<Bolao>(`/api/boloes/${bolao.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bolao),
  });
}

export function deleteBolaoApi(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/boloes/${id}`, { method: 'DELETE' });
}
