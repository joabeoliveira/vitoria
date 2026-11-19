import type { Concurso } from '../types/lottery';

/**
 * Parses a single RFC-4180 CSV line supporting quoted strings with commas and escaped quotes.
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Converts DD/MM/YYYY to YYYY-MM-DD (or preserves YYYY-MM-DD).
 */
export function parseBrDateToIso(raw: string): string {
  const cleaned = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    throw new Error(`Data inválida: "${raw}"`);
  }
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];
  return `${year}-${month}-${day}`;
}

/**
 * Sanitizes BRL monetary string like "R$1.714.650,23" into numeric 1714650.23
 */
export function parseBrlCurrency(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

export function parseIntSafe(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/\./g, '').replace(/[^\d-]/g, '');
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface CsvParseResult {
  concursos: Concurso[];
  erros: string[];
}

/**
 * Parses Mega-Sena CSV following PRD 2.1 specification:
 * Concurso,Data do Sorteio,Bola1..Bola6,Ganhadores 6 acertos,Cidade / UF,Rateio 6 acertos,...
 */
export function parseMegaSenaCsv(csvContent: string): CsvParseResult {
  const lines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { concursos: [], erros: ['Arquivo CSV vazio ou sem registros.'] };
  }

  const concursos: Concurso[] = [];
  const erros: string[] = [];

  for (let idx = 1; idx < lines.length; idx++) {
    const cols = parseCsvLine(lines[idx]);
    if (cols.length < 15) {
      erros.push(`Linha ${idx + 1}: número insuficiente de colunas (${cols.length}).`);
      continue;
    }

    try {
      const numero = parseIntSafe(cols[0]);
      if (numero <= 0) {
        erros.push(`Linha ${idx + 1}: número do concurso inválido.`);
        continue;
      }

      const dataIso = parseBrDateToIso(cols[1]);
      const dezenas = [
        parseIntSafe(cols[2]),
        parseIntSafe(cols[3]),
        parseIntSafe(cols[4]),
        parseIntSafe(cols[5]),
        parseIntSafe(cols[6]),
        parseIntSafe(cols[7]),
      ].sort((a, b) => a - b);

      if (dezenas.some((d) => d < 1 || d > 60)) {
        erros.push(`Linha ${idx + 1} (Concurso ${numero}): dezenas fora do intervalo 1..60.`);
        continue;
      }

      const soma = dezenas.reduce((acc, n) => acc + n, 0);
      const qtdPares = dezenas.filter((n) => n % 2 === 0).length;

      concursos.push({
        id: numero,
        modalidade: 'mega-sena',
        concurso: numero,
        data_sorteio: dataIso,
        dezenas,
        soma_dezenas: soma,
        qtd_pares: qtdPares,
        ganhadores_sena: parseIntSafe(cols[8]),
        cidade_uf: cols[9] || '',
        rateio_sena: parseBrlCurrency(cols[10]),
        ganhadores_quina: parseIntSafe(cols[11]),
        rateio_quina: parseBrlCurrency(cols[12]),
        ganhadores_quadra: parseIntSafe(cols[13]),
        rateio_quadra: parseBrlCurrency(cols[14]),
        acumulado_sena: parseBrlCurrency(cols[15]),
        arrecadacao_total: parseBrlCurrency(cols[16]),
        estimativa_premio: parseBrlCurrency(cols[17]),
        acumulado_virada: parseBrlCurrency(cols[18]),
        observacao: cols[19] || '',
      });
    } catch (err) {
      erros.push(
        `Linha ${idx + 1}: ${err instanceof Error ? err.message : 'erro desconhecido'}`
      );
    }
  }

  concursos.sort((a, b) => a.concurso - b.concurso);
  return { concursos, erros };
}
