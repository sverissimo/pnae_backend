export function isDuplicateError(e: unknown): boolean {
  const any = e as any;
  if (any?.code === 'P2002') return true;
  if (/Unique constraint failed/i.test(any?.message)) return true;
  if (any?.code === '23505') return true; // Postgres native
  return false;
}
