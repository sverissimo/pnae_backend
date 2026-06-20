import {
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AtendimentoController } from './atendimento.controller';

describe('AtendimentoController — validation routes', () => {
  let atendimentoService: any;
  let logger: any;
  let controller: AtendimentoController;

  const coordWithAccess = (): any => ({
    isCoordenadorRegional: () => true,
    isAdmin: () => false,
    hasAccessTo: () => true,
  });
  const coordNoAccess = (): any => ({
    isCoordenadorRegional: () => true,
    isAdmin: () => false,
    hasAccessTo: () => false,
  });
  const adminUser = (): any => ({
    isCoordenadorRegional: () => false,
    isAdmin: () => true,
    hasAccessTo: () => true,
  });
  const staffUser = (): any => ({
    isCoordenadorRegional: () => false,
    isAdmin: () => false,
    hasAccessTo: () => true,
  });

  beforeEach(() => {
    atendimentoService = {
      aprovarAtendimento: jest.fn().mockResolvedValue(undefined),
      criarPendenciaAtendimento: jest.fn().mockResolvedValue(undefined),
      getAtendimentoAuthScope: jest
        .fn()
        .mockResolvedValue({ ownerId: 'tec-1', regionId: 'G0001' }),
    };
    logger = { error: jest.fn() };
    controller = new AtendimentoController(atendimentoService, logger);
  });

  it('aprovar: coordenador with visibility delegates to aprovarAtendimento', async () => {
    const req: any = { user: coordWithAccess() };

    await controller.aprovarAtendimento('99', req);

    expect(atendimentoService.getAtendimentoAuthScope).toHaveBeenCalledWith(
      '99',
    );
    expect(atendimentoService.aprovarAtendimento).toHaveBeenCalledWith('99');
    expect(atendimentoService.criarPendenciaAtendimento).not.toHaveBeenCalled();
  });

  it('aprovar: admin is also allowed', async () => {
    const req: any = { user: adminUser() };

    await controller.aprovarAtendimento('99', req);

    expect(atendimentoService.aprovarAtendimento).toHaveBeenCalledWith('99');
  });

  it('pendencia: coordenador with visibility delegates to criarPendenciaAtendimento', async () => {
    const req: any = { user: coordWithAccess() };

    await controller.criarPendenciaAtendimento('99', req);

    expect(atendimentoService.criarPendenciaAtendimento).toHaveBeenCalledWith(
      '99',
    );
    expect(atendimentoService.aprovarAtendimento).not.toHaveBeenCalled();
  });

  it('rejects staff with 403 (capability) — never resolves scope or mutates', async () => {
    const req: any = { user: staffUser() };

    await expect(
      controller.aprovarAtendimento('99', req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(atendimentoService.getAtendimentoAuthScope).not.toHaveBeenCalled();
    expect(atendimentoService.aprovarAtendimento).not.toHaveBeenCalled();
  });

  it('rejects missing req.user with 403 (mobile/static-token path)', async () => {
    const req: any = { user: undefined };

    await expect(
      controller.aprovarAtendimento('99', req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(atendimentoService.aprovarAtendimento).not.toHaveBeenCalled();
  });

  it('rejects out-of-scope coordenador with 404 (visibility) — no mutation', async () => {
    const req: any = { user: coordNoAccess() };

    await expect(
      controller.aprovarAtendimento('99', req),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(atendimentoService.getAtendimentoAuthScope).toHaveBeenCalledWith(
      '99',
    );
    expect(atendimentoService.aprovarAtendimento).not.toHaveBeenCalled();
  });

  it('translates an upstream throw, preserving the gateway status', async () => {
    const upstream = Object.assign(new Error('gateway 400'), { status: 400 });
    atendimentoService.aprovarAtendimento.mockRejectedValue(upstream);
    const req: any = { user: coordWithAccess() };

    await expect(controller.aprovarAtendimento('99', req)).rejects.toMatchObject(
      { status: 400 },
    );
    await expect(
      controller.aprovarAtendimento('99', req),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
