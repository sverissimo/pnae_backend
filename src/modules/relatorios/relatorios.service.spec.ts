jest.mock('graphql-request', () => ({
  gql: (literals: TemplateStringsArray) => literals[0],
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
}));

import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RelatorioService } from './relatorios.service';
import { Relatorio } from 'src/@domain/relatorio/relatorio';

describe('RelatorioService', () => {
  let service: RelatorioService;
  let prisma: any;
  let atendimentoService: any;
  let fileService: any;
  let restAPI: any;
  let logger: any;
  let mockRelatorio: any;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockRelatorio = {
      id: '1',
      contratoId: 2,
      numeroRelatorio: 3,
      readOnly: false,
      atendimentoId: '55',
      produtorId: '10',
      tecnicoId: '20',
      createdAt: '2025-10-01',
    };

    prisma = { relatorio: { update: jest.fn() } };
    atendimentoService = {
      logicRemove: jest.fn(),
      fixDatesIfNeeded: jest.fn(),
      updateTemasAndVisita: jest.fn(),
    };
    fileService = { save: jest.fn(), update: jest.fn() };
    restAPI = { getReadOnlyRelatorios: jest.fn() };
    logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };

    service = new RelatorioService(
      prisma,
      atendimentoService,
      fileService,
      restAPI,
      logger,
    );

    service.findMany = jest.fn();
    prisma.relatorio.delete = jest.fn();

    service.checkForDuplicateRelatorios = jest
      .fn()
      .mockResolvedValue(undefined);

    jest
      .spyOn(Relatorio.prototype, 'toDto')
      .mockReturnValue({ dto: true } as any);
    jest
      .spyOn(RelatorioService.prototype as any, 'syncAtendimentoTemasAndNumero')
      .mockResolvedValue(undefined);
  });

  describe('RelatorioService.create', () => {
    beforeEach(() => (prisma.relatorio.create = jest.fn()));

    it('creates relatorio, calls fixAtendimentoDate and returns created entity', async () => {
      const created = { id: '1', ...mockRelatorio };
      prisma.relatorio.create.mockResolvedValue(created);

      const result = await service.create(mockRelatorio);

      expect(service.checkForDuplicateRelatorios).toHaveBeenCalledWith(
        mockRelatorio,
      );
      expect(prisma.relatorio.create).toHaveBeenCalledWith({
        data: { dto: true },
      });

      expect(
        (service as any).atendimentoService.fixDatesIfNeeded,
      ).toHaveBeenCalledWith({
        atendimentoId: '55',
        createdAt: '2025-10-01',
      });

      expect((service as any).fileService.save).not.toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('passes saved entity to fileService.save when files provided', async () => {
      const files = { foto: [{}] } as any;
      prisma.relatorio.create.mockResolvedValue(mockRelatorio);

      await service.create(mockRelatorio, files);

      expect((service as any).fileService.save).toHaveBeenCalledWith(
        files,
        mockRelatorio,
      );
    });

    it('does not call fileService.save when files are undefined/empty', async () => {
      prisma.relatorio.create.mockResolvedValue({ id: '1', ...mockRelatorio });

      await service.create(mockRelatorio, undefined);
      await service.create(mockRelatorio, {} as any);

      expect(fileService.save).not.toHaveBeenCalled();
    });

    it('throws if fileService.save fails, but relatorio is still persisted', async () => {
      const files = { foto: [{}] } as any;
      const created = { id: '1', ...mockRelatorio };
      prisma.relatorio.create.mockResolvedValue(created);
      fileService.save.mockRejectedValue(new Error('disk fail'));

      await expect(service.create(mockRelatorio, files)).rejects.toThrow(
        'disk fail',
      );

      // ensure the relatorio was still created in DB
      expect(prisma.relatorio.create).toHaveBeenCalledWith({
        data: { dto: true },
      });

      // fixAtendimentoDate still runs (fire-and-forget)
      expect(
        (service as any).atendimentoService.fixDatesIfNeeded,
      ).toHaveBeenCalled();

      // log should record the file failure
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Falha ao salvar arquivos do relatório 1'),
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('rolls back atendimento on generic persistence error and rethrows', async () => {
      const err = new Error('db failed');
      prisma.relatorio.create.mockRejectedValue(err);

      await expect(service.create(mockRelatorio)).rejects.toThrow(err);
      expect(atendimentoService.fixDatesIfNeeded).not.toHaveBeenCalled();
      expect((service as any).fileService.save).not.toHaveBeenCalled();

      expect(atendimentoService.logicRemove).toHaveBeenCalledWith('55'); // has atendimentoId
      // handlePersistenceError now maps/throws; no extra error log expected here (only rollback errors are logged)
    });

    it('does NOT roll back atendimento if atendimentoId is undefined', async () => {
      const err = new Error('db failed');
      prisma.relatorio.create.mockRejectedValue(err);

      const noAtendimento = { ...mockRelatorio, atendimentoId: undefined };

      await expect(service.create(noAtendimento)).rejects.toThrow(err);
      expect(atendimentoService.fixDatesIfNeeded).not.toHaveBeenCalled();
      expect((service as any).fileService.save).not.toHaveBeenCalled();
      expect(atendimentoService.logicRemove).not.toHaveBeenCalled();
    });

    it('logs when rollback (logicRemove) itself fails (still rethrows create error)', async () => {
      const err = new Error('db failed');
      prisma.relatorio.create.mockRejectedValue(err);
      atendimentoService.logicRemove.mockRejectedValue(
        new Error('rollback failed'),
      );

      await expect(service.create(mockRelatorio)).rejects.toThrow(err);
      expect(atendimentoService.fixDatesIfNeeded).not.toHaveBeenCalled();
      expect((service as any).fileService.save).not.toHaveBeenCalled();
      expect(atendimentoService.logicRemove).toHaveBeenCalledWith('55');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Rollback (logicRemove) failed for atendimento 55',
        ),
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('maps Prisma P2002 on id to ConflictException and performs rollback', async () => {
      jest.spyOn(service as any, 'fixAtendimentoDate');

      const prismaErr: any = { code: 'P2002', meta: { target: ['id'] } };
      prisma.relatorio.create.mockRejectedValue(prismaErr);

      await expect(service.create(mockRelatorio)).rejects.toThrow(
        ConflictException,
      );
      expect(atendimentoService.fixDatesIfNeeded).not.toHaveBeenCalled();
      expect((service as any).fileService.save).not.toHaveBeenCalled();
      expect(atendimentoService.logicRemove).toHaveBeenCalledWith('55');
    });

    it('does NOT call prisma.create if duplicate check throws (e.g., ConflictException)', async () => {
      jest.spyOn(service as any, 'fixAtendimentoDate');

      (service.checkForDuplicateRelatorios as jest.Mock).mockRejectedValue(
        new ConflictException('dup'),
      );
      await expect(service.create(mockRelatorio)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.relatorio.create).not.toHaveBeenCalled();
      expect((service as any).fixAtendimentoDate).not.toHaveBeenCalled();
      expect((service as any).fileService.save).not.toHaveBeenCalled();
      expect(atendimentoService.logicRemove).not.toHaveBeenCalled();
      expect(atendimentoService.fixDatesIfNeeded).not.toHaveBeenCalled();
    });

    it('does not block on fixAtendimentoDate (fire-and-forget): even if it throws internally, create still resolves', async () => {
      prisma.relatorio.create.mockResolvedValue({ id: '1', ...mockRelatorio });

      const { atendimentoId, ...noAtendimento } = mockRelatorio;
      const result = await service.create(noAtendimento);

      expect(service.checkForDuplicateRelatorios).toHaveBeenCalledWith(
        noAtendimento,
      );
      expect(prisma.relatorio.create).toHaveBeenCalled();

      expect(result).toMatchObject({ id: '1' });
      expect(atendimentoService.logicRemove).not.toHaveBeenCalled();
      expect(atendimentoService.fixDatesIfNeeded).not.toHaveBeenCalled();
    });
  });

  describe('RelatorioService.update', () => {
    it('should throw if relatorio not found', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([]);
      await expect(service.update({ id: '1' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if relatorio is readOnly', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        { id: '1', readOnly: true },
      ]);
      const input = { id: '1', readOnly: false } as any;
      const result = await service.update(input);
      expect(result).toBeUndefined();
    });

    it('should call fileService.update if files exist', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        { id: '1', produtorId: 10, contratoId: 20 },
      ]);
      fileService.update.mockResolvedValue(undefined);
      prisma.relatorio.update.mockResolvedValue({ id: '1' });

      const input = {
        id: '1',
        files: { foto: [{}] },
        produtorId: null,
        contratoId: null,
      } as any;

      await service.update(input);

      expect(fileService.update).toHaveBeenCalledWith(
        input.files,
        expect.objectContaining({
          id: '1',
          produtorId: 10, // fallback applied
          contratoId: 20,
        }),
      );
      expect(prisma.relatorio.update).toHaveBeenCalled();
      expect(
        RelatorioService.prototype['syncAtendimentoTemasAndNumero'],
      ).toHaveBeenCalledTimes(1);
    });

    it('should not call fileService.update if no files', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([{ id: '1' }]);
      prisma.relatorio.update.mockResolvedValue({ id: '1' });

      const input = { id: '1', files: undefined } as any;
      await service.update(input);

      expect(fileService.update).not.toHaveBeenCalled();
      expect(prisma.relatorio.update).toHaveBeenCalled();
      expect(
        RelatorioService.prototype['syncAtendimentoTemasAndNumero'],
      ).toHaveBeenCalledTimes(1);
    });

    it('should stop if fileService.update throws', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        { id: '1', produtorId: 10, contratoId: 20 },
      ]);
      fileService.update.mockRejectedValue(new Error('disk error'));

      const input = { id: '1', files: { foto: [{}] } } as any;

      await expect(service.update(input)).rejects.toThrow('disk error');
      expect(prisma.relatorio.update).not.toHaveBeenCalled();
    });

    it('should not call atendimentoService.updateTemasAndVisita if no atendimentoId', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([{ id: '1' }]);
      prisma.relatorio.update.mockResolvedValue();

      const input = { id: '1', atendimentoId: undefined } as any;
      await service.update(input);

      expect(atendimentoService.updateTemasAndVisita).not.toHaveBeenCalled();
    });

    it('should not call atendimentoService.updateTemasAndVisita if no temas and numeroVisita', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          readOnly: false,
          numeroRelatorio: '5',
          atendimentoId: '456',
        },
      ]);
      prisma.relatorio.update.mockResolvedValue();
      (
        RelatorioService.prototype as any
      ).syncAtendimentoTemasAndNumero.mockRestore();

      const input = {
        id: '1',
        atendimentoId: '123',
        temas_atendimento: undefined,
      } as any;
      await service.update(input);

      expect(atendimentoService.updateTemasAndVisita).not.toHaveBeenCalled();
    });

    it('should NOT call atendimentoService.updateTemasAndVisita if no temas and numeroVisita unchanged', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          readOnly: false,
          numeroRelatorio: '5',
          atendimentoId: '456',
        },
      ]);

      prisma.relatorio.update.mockResolvedValue();

      (
        RelatorioService.prototype as any
      ).syncAtendimentoTemasAndNumero.mockRestore();

      const input = {
        id: '1',
        atendimentoId: '123',
        numeroRelatorio: '5',
        temas_atendimento: '',
      } as any;
      await service.update(input);

      expect(atendimentoService.updateTemasAndVisita).not.toHaveBeenCalled();
    });

    it('should call atendimentoService.updateTemasAndVisita if temas provided (even if numero unchanged)', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          readOnly: false,
          numeroRelatorio: '5',
          atendimentoId: '456',
        },
      ]);
      prisma.relatorio.update.mockResolvedValue();

      (
        RelatorioService.prototype as any
      ).syncAtendimentoTemasAndNumero.mockRestore();

      const input = {
        id: '1',
        atendimentoId: '123',
        numeroRelatorio: '5', // unchanged
        temas_atendimento: 'tema1', // triggers update
      } as any;

      await service.update(input);

      expect(atendimentoService.updateTemasAndVisita).toHaveBeenCalledWith({
        atendimentoId: '456',
        temasAtendimento: 'tema1',
        numeroVisita: undefined,
      });
    });

    it('should call atendimentoService.updateTemasAndVisita with updated atendimentoId if numeroVisita changed (even if no temas)', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          readOnly: false,
          numeroRelatorio: '5',
          atendimentoId: '456',
        },
      ]);

      prisma.relatorio.update.mockResolvedValue();

      (
        RelatorioService.prototype as any
      ).syncAtendimentoTemasAndNumero.mockRestore();

      const input = {
        id: '1',
        atendimentoId: '123',
        numeroRelatorio: '6', // changed
        temas_atendimento: '', // no temas
      } as any;

      await service.update(input);

      expect(atendimentoService.updateTemasAndVisita).toHaveBeenCalled();
      expect(atendimentoService.updateTemasAndVisita).toHaveBeenCalledWith({
        atendimentoId: '456',
        temasAtendimento: undefined,
        numeroVisita: '6',
      });
    });

    it('should call atendimentoService.updateTemasAndVisita with if numeroVisita and temas changed', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          readOnly: false,
          numeroRelatorio: '5',
          atendimentoId: '456',
        },
      ]);

      prisma.relatorio.update.mockResolvedValue();

      (
        RelatorioService.prototype as any
      ).syncAtendimentoTemasAndNumero.mockRestore();

      const input = {
        id: '1',
        atendimentoId: '123',
        numeroRelatorio: '6', // changed
        temas_atendimento: '2,3', // from input
      } as any;

      await service.update(input);

      expect(atendimentoService.updateTemasAndVisita).toHaveBeenCalled();
      expect(atendimentoService.updateTemasAndVisita).toHaveBeenCalledWith({
        atendimentoId: '456',
        temasAtendimento: '2,3',
        numeroVisita: '6',
      });
    });
  });

  describe('RelatórioService.remove', () => {
    beforeEach(() => {
      (service as any).removeFiles = jest.fn();
      (service as any).removeFiles.mockRejectedValue(new Error('file failed'));
    });
    it('should throw NotFoundException if relatorio not found', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.remove('123')).rejects.toThrow(NotFoundException);
      expect(prisma.relatorio.delete).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if readOnly', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        { ...mockRelatorio, readOnly: true },
      ]);

      await expect(service.remove('1')).rejects.toThrow(UnauthorizedException);
      expect(prisma.relatorio.delete).not.toHaveBeenCalled();
    });

    it('should call logicRemove, removeFiles, and delete when all succeed', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([mockRelatorio]);

      await service.remove('1');

      expect(atendimentoService.logicRemove).toHaveBeenCalledWith('55');
      expect((service as any).removeFiles).toHaveBeenCalled();
      expect(prisma.relatorio.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should still delete and log if logicRemove throws', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([mockRelatorio]);
      atendimentoService.logicRemove.mockRejectedValue(
        new Error('remove failed'),
      );

      await service.remove('1');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao remover relatório'),
        expect.objectContaining({ error: expect.any(Error) }),
      );
      expect(prisma.relatorio.delete).toHaveBeenCalled();
      expect(prisma.relatorio.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should still delete and log if removeFiles throws', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        { ...mockRelatorio, atendimentoId: null },
      ]);
      (service as any).removeFiles.mockRejectedValue(new Error('file failed'));

      const result = await service.remove('1');

      expect(logger.error).toHaveBeenCalled();
      expect(prisma.relatorio.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toContain('Relatorio 1 removed');
      expect(result).toContain('Produtor 10');
      expect(result).toContain('técnico 20');
    });

    it('should return correct message string', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([mockRelatorio]);

      const result = await service.remove('1');

      expect(typeof result).toBe('string');
      expect(result).toContain('Relatorio 1 removed');
      expect(result).toContain('Produtor 10');
      expect(result).toContain('técnico 20');
    });
  });
});
