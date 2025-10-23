export function isDuplicateError(e: unknown): boolean {
  const any = e as any;
  if (any?.code === 'P2002' || any?.code === '23505') return true;
  const msg = typeof any?.message === 'string' ? any.message : '';
  return /Unique constraint failed/i.test(msg);
}
