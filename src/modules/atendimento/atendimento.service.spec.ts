//// filepath: src/modules/atendimento/atendimento.service.spec.ts
jest.mock('src/@graphQL-server/atendimento-api.service', () => ({
  AtendimentoGraphQLAPI: jest.fn().mockImplementation(() => ({
    findOne: jest.fn(),
    update: jest.fn(),
  })),
}));
import { AtendimentoService } from './atendimento.service';
import { CACHE_KEYS } from 'src/cache/cache.constants';

describe('AtendimentoService.fixDatesIfNeeded', () => {
  const buildService = () => {
    const service = Object.create(
      AtendimentoService.prototype,
    ) as AtendimentoService;
    service.findOne = jest.fn();
    service.update = jest.fn();
    return service;
  };

  it('returns false when createdAt is missing', async () => {
    const service = buildService();
    const result = await service.fixDatesIfNeeded({
      createdAt: '',
      atendimentoId: '123',
    });
    expect(result).toBe(false);
    expect(service.findOne).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('returns false when atendimentoId is missing', async () => {
    const service = buildService();
    const result = await service.fixDatesIfNeeded({
      createdAt: '2024-01-01T00:00:00Z',
      atendimentoId: '',
    });
    expect(result).toBe(false);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('fills missing start/end dates when atendimento has no valid date', async () => {
    const service = buildService();
    (service.findOne as jest.Mock).mockResolvedValue({
      data_inicio_atendimento: null,
    });

    const createdAt = '2024-03-10T12:00:00Z';
    const result = await service.fixDatesIfNeeded({
      createdAt,
      atendimentoId: '42',
    });

    expect(result).toBe(true);
    expect(service.findOne).toHaveBeenCalledWith('42');
    expect(service.update).toHaveBeenCalledWith('42', {
      data_inicio_atendimento: createdAt,
      data_fim_atendimento: createdAt,
    });
  });

  it('returns false when createdAt is invalid', async () => {
    const service = buildService();
    (service.findOne as jest.Mock).mockResolvedValue({
      data_inicio_atendimento: '2024-01-01T00:00:00Z',
    });

    const result = await service.fixDatesIfNeeded({
      createdAt: 'invalid-date',
      atendimentoId: '42',
    });

    expect(result).toBe(false);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('updates atendimento when dates differ', async () => {
    const service = buildService();
    (service.findOne as jest.Mock).mockResolvedValue({
      data_inicio_atendimento: '2024-01-01T00:00:00Z',
    });

    const createdAt = '2024-01-02T00:00:00Z';
    const result = await service.fixDatesIfNeeded({
      createdAt,
      atendimentoId: '42',
    });

    expect(result).toBe(true);
    expect(service.findOne).toHaveBeenCalledWith('42');
    expect(service.findOne).toHaveBeenCalledTimes(1);
    expect(service.update).toHaveBeenCalledWith('42', {
      data_inicio_atendimento: createdAt,
      data_fim_atendimento: createdAt,
    });
  });

  it('returns false and skips update when dates match', async () => {
    const service = buildService();
    (service.findOne as jest.Mock).mockResolvedValue({
      data_inicio_atendimento: '2024-01-01T00:00:00Z',
    });

    const createdAt = '2024-01-01T23:59:59Z';
    const result = await service.fixDatesIfNeeded({
      createdAt,
      atendimentoId: '42',
    });

    expect(result).toBe(false);
    expect(service.findOne).toHaveBeenCalledWith('42');
    expect(service.findOne).toHaveBeenCalledTimes(1);
    expect(service.update).not.toHaveBeenCalled();
  });
});

describe('AtendimentoService validation', () => {
  const buildService = () => {
    const service = Object.create(
      AtendimentoService.prototype,
    ) as AtendimentoService;
    const restAPI = {
      aprovarAtendimento: jest.fn().mockResolvedValue(undefined),
      criarPendenciaAtendimento: jest.fn().mockResolvedValue(undefined),
      aprovarSei: jest.fn().mockResolvedValue(undefined),
      removerAprovacaoSei: jest.fn().mockResolvedValue(undefined),
    };
    const redisInvalidator = {
      invalidate: jest.fn().mockResolvedValue(undefined),
    };
    (service as any).restAPI = restAPI;
    (service as any).redisInvalidator = redisInvalidator;
    return { service, restAPI, redisInvalidator };
  };

  it('aprovarAtendimento forwards to restAPI and busts the atendimento cache', async () => {
    const { service, restAPI, redisInvalidator } = buildService();

    await service.aprovarAtendimento('99');

    expect(restAPI.aprovarAtendimento).toHaveBeenCalledWith('99');
    expect(restAPI.criarPendenciaAtendimento).not.toHaveBeenCalled();
    expect(redisInvalidator.invalidate).toHaveBeenCalledWith(
      CACHE_KEYS.atendimento,
      ['99'],
    );
  });

  it('criarPendenciaAtendimento forwards to restAPI and busts the atendimento cache', async () => {
    const { service, restAPI, redisInvalidator } = buildService();

    await service.criarPendenciaAtendimento('99');

    expect(restAPI.criarPendenciaAtendimento).toHaveBeenCalledWith('99');
    expect(restAPI.aprovarAtendimento).not.toHaveBeenCalled();
    expect(redisInvalidator.invalidate).toHaveBeenCalledWith(
      CACHE_KEYS.atendimento,
      ['99'],
    );
  });

  it('throws and does not call restAPI when atendimentoId is missing', async () => {
    const { service, restAPI, redisInvalidator } = buildService();

    await expect(service.aprovarAtendimento('')).rejects.toThrow(
      'atendimentoId é obrigatório.',
    );
    expect(restAPI.aprovarAtendimento).not.toHaveBeenCalled();
    expect(redisInvalidator.invalidate).not.toHaveBeenCalled();
  });

  it('aprovarSei forwards to restAPI and busts the atendimento cache', async () => {
    const { service, restAPI, redisInvalidator } = buildService();

    await service.aprovarSei('99');

    expect(restAPI.aprovarSei).toHaveBeenCalledWith('99');
    expect(restAPI.removerAprovacaoSei).not.toHaveBeenCalled();
    expect(redisInvalidator.invalidate).toHaveBeenCalledWith(
      CACHE_KEYS.atendimento,
      ['99'],
    );
  });

  it('removerAprovacaoSei forwards to restAPI and busts the atendimento cache', async () => {
    const { service, restAPI, redisInvalidator } = buildService();

    await service.removerAprovacaoSei('99');

    expect(restAPI.removerAprovacaoSei).toHaveBeenCalledWith('99');
    expect(restAPI.aprovarSei).not.toHaveBeenCalled();
    expect(redisInvalidator.invalidate).toHaveBeenCalledWith(
      CACHE_KEYS.atendimento,
      ['99'],
    );
  });

  it('aprovarSei throws and skips restAPI when atendimentoId is missing', async () => {
    const { service, restAPI, redisInvalidator } = buildService();

    await expect(service.aprovarSei('')).rejects.toThrow(
      'atendimentoId é obrigatório.',
    );
    expect(restAPI.aprovarSei).not.toHaveBeenCalled();
    expect(redisInvalidator.invalidate).not.toHaveBeenCalled();
  });
});

describe('AtendimentoService.getAtendimentoAuthScope', () => {
  const buildService = (overrides: { map?: Map<string, string> } = {}) => {
    const service = Object.create(
      AtendimentoService.prototype,
    ) as AtendimentoService;
    service.findOne = jest.fn();
    (service as any).cachedMunicipiosReader = {
      getUnidadeToRegionalMap: jest
        .fn()
        .mockResolvedValue(overrides.map ?? new Map<string, string>()),
    };
    return service;
  };

  it('returns an empty scope for a missing atendimentoId', async () => {
    const service = buildService();
    const scope = await service.getAtendimentoAuthScope('');
    expect(scope).toEqual({ ownerId: null, regionId: null });
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('reads owner from at_atendimento_usuario and uses a "G…" unit as the region directly', async () => {
    const service = buildService();
    (service.findOne as jest.Mock).mockResolvedValue({
      at_atendimento_usuario: { id_usuario: 'tec-1' },
      id_und_empresa: 'G0001',
    });

    const scope = await service.getAtendimentoAuthScope('99');

    expect(scope).toEqual({ ownerId: 'tec-1', regionId: 'G0001' });
    expect(
      (service as any).cachedMunicipiosReader.getUnidadeToRegionalMap,
    ).not.toHaveBeenCalled();
  });

  it('maps a local "H…" unit to its regional parent via the cached map', async () => {
    const service = buildService({ map: new Map([['H0123', 'G0040']]) });
    (service.findOne as jest.Mock).mockResolvedValue({
      at_atendimento_usuario: { id_usuario: 7 },
      id_und_empresa: 'H0123',
    });

    const scope = await service.getAtendimentoAuthScope('99');

    expect(scope).toEqual({ ownerId: '7', regionId: 'G0040' });
  });

  it('yields a null region for an "H…" unit missing from the map', async () => {
    const service = buildService({ map: new Map() });
    (service.findOne as jest.Mock).mockResolvedValue({
      at_atendimento_usuario: { id_usuario: 'tec-1' },
      id_und_empresa: 'H9999',
    });

    const scope = await service.getAtendimentoAuthScope('99');

    expect(scope).toEqual({ ownerId: 'tec-1', regionId: null });
  });

  it('returns an empty scope when the atendimento lookup throws (nonexistent id)', async () => {
    const service = buildService();
    (service.findOne as jest.Mock).mockRejectedValue(new Error('not found'));

    const scope = await service.getAtendimentoAuthScope('does-not-exist');

    expect(scope).toEqual({ ownerId: null, regionId: null });
  });
});
