import type { Bolao } from '../types/lottery';

export function formatDezena(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} mi`;
  }
  return formatCurrency(value);
}

export function formatIsoDateBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportGamesAsCsv(
  jogos: Array<{ dezenas: number[]; valorAposta?: number }>,
  filename = 'vitoria-jogos-megasena.csv'
) {
  const header = 'Jogo,Dezenas,Qtd Dezenas,Soma,Pares,Impares,Valor Estimado';
  const rows = jogos.map((j, idx) => {
    const sorted = [...j.dezenas].sort((a, b) => a - b);
    const soma = sorted.reduce((a, b) => a + b, 0);
    const pares = sorted.filter((n) => n % 2 === 0).length;
    const impares = sorted.length - pares;
    const dezenasStr = sorted.map(formatDezena).join(' - ');
    return `${idx + 1},"${dezenasStr}",${sorted.length},${soma},${pares},${impares},"${formatCurrency(j.valorAposta ?? 5)}"`;
  });
  downloadTextFile(filename, [header, ...rows].join('\n'), 'text/csv;charset=utf-8;');
}

export function exportGamesAsTxt(
  jogos: Array<{ dezenas: number[] }>,
  titulo = 'Jogos Mega-Sena — Vitória',
  filename = 'vitoria-jogos-megasena.txt'
) {
  const lines = [
    titulo,
    `Total de jogos: ${jogos.length}`,
    '----------------------------------------',
    ...jogos.map(
      (j, i) =>
        `${String(i + 1).padStart(2, '0')}. ${[...j.dezenas]
          .sort((a, b) => a - b)
          .map(formatDezena)
          .join('  ')}`
    ),
    '----------------------------------------',
    'Aviso: Ferramenta independente sem vínculo com a Caixa Econômica Federal.',
  ];
  downloadTextFile(filename, lines.join('\n'), 'text/plain;charset=utf-8;');
}

export function formatBolaoWhatsAppText(bolao: Bolao): string {
  const custoTotal = bolao.jogos.reduce((acc, j) => acc + j.valorAposta, 0);
  const cotasVendidas = bolao.participantes.reduce((acc, p) => acc + p.cotasCompradas, 0);
  const totalPago = bolao.participantes
    .filter((p) => p.pago)
    .reduce((acc, p) => acc + p.cotasCompradas * bolao.valorCota, 0);

  const participantesTxt =
    bolao.participantes.length > 0
      ? bolao.participantes
          .map(
            (p) =>
              `- ${p.nome}: ${p.cotasCompradas} cota(s) [${p.pago ? 'PAGO' : 'PENDENTE'}]`
          )
          .join('\n')
      : '- Nenhum participante cadastrado ainda';

  const jogosTxt =
    bolao.jogos.length > 0
      ? bolao.jogos
          .map(
            (j, idx) =>
              `Jogo ${String(idx + 1).padStart(2, '0')}: ${[...j.dezenas]
                .sort((a, b) => a - b)
                .map(formatDezena)
                .join(' - ')}`
          )
          .join('\n')
      : '- Nenhum jogo cadastrado ainda';

  return [
    `*${bolao.titulo}*`,
    `Concurso alvo: *#${bolao.concursoAlvo}* (Mega-Sena)`,
    `Jogos: ${bolao.jogos.length} | Custo total: ${formatCurrency(custoTotal)}`,
    `Cotas: ${cotasVendidas}/${bolao.qtdCotasTotais} | Valor por cota: ${formatCurrency(bolao.valorCota)}`,
    `Arrecadado (pagos): ${formatCurrency(totalPago)}`,
    '',
    '*Participantes:*',
    participantesTxt,
    '',
    '*Volantes do Bolão:*',
    jogosTxt,
    '',
    '_Organizado na plataforma Vitória (ferramenta independente de conferência e rateio)._',
  ].join('\n');
}
