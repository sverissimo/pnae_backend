//// filepath: src/modules/atendimento/atendimento.service.spec.ts
jest.mock('src/@graphQL-server/atendimento-api.service', () => ({
  AtendimentoGraphQLAPI: jest.fn().mockImplementation(() => ({
    findOne: jest.fn(),
    update: jest.fn(),
  })),
}));
import { AtendimentoService } from './atendimento.service';

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
