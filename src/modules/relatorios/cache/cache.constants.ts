export const CACHE_KEYS = {
  produtor: 'produtor:v1',
  atendimento: 'atendimento:v1',
  regionaisEmater: 'perfil:regionaisEmater:v1',
  municipiosEmater: 'perfil:municipiosEmater:v1',
  replacedAtendimentos: 'atendimento:replaced:v1',
} as const;

export const CACHE_TTLS = {
  produtor: 60 * 60 * 24,
  atendimento: 90,
  regionaisEmater: 60 * 60 * 24,
  municipiosEmater: 60 * 60 * 24,
  replacedAtendimentos: 60 * 3,
} as const;

export const REDIS_CLIENT = Symbol('RELATORIOS_CACHE_REDIS_CLIENT');

// Fail-closed: only logs when NODE_ENV is explicitly dev or homolog.
// Any other value (or undefined) → silent. Protects prod from accidental verbosity
// if production.env ever fails to load.
export const CACHE_LOG_ENABLED =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'homolog';
