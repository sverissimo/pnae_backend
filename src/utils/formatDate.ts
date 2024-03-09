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
