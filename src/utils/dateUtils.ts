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

export function toBRTimezone(date: Date): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return date;
  }
  // Convert to Brazil timezone (UTC-3)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const brazilOffset = -3 * 60 * 60000; // UTC-3
  return new Date(utc + brazilOffset);
}

// Convert a Brazil-local time (UTC-3) back to canonical UTC by adding 3 hours
export function brToUTCTimezone(date: Date | string): Date {
  const d = new Date(date as any);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return d as any;
  }
  const threeHoursMs = 3 * 60 * 60 * 1000;
  return new Date(d.getTime() + threeHoursMs);
}

export function parseSyncedDates(
  clientDate?: string | Date | null,
  serverDate?: string | Date | null,
): { clientMs: number | null; serverMs: number | null } {
  try {
    const clientAsDate = clientDate
      ? new Date(clientDate as string | number | Date)
      : null;
    const clientMsRaw = clientAsDate
      ? toBRTimezone(clientAsDate).getTime()
      : NaN;
    const serverMsRaw = serverDate ? Date.parse(serverDate as any) : NaN;

    return {
      clientMs: isNaN(clientMsRaw) ? null : clientMsRaw,
      serverMs: isNaN(serverMsRaw) ? null : serverMsRaw,
    };
  } catch (err) {
    console.warn('[parseSyncedDates] Invalid date input skipped:', {
      clientDate,
      serverDate,
      err,
    });
    return { clientMs: null, serverMs: null };
  }
}
