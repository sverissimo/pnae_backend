jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => <T>(fn: () => Promise<T>) => fn(),
}));
jest.mock('graphql-request', () => ({
  gql: (literals: TemplateStringsArray) => literals[0],
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: jest.fn() })),
}));

import { RelatorioController } from './relatorios.controller';

describe('RelatorioController', () => {
  describe('mobile/static-token regression — req.user undefined', () => {
    // Mobile authenticates via the static CLIENT_TOKEN and arrives at
    // controllers with `req.user === undefined`. These tests pin that the
    // controller does NOT enforce scope on the mobile path, so the shipped
    // contract on GET /relatorios/:id and PATCH /relatorios/:id stays
    // byte-for-byte identical.

    let service: any;
    let logger: any;
    let controller: RelatorioController;

    beforeEach(() => {
      service = {
        findOne: jest.fn(),
        assertCanAccess: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
      };
      logger = { error: jest.fn() };
      controller = new RelatorioController(service, {} as any, logger);
    });

    it('GET /:id with no req.user calls findOne (raw), not assertCanAccess', async () => {
      service.findOne.mockResolvedValue({ id: '1' });
      const req: any = {}; // no user
      const result = await controller.findOne('1', req);

      expect(service.assertCanAccess).not.toHaveBeenCalled();
      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual({ id: '1' });
    });

    it('GET /:id with req.user calls assertCanAccess (not raw findOne)', async () => {
      service.assertCanAccess.mockResolvedValue({ id: '1' });
      const user: any = { isAdmin: () => true, isDeveloper: () => false };
      const req: any = { user };

      const result = await controller.findOne('1', req);

      expect(service.assertCanAccess).toHaveBeenCalledWith('1', user);
      expect(service.findOne).not.toHaveBeenCalled();
      expect(result).toEqual({ id: '1' });
    });

    it('PATCH /:id with no req.user skips assertCanAccess and calls update', async () => {
      service.update.mockResolvedValue(undefined);
      const req: any = {}; // no user

      await controller.update('1', {} as any, { foo: 'bar' } as any, req);

      expect(service.assertCanAccess).not.toHaveBeenCalled();
      expect(service.update).toHaveBeenCalledWith({
        foo: 'bar',
        id: '1',
        files: {},
      });
    });

    it('PATCH /:id with req.user asserts before update', async () => {
      service.assertCanAccess.mockResolvedValue({ id: '1' });
      service.update.mockResolvedValue(undefined);
      const user: any = { isAdmin: () => true, isDeveloper: () => false };
      const req: any = { user };

      await controller.update('1', {} as any, { foo: 'bar' } as any, req);

      expect(service.assertCanAccess).toHaveBeenCalledWith('1', user);
      expect(service.update).toHaveBeenCalledWith({
        foo: 'bar',
        id: '1',
        files: {},
      });
    });

    it('DELETE /:id with no req.user skips assertCanAccess and calls remove', async () => {
      service.remove.mockResolvedValue('ok');
      const req: any = {}; // no user

      await controller.remove('1', req);

      expect(service.assertCanAccess).not.toHaveBeenCalled();
      expect(service.remove).toHaveBeenCalledWith('1');
    });

    it('DELETE /:id with req.user asserts before remove', async () => {
      service.assertCanAccess.mockResolvedValue({ id: '1' });
      service.remove.mockResolvedValue('ok');
      const user: any = { isAdmin: () => true, isDeveloper: () => false };
      const req: any = { user };

      await controller.remove('1', req);

      expect(service.assertCanAccess).toHaveBeenCalledWith('1', user);
      expect(service.remove).toHaveBeenCalledWith('1');
    });

    it('DELETE /:id does NOT call remove when assertCanAccess throws', async () => {
      // Throw a real NotFoundException-shape so errorHandler rethrows it
      // instead of mapping to InternalServerError.
      const { NotFoundException } = require('@nestjs/common');
      service.assertCanAccess.mockRejectedValue(
        new NotFoundException('Nenhum relatório encontrado'),
      );
      const user: any = { isAdmin: () => false, isDeveloper: () => false };
      const req: any = { user };

      await expect(controller.remove('1', req)).rejects.toThrow(
        'Nenhum relatório encontrado',
      );
      expect(service.remove).not.toHaveBeenCalled();
    });
  });

  describe('GET /relatorios?produtorId= (mobile-only) strips web-only fields', () => {
    // findByProdutorId is consumed only by the frozen mobile app, which writes
    // the payload into a fixed-schema SQLite table. Web-only fields (e.g.
    // comercializaPnae/produtoTratado/grauInteresse) must never reach it.
    let service: any;
    let logger: any;
    let controller: RelatorioController;

    beforeEach(() => {
      service = { findMany: jest.fn() };
      logger = { error: jest.fn() };
      controller = new RelatorioController(service, {} as any, logger);
    });

    it('drops web-only and backend-derived fields, keeps the mobile-known ones', async () => {
      service.findMany.mockResolvedValue([
        {
          id: '1',
          produtorId: '63536',
          tecnicoId: '10',
          numeroRelatorio: 5,
          assunto: 'a',
          orientacao: 'o',
          readOnly: false,
          createdAt: '2026-06-14T00:00:00.000Z',
          atendimentoId: '99',
          // Web-only columns (written by the web form):
          comercializaPnae: true,
          produtoTratado: 'Alface',
          grauInteresse: 'ALTO',
          // Backend-derived replacement-tracking field with no mobile column:
          atendimentoAnteriorId: '55',
        },
      ]);

      const [result] = await controller.findByProdutorId('63536');

      expect(result).not.toHaveProperty('comercializaPnae');
      expect(result).not.toHaveProperty('produtoTratado');
      expect(result).not.toHaveProperty('grauInteresse');
      expect(result).not.toHaveProperty('atendimentoAnteriorId');
      expect(result).toMatchObject({
        id: '1',
        produtorId: '63536',
        numeroRelatorio: 5,
        assunto: 'a',
        atendimentoId: '99',
      });
    });
  });
});
