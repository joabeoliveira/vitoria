import React, { useRef, useState } from 'react';
import { Upload, X, PlusCircle, RefreshCw } from 'lucide-react';

interface DataSyncModalProps {
  open: boolean;
  latestConcurso: number;
  onClose: () => void;
  onDataUpdated: (message: string) => void;
}

export const DataSyncModal: React.FC<DataSyncModalProps> = ({
  open,
  latestConcurso,
  onClose,
  onDataUpdated,
}) => {
  const [tab, setTab] = useState<'csv' | 'manual'>('csv');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual draw fields
  const [concursoNum, setConcursoNum] = useState(String(latestConcurso + 1));
  const [dataSorteio, setDataSorteio] = useState(new Date().toISOString().slice(0, 10));
  const [dezenasStr, setDezenasStr] = useState('');
  const [estimativa, setEstimativa] = useState('');

  if (!open) return null;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const text = await file.text();
      const res = await fetch('/api/concursos/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Falha ao importar arquivo CSV.');
      } else {
        onDataUpdated(
          `CSV importado: ${data.totalProcessados} concursos processados (${data.inseridos} novos, ${data.atualizados} atualizados).`
        );
        onClose();
      }
    } catch {
      setError('Erro de conexão ao enviar arquivo CSV.');
    } finally {
      setBusy(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nums = dezenasStr
      .split(/[\s,;-]+/)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 60);
    const unique = [...new Set(nums)].sort((a, b) => a - b);

    if (unique.length !== 6) {
      setError('Informe exatamente 6 dezenas distintas entre 01 e 60 (ex.: 04 12 23 35 48 59).');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/sync-concursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualDraw: {
            concurso: Number(concursoNum),
            data_sorteio: dataSorteio,
            dezenas: unique,
            estimativa_premio: estimativa ? Number(estimativa) : 0,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar concurso.');
      } else {
        onDataUpdated(data.message);
        onClose();
      }
    } catch {
      setError('Erro de comunicação com o servidor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-[#283847] bg-white dark:bg-[#111921] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#22303D]">
          <h3 id="sync-modal-title" className="text-base font-semibold text-slate-900 dark:text-white">
            Gerenciar Base de Concursos
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1B2631] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#16212B]">
            <button
              type="button"
              onClick={() => {
                setTab('csv');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'csv'
                  ? 'bg-white dark:bg-[#208494] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Importar CSV Histórico
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('manual');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'manual'
                  ? 'bg-white dark:bg-[#208494] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Registrar Concurso Manual
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {tab === 'csv' ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Envie um arquivo CSV no formato oficial da Mega-Sena (datas <code className="font-mono">DD/MM/AAAA</code> e valores em <code className="font-mono">R$</code>). O sistema realiza UPSERT sem duplicar concursos já importados.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 px-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#2C3E4F] hover:border-[#208494] dark:hover:border-[#2EA3B5] bg-slate-50 dark:bg-[#0D141B] flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {busy ? (
                  <RefreshCw className="w-6 h-6 text-[#208494] animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-[#208494]" />
                )}
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {busy ? 'Processando arquivo CSV...' : 'Selecionar arquivo .csv'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Último concurso atual na base: #{latestConcurso}
                </span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Número do Concurso
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={concursoNum}
                    onChange={(e) => setConcursoNum(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-[#283847] bg-slate-50 dark:bg-[#0D141B] text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Data do Sorteio
                  </label>
                  <input
                    type="date"
                    required
                    value={dataSorteio}
                    onChange={(e) => setDataSorteio(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-[#283847] bg-slate-50 dark:bg-[#0D141B] text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  6 Dezenas Sorteadas (separadas por espaço ou vírgula)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex.: 05 14 23 37 49 58"
                  value={dezenasStr}
                  onChange={(e) => setDezenasStr(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-[#283847] bg-slate-50 dark:bg-[#0D141B] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Estimativa Próximo Prêmio (R$ — opcional)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Ex.: 45000000"
                  value={estimativa}
                  onChange={(e) => setEstimativa(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-[#283847] bg-slate-50 dark:bg-[#0D141B] text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-[#283847] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#192530] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#208494] hover:bg-[#1A6D7A] text-white cursor-pointer disabled:opacity-60"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  {busy ? 'Salvando...' : 'Salvar Concurso'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
