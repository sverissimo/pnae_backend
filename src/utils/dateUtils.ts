export const formatDate = (date: string | Date | undefined) => {
  if (date instanceof Date === true) {
    return date.toLocaleString('pt-BR').slice(0, 'yyyy-mm-dd'.length);
  }

  if (typeof date === 'string') {
    const formattedDate = date
      .slice(0, 'yyyy-mm-dd'.length)
      .split('-')
      .reverse()
      .join('/');
    return formattedDate;
  }
  return date;
};

export function formatReverseDate(date: Date): string {
  return date.toISOString().split('T')[0].replaceAll('-', '');
}

export function getYesterdayStringDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(new Date().getHours() - 3);

  const yesterdayString = formatDate(date) as string;
  const yesterday = yesterdayString.replaceAll('/', '-');
  return yesterday;
}

export function parseAndValidateDateRange(
  from: string,
  to: string,
): { start: Date; end: Date } {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(+start) || Number.isNaN(+end) || start > end) {
    throw new Error('Intervalo de datas inválido.');
  }
  return { start, end };
}
