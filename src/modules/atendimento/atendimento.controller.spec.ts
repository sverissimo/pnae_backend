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

describe('AtendimentoController — SEI routes (admin-only)', () => {
  let atendimentoService: any;
  let logger: any;
  let controller: AtendimentoController;

  const adminUser = (): any => ({
    isCoordenadorRegional: () => false,
    isAdmin: () => true,
    hasAccessTo: () => true,
  });
  const adminNoAccess = (): any => ({
    isCoordenadorRegional: () => false,
    isAdmin: () => true,
    hasAccessTo: () => false,
  });
  const coordUser = (): any => ({
    isCoordenadorRegional: () => true,
    isAdmin: () => false,
    hasAccessTo: () => true,
  });
  const staffUser = (): any => ({
    isCoordenadorRegional: () => false,
    isAdmin: () => false,
    hasAccessTo: () => true,
  });

  beforeEach(() => {
    atendimentoService = {
      aprovarSei: jest.fn().mockResolvedValue(undefined),
      removerAprovacaoSei: jest.fn().mockResolvedValue(undefined),
      getAtendimentoAuthScope: jest
        .fn()
        .mockResolvedValue({ ownerId: 'tec-1', regionId: 'G0001' }),
    };
    logger = { error: jest.fn() };
    controller = new AtendimentoController(atendimentoService, logger);
  });

  it('aprovar-sei: admin with visibility delegates to aprovarSei', async () => {
    const req: any = { user: adminUser() };

    await controller.aprovarSei('99', req);

    expect(atendimentoService.getAtendimentoAuthScope).toHaveBeenCalledWith(
      '99',
    );
    expect(atendimentoService.aprovarSei).toHaveBeenCalledWith('99');
    expect(atendimentoService.removerAprovacaoSei).not.toHaveBeenCalled();
  });

  it('remover-aprovacao-sei: admin delegates to removerAprovacaoSei', async () => {
    const req: any = { user: adminUser() };

    await controller.removerAprovacaoSei('99', req);

    expect(atendimentoService.removerAprovacaoSei).toHaveBeenCalledWith('99');
    expect(atendimentoService.aprovarSei).not.toHaveBeenCalled();
  });

  it('rejects coordenador with 403 (capability) — never resolves scope or mutates', async () => {
    const req: any = { user: coordUser() };

    await expect(controller.aprovarSei('99', req)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(atendimentoService.getAtendimentoAuthScope).not.toHaveBeenCalled();
    expect(atendimentoService.aprovarSei).not.toHaveBeenCalled();
  });

  it('rejects staff with 403 (capability)', async () => {
    const req: any = { user: staffUser() };

    await expect(
      controller.removerAprovacaoSei('99', req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(atendimentoService.removerAprovacaoSei).not.toHaveBeenCalled();
  });

  it('rejects missing req.user with 403 (mobile/static-token path)', async () => {
    const req: any = { user: undefined };

    await expect(controller.aprovarSei('99', req)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(atendimentoService.aprovarSei).not.toHaveBeenCalled();
  });

  it('rejects out-of-scope admin with 404 (visibility) — no mutation', async () => {
    const req: any = { user: adminNoAccess() };

    await expect(controller.aprovarSei('99', req)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(atendimentoService.getAtendimentoAuthScope).toHaveBeenCalledWith(
      '99',
    );
    expect(atendimentoService.aprovarSei).not.toHaveBeenCalled();
  });

  it('translates the upstream precondition 400, preserving the gateway message', async () => {
    const gatewayMessage =
      'Atendimento inexistente ou ainda não validado pelo coordenador regional.';
    const upstream = Object.assign(new Error(gatewayMessage), { status: 400 });
    atendimentoService.aprovarSei.mockRejectedValue(upstream);
    const req: any = { user: adminUser() };

    await expect(controller.aprovarSei('99', req)).rejects.toMatchObject({
      status: 400,
      message: gatewayMessage,
    });
    await expect(controller.aprovarSei('99', req)).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});
