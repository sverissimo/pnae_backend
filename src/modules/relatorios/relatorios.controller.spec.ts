jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => <T>(fn: () => Promise<T>) => fn(),
}));
jest.mock('graphql-request', () => ({
  gql: (literals: TemplateStringsArray) => literals[0],
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: jest.fn() })),
}));

import { RelatorioController } from './relatorios.controller';
import { PassThrough } from 'stream';
import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PdfGenerator } from 'src/@pdf-gen/pdf-gen';

describe('RelatorioController', () => {
  describe('GET /dashboard reporting marker', () => {
    it.each([true, undefined])(
      'passes reportingAccess=%s explicitly to the dashboard service',
      async (reportingAccess) => {
        const dashboard = { scope: { role: 'admin' } };
        const service = {
          getDashboardData: jest.fn().mockResolvedValue(dashboard),
        };
        const user: any = { getRole: () => 'staff' };
        const controller = new RelatorioController(
          service as any,
          {} as any,
          { error: jest.fn() } as any,
        );

        const result = await controller.getDashboard({
          user,
          ...(reportingAccess === true ? { reportingAccess } : {}),
        } as any);

        expect(service.getDashboardData).toHaveBeenCalledTimes(1);
        expect(service.getDashboardData).toHaveBeenCalledWith(
          user,
          reportingAccess === true,
        );
        expect(result).toBe(dashboard);
      },
    );

    it('passes an absent user and ignores marker-like query, body, and headers', async () => {
      const service = { getDashboardData: jest.fn().mockResolvedValue({}) };
      const controller = new RelatorioController(
        service as any,
        {} as any,
        { error: jest.fn() } as any,
      );

      await controller.getDashboard({
        query: { reportingAccess: 'true' },
        body: { reportingAccess: true },
        headers: { reportingAccess: 'true' },
      } as any);

      expect(service.getDashboardData).toHaveBeenCalledWith(undefined, false);
    });
  });

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

  describe('GET /manual?id=<base64urlToken>', () => {
    const combinedPdf = Buffer.from('%PDF combined');
    let relatorioExportService: any;
    let logger: any;
    let controller: RelatorioController;

    beforeEach(() => {
      relatorioExportService = {
        createDemeterRelatorioPdf: jest.fn().mockResolvedValue({
          pdf: combinedPdf,
          nomeProdutor: 'João da Silva',
        }),
      };
      logger = { error: jest.fn() };
      controller = new RelatorioController(
        {} as any,
        relatorioExportService,
        logger,
      );
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('decodes the obfuscated token and sends the combined manual PDF', async () => {
      const res = new PassThrough() as any;
      res.setHeader = jest.fn();
      res.send = jest.fn();

      await controller.generateDemeterPdf(createDemeterPdfToken('987'), res);

      expect(
        relatorioExportService.createDemeterRelatorioPdf,
      ).toHaveBeenCalledWith('987');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename=relatorio_manual_João_da_Silva_987.pdf',
      );
      expect(res.send).toHaveBeenCalledWith(combinedPdf);
    });

    it('rejects missing or malformed manual PDF tokens with 400', async () => {
      const res = new PassThrough() as any;
      res.setHeader = jest.fn();
      res.send = jest.fn();

      await expect(
        controller.generateDemeterPdf(undefined, res),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        controller.generateDemeterPdf('not-valid*', res),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        controller.generateDemeterPdf(base64Url('12345abc'), res),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(
        relatorioExportService.createDemeterRelatorioPdf,
      ).not.toHaveBeenCalled();
    });
  });

  describe('GET /pdf/:id', () => {
    it('preserves a friendly HttpException from PDF input validation', async () => {
      const error = new UnprocessableEntityException(
        'O produtor não possui perfil de entrada para o contrato do relatório.',
      );
      const relatorioExportService = {
        createPDFInput: jest.fn().mockRejectedValue(error),
      };
      const logger = { error: jest.fn() };
      const controller = new RelatorioController(
        {} as any,
        relatorioExportService as any,
        logger as any,
      );
      const res = new PassThrough() as any;
      res.setHeader = jest.fn();

      await expect(controller.generatePdf('rel-1', res)).rejects.toBe(error);

      expect(logger.error).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('does not expose an unexpected PDF error message', async () => {
      const relatorioExportService = {
        createPDFInput: jest
          .fn()
          .mockRejectedValue(
            new Error("Cannot read properties of undefined (reading 'reduce')"),
          ),
      };
      const logger = { error: jest.fn() };
      const controller = new RelatorioController(
        {} as any,
        relatorioExportService as any,
        logger as any,
      );
      const res = new PassThrough() as any;
      res.setHeader = jest.fn();

      await expect(controller.generatePdf('rel-1', res)).rejects.toEqual(
        expect.objectContaining({
          status: 500,
          message:
            'Não foi possível gerar o PDF devido a um erro interno. Tente novamente mais tarde.',
        }),
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cannot read properties of undefined'),
        expect.any(String),
      );
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('does not set PDF headers when rendering itself fails', async () => {
      const relatorioExportService = {
        createPDFInput: jest.fn().mockResolvedValue({
          relatorio: {
            numeroRelatorio: 3,
            produtor: { nomeProdutor: 'Produtor' },
          },
          perfilPDFModel: {},
          nome_propriedade: 'Sítio',
        }),
      };
      const logger = { error: jest.fn() };
      const controller = new RelatorioController(
        {} as any,
        relatorioExportService as any,
        logger as any,
      );
      const res = new PassThrough() as any;
      res.setHeader = jest.fn();
      const generatePdf = jest
        .spyOn(PdfGenerator, 'generatePdf')
        .mockRejectedValue(new Error('wkhtmltopdf failed'));

      await expect(controller.generatePdf('rel-1', res)).rejects.toEqual(
        expect.objectContaining({
          status: 500,
          message:
            'Não foi possível gerar o PDF devido a um erro interno. Tente novamente mais tarde.',
        }),
      );

      expect(res.setHeader).not.toHaveBeenCalled();
      generatePdf.mockRestore();
    });
  });

  describe('POST /zip/create-job (atendimentoIds body)', () => {
    let exportService: any;
    let logger: any;
    let controller: RelatorioController;
    const originalAllowedUserIds = process.env.ALLOWED_USER_IDS;

    beforeEach(() => {
      process.env.ALLOWED_USER_IDS = '10, 20';
      exportService = {
        createZipJob: jest
          .fn()
          .mockResolvedValue({ jobId: '9', status: 'waiting' }),
      };
      logger = { error: jest.fn() };
      controller = new RelatorioController({} as any, exportService, logger);
    });

    afterAll(() => {
      if (originalAllowedUserIds === undefined) {
        delete process.env.ALLOWED_USER_IDS;
      } else {
        process.env.ALLOWED_USER_IDS = originalAllowedUserIds;
      }
    });

    it('rejects missing, empty, and non-numeric atendimentoIds with 400', async () => {
      await expect(
        controller.createZipJob({ userId: '10' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        controller.createZipJob({ userId: '10', atendimentoIds: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        controller.createZipJob({
          userId: '10',
          atendimentoIds: ['123', '45a'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(exportService.createZipJob).not.toHaveBeenCalled();
    });

    it('rejects more than 4000 unique ids with 400', async () => {
      const ids = Array.from({ length: 4001 }, (_, i) => String(i + 1));

      await expect(
        controller.createZipJob({ userId: '10', atendimentoIds: ids }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(exportService.createZipJob).not.toHaveBeenCalled();
    });

    it('accepts exactly 4000 unique ids', async () => {
      const ids = Array.from({ length: 4000 }, (_, i) => String(i + 1));

      await controller.createZipJob({ userId: '10', atendimentoIds: ids });

      expect(exportService.createZipJob).toHaveBeenCalledWith({
        userId: '10',
        atendimentoIds: ids,
      });
    });

    it('dedupes ids preserving paste order and normalizes numbers to strings', async () => {
      const result = await controller.createZipJob({
        userId: '10',
        atendimentoIds: ['5', 3, '5', ' 3 ', '7'] as any,
      });

      expect(exportService.createZipJob).toHaveBeenCalledWith({
        userId: '10',
        atendimentoIds: ['5', '3', '7'],
      });
      expect(result).toEqual({ jobId: '9', status: 'waiting' });
    });

    it('rejects a userId outside ALLOWED_USER_IDS with 403 before validating ids', async () => {
      const { ForbiddenException } = require('@nestjs/common');

      await expect(
        controller.createZipJob({ userId: '99', atendimentoIds: ['1'] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(exportService.createZipJob).not.toHaveBeenCalled();
    });

    it('rejects a missing userId with 400', async () => {
      await expect(
        controller.createZipJob({ atendimentoIds: ['1'] } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(exportService.createZipJob).not.toHaveBeenCalled();
    });
  });

  describe('GET /zip/atendimentos-incluidos', () => {
    it('returns the included atendimento ids keyed by ZIP filename', async () => {
      const incluidos = {
        'relatorios_atendimentos_2026-07-03_153000.zip': ['100', '200'],
      };
      const exportService = {
        getAtendimentosIncluidos: jest.fn().mockResolvedValue(incluidos),
      };
      const controller = new RelatorioController(
        {} as any,
        exportService as any,
        { error: jest.fn() } as any,
      );

      await expect(controller.getAtendimentosIncluidos()).resolves.toEqual(
        incluidos,
      );
    });

    it('translates service failures to 500', async () => {
      const { InternalServerErrorException } = require('@nestjs/common');
      const exportService = {
        getAtendimentosIncluidos: jest
          .fn()
          .mockRejectedValue(new Error('redis offline')),
      };
      const controller = new RelatorioController(
        {} as any,
        exportService as any,
        { error: jest.fn() } as any,
      );

      await expect(controller.getAtendimentosIncluidos()).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('GET /zip/atendimentos-nao-incluidos', () => {
    it('returns the não-incluídos atendimento ids keyed by ZIP filename', async () => {
      const naoIncluidos = {
        'relatorios_atendimentos_2026-07-03_153000.zip': ['300', '400'],
      };
      const exportService = {
        getAtendimentosNaoIncluidos: jest.fn().mockResolvedValue(naoIncluidos),
      };
      const controller = new RelatorioController(
        {} as any,
        exportService as any,
        { error: jest.fn() } as any,
      );

      await expect(controller.getAtendimentosNaoIncluidos()).resolves.toEqual(
        naoIncluidos,
      );
    });

    it('translates service failures to 500', async () => {
      const { InternalServerErrorException } = require('@nestjs/common');
      const exportService = {
        getAtendimentosNaoIncluidos: jest
          .fn()
          .mockRejectedValue(new Error('redis offline')),
      };
      const controller = new RelatorioController(
        {} as any,
        exportService as any,
        { error: jest.fn() } as any,
      );

      await expect(
        controller.getAtendimentosNaoIncluidos(),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});

function createDemeterPdfToken(atendimentoId: string): string {
  return base64Url(`12345${atendimentoId}`);
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
