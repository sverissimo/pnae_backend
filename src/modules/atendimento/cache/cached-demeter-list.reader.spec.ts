import { CachedDemeterListReader } from './cached-demeter-list.reader';
import { CACHE_KEYS } from 'src/cache/cache.constants';
import { AtendimentoComRelatorioDemeterPageDTO } from '../dto/atendimento-com-relatorio-demeter.dto';

const page: AtendimentoComRelatorioDemeterPageDTO = {
  items: [],
  pageSize: 200,
  nextCursor: null,
  hasMore: false,
};

const buildReader = (redisOverrides: Record<string, jest.Mock> = {}) => {
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    ...redisOverrides,
  };
  const logger = { error: jest.fn(), log: jest.fn() };
  const reader = new CachedDemeterListReader(redis as any, logger as any);
  return { reader, redis, logger };
};

describe('CachedDemeterListReader.getOrLoad', () => {
  it('returns the cached page without calling the loader on a hit', async () => {
    const { reader, redis } = buildReader({
      get: jest
        .fn()
        .mockResolvedValueOnce('3') // version
        .mockResolvedValueOnce(JSON.stringify(page)),
    });
    const loader = jest.fn();

    const result = await reader.getOrLoad(['admin', '200', 'first'], loader);

    expect(result).toEqual(page);
    expect(loader).not.toHaveBeenCalled();
    expect(redis.get).toHaveBeenNthCalledWith(1, CACHE_KEYS.manualListVersion);
    expect(redis.get).toHaveBeenNthCalledWith(
      2,
      `${CACHE_KEYS.manualList}:3:admin:200:first`,
    );
  });

  it('loads and caches with a 90s TTL on a miss, defaulting version to 0', async () => {
    const { reader, redis } = buildReader();
    const loader = jest.fn().mockResolvedValue(page);

    const result = await reader.getOrLoad(['staff:7', '200', 'first'], loader);

    expect(result).toEqual(page);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.setex).toHaveBeenCalledWith(
      `${CACHE_KEYS.manualList}:0:staff:7:200:first`,
      90,
      JSON.stringify(page),
    );
  });

  it('falls through to the loader and still returns when redis.get throws (fail-open)', async () => {
    const { reader, redis, logger } = buildReader({
      get: jest.fn().mockRejectedValue(new Error('redis down')),
    });
    const loader = jest.fn().mockResolvedValue(page);

    const result = await reader.getOrLoad(['admin', '200', 'first'], loader);

    expect(result).toEqual(page);
    expect(logger.error).toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('recovers from a corrupt cached value by loading and overwriting it', async () => {
    const { reader, redis } = buildReader({
      get: jest
        .fn()
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('{not json'),
    });
    const loader = jest.fn().mockResolvedValue(page);

    const result = await reader.getOrLoad(['admin', '200', 'first'], loader);

    expect(result).toEqual(page);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.setex).toHaveBeenCalled();
  });

  it('returns the loader result even when setex fails', async () => {
    const { reader, logger } = buildReader({
      setex: jest.fn().mockRejectedValue(new Error('redis down')),
    });
    const loader = jest.fn().mockResolvedValue(page);

    const result = await reader.getOrLoad(['admin', '200', 'first'], loader);

    expect(result).toEqual(page);
    expect(logger.error).toHaveBeenCalled();
  });

  it('composes a different key after bumpVersion so the next read misses', async () => {
    const { reader, redis } = buildReader({
      get: jest
        .fn()
        .mockResolvedValueOnce('0') // version before bump
        .mockResolvedValueOnce(null) // page miss
        .mockResolvedValueOnce('1') // version after bump
        .mockResolvedValueOnce(null), // page miss under new key
    });
    const loader = jest.fn().mockResolvedValue(page);

    await reader.getOrLoad(['admin', '200', 'first'], loader);
    await reader.bumpVersion();
    await reader.getOrLoad(['admin', '200', 'first'], loader);

    expect(redis.incr).toHaveBeenCalledWith(CACHE_KEYS.manualListVersion);
    const setexKeys = redis.setex.mock.calls.map((call) => call[0]);
    expect(setexKeys).toEqual([
      `${CACHE_KEYS.manualList}:0:admin:200:first`,
      `${CACHE_KEYS.manualList}:1:admin:200:first`,
    ]);
  });
});

describe('CachedDemeterListReader.bumpVersion', () => {
  it('swallows and logs redis errors (fail-open)', async () => {
    const { reader, logger } = buildReader({
      incr: jest.fn().mockRejectedValue(new Error('redis down')),
    });

    await expect(reader.bumpVersion()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
