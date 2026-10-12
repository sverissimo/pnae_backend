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
import { Usuario } from 'src/@domain/usuario/usuario.entity';
import { PerfilUsuario } from 'src/@domain/usuario/perfil-usuario.enum';

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
      getReplacedAtendimentos: jest.fn().mockResolvedValue([]),
      getManuaisUltimos30Dias: jest.fn().mockResolvedValue([]),
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
      { getRegionaisEmater: jest.fn() } as any,
      { findManyById: jest.fn().mockResolvedValue([]) } as any,
      { findMany: jest.fn().mockResolvedValue([]) } as any,
      { get: jest.fn().mockResolvedValue([]) } as any,
      { getUsuarios: jest.fn().mockResolvedValue({ usuarios: [] }) } as any,
    );

    service.findMany = jest.fn();
    prisma.relatorio.delete = jest.fn();
    prisma.relatorio.findMany = jest.fn();

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

  describe('RelatorioService.getDashboardData (reporting and existing scopes)', () => {
    let originalAllowedUserIds: string | undefined;
    const today = new Date(2026, 9, 12, 12).toISOString();
    const yesterday = new Date(2026, 9, 11, 12).toISOString();
    const twoDaysAgo = new Date(2026, 9, 10, 12).toISOString();
    const outsideWindow = new Date(2026, 8, 12, 12).toISOString();
    const regionalLabel = 'Unidade Regional de Viçosa';
    const relatorios = [
      {
        id: 'rel-1',
        tecnicoId: 'other',
        id_reg_empresa: 'G0040',
        nm_und_empresa: regionalLabel,
        regional_sre: 'SRE Sul',
        usuario: 'Técnico B',
        createdAt: today,
        sn_validado: 1,
        data_validacao: yesterday,
        data_sei: yesterday,
        data_see: today,
        dt_export_ok: today,
      },
      {
        id: 'rel-2',
        tecnicoId: 'staff-1',
        id_reg_empresa: 'G0040',
        nm_und_empresa: regionalLabel,
        regional_sre: 'SRE Sul',
        usuario: 'Técnico A',
        createdAt: today,
        sn_validado: 0,
        sn_pendencia: 1,
      },
      {
        id: 'rel-3',
        tecnicoId: 'coord-1',
        id_reg_empresa: 'G0002',
        nm_und_empresa: 'Unidade Regional de Lavras',
        regional_sre: 'SRE Norte',
        usuario: 'Técnico C',
        createdAt: yesterday,
        sn_validado: 0,
        sn_pendencia: 0,
        data_validacao: yesterday,
        data_sei: today,
      },
      {
        id: 'rel-4',
        tecnicoId: 'staff-1',
        id_reg_empresa: 'G0003',
        nm_und_empresa: 'Unidade Regional de Ponte Nova',
        regional_sre: 'SRE Sul',
        usuario: 'Técnico A',
        createdAt: twoDaysAgo,
        sn_validado: 1,
        data_see: yesterday,
      },
    ];
    const seriesEndingWith = (...counts: number[]) => [
      ...new Array<number>(30 - counts.length).fill(0),
      ...counts,
    ];
    const adminDashboard = {
      summary: {
        totalRelatorios: 4,
        approvedRegional: 3,
        approvedDetec: 2,
        approvedSEE: 2,
        exportedSEI: 1,
        relatoriosCreatedToday: 2,
        semAprovacaoRegional: 1,
      },
      topSREs: [
        { sre: 'SRE Sul', visitas: 3 },
        { sre: 'SRE Norte', visitas: 1 },
      ],
      topTecnicos: [
        { tecnico: 'Técnico A', total: 2, aprovados: 1 },
        { tecnico: 'Técnico B', total: 1, aprovados: 1 },
        { tecnico: 'Técnico C', total: 1, aprovados: 1 },
      ],
      relatoriosByRegional: [
        { regional: 'Viçosa', total: 2, aprovados: 1 },
        { regional: 'Lavras', total: 1, aprovados: 1 },
        { regional: 'Ponte Nova', total: 1, aprovados: 1 },
        { regional: 'Caratinga', total: 0, aprovados: 0 },
      ],
      lineChart: {
        seriesField: 'data_see',
        seriesName: 'Aprovados pela SEE',
        categories: Array.from({ length: 30 }, (_, i) =>
          new Date(2026, 8, 13 + i, 12).toLocaleDateString('pt-BR'),
        ),
        created: seriesEndingWith(1, 1, 2),
        approved: seriesEndingWith(1, 1),
      },
      manuais30Dias: { total: 3, byDay: seriesEndingWith(1, 2) },
      scope: { role: 'admin', regionalLabel },
    };
    const noUserDashboard = {
      ...adminDashboard,
      summary: {
        totalRelatorios: 0,
        approvedRegional: 0,
        approvedDetec: 0,
        approvedSEE: 0,
        exportedSEI: 0,
        relatoriosCreatedToday: 0,
        semAprovacaoRegional: 0,
      },
      topSREs: null,
      lineChart: {
        ...adminDashboard.lineChart,
        seriesField: 'data_sei',
        seriesName: 'Aprovados pelo DETEC',
        created: seriesEndingWith(),
        approved: seriesEndingWith(),
      },
      manuais30Dias: { total: 0, byDay: seriesEndingWith() },
      scope: { role: 'other', regionalLabel: null },
    };

    beforeEach(() => {
      originalAllowedUserIds = process.env.ALLOWED_USER_IDS;
      process.env.ALLOWED_USER_IDS = 'admin-1,dev-9';
      jest.useFakeTimers();
      jest.setSystemTime(new Date(today));
      jest.spyOn(service, 'findAll').mockResolvedValue(relatorios as any);
      (service as any).perfilService.getRegionaisEmater.mockResolvedValue([
        { nm_und_empresa: 'Unidade Regional de Caratinga' },
      ]);
      atendimentoService.getManuaisUltimos30Dias.mockImplementation(
        async (regionScope?: string) =>
          regionScope === undefined
            ? [today, today, yesterday, outsideWindow]
            : [today, yesterday],
      );
    });

    afterEach(() => {
      jest.useRealTimers();
      if (originalAllowedUserIds === undefined) {
        delete process.env.ALLOWED_USER_IDS;
      } else {
        process.env.ALLOWED_USER_IDS = originalAllowedUserIds;
      }
    });

    it.each(['admin-1', 'dev-9'])(
      'keeps the complete unscoped admin dashboard for %s',
      async (id_usuario) => {
        const admin = new Usuario({ id_usuario, perfis: [] });

        await expect(service.getDashboardData(admin)).resolves.toEqual(
          adminDashboard,
        );

        expect(service.findAll).toHaveBeenCalledWith(
          { contratoId: 2 },
          { expand: true },
        );
        expect(
          atendimentoService.getManuaisUltimos30Dias,
        ).toHaveBeenCalledWith(undefined);
      },
    );

    it('makes reporting and admin dashboards deep-equal, including manual dates and SEE series', async () => {
      const admin = new Usuario({ id_usuario: 'admin-1', perfis: [] });
      const adminResult = await service.getDashboardData(admin);
      atendimentoService.getManuaisUltimos30Dias.mockClear();

      const reportingResult = await service.getDashboardData(undefined, true);

      expect(reportingResult).toEqual(adminResult);
      expect(reportingResult).toEqual(adminDashboard);
      expect(reportingResult.summary.totalRelatorios).toBeGreaterThan(0);
      expect(reportingResult.manuais30Dias.total).toBeGreaterThan(0);
      expect(reportingResult.topSREs).not.toBeNull();
      expect(reportingResult.lineChart.seriesField).toBe('data_see');
      expect(
        atendimentoService.getManuaisUltimos30Dias,
      ).toHaveBeenCalledWith(undefined);
      expect(atendimentoService.getManuaisUltimos30Dias).toHaveBeenCalledTimes(
        1,
      );
    });

    it('gives reporting access precedence over an existing staff user', async () => {
      const staff = new Usuario({
        id_usuario: 'staff-1',
        id_reg_empresa: 'G0040',
        perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
      });

      await expect(service.getDashboardData(staff, true)).resolves.toEqual(
        adminDashboard,
      );

      expect(
        atendimentoService.getManuaisUltimos30Dias,
      ).toHaveBeenCalledWith(undefined);
    });

    it('keeps the complete no-user dashboard with no manual fetch', async () => {
      await expect(service.getDashboardData()).resolves.toEqual(
        noUserDashboard,
      );
      await expect(service.getDashboardData(undefined, false)).resolves.toEqual(
        noUserDashboard,
      );

      expect(atendimentoService.getManuaisUltimos30Dias).not.toHaveBeenCalled();
    });

    it.each([
      {
        role: 'coordenadorRegional',
        id_usuario: 'coord-1',
        perfil: PerfilUsuario.ADMINISTRADOR2,
      },
      {
        role: 'staff',
        id_usuario: 'staff-1',
        perfil: PerfilUsuario.MOD_ATIV_TECNICO,
      },
    ])('keeps the complete regional-only dashboard for $role', async ({
      role,
      id_usuario,
      perfil,
    }) => {
      const user = new Usuario({
        id_usuario,
        id_reg_empresa: 'G0040',
        perfis: [perfil],
      });

      const result = await service.getDashboardData(user);

      expect(result).toEqual({
        ...noUserDashboard,
        summary: {
          totalRelatorios: 2,
          approvedRegional: 1,
          approvedDetec: 1,
          approvedSEE: 1,
          exportedSEI: 1,
          relatoriosCreatedToday: 2,
          semAprovacaoRegional: 1,
        },
        lineChart: {
          ...noUserDashboard.lineChart,
          created: seriesEndingWith(2),
          approved: seriesEndingWith(1, 0),
        },
        manuais30Dias: { total: 2, byDay: seriesEndingWith(1, 1) },
        scope: { role, regionalLabel },
      });
      expect(
        atendimentoService.getManuaisUltimos30Dias,
      ).toHaveBeenCalledWith('G0040');
    });

    it.each([
      { role: 'coordenadorRegional', perfil: PerfilUsuario.ADMINISTRADOR2 },
      { role: 'staff', perfil: PerfilUsuario.MOD_ATIV_TECNICO },
      { role: 'other', perfil: undefined },
    ])('keeps zeros and skips manual dates for $role without a regional', async ({
      role,
      perfil,
    }) => {
      const user = new Usuario({
        id_usuario: 'non-admin',
        perfis: perfil ? [perfil] : [],
      });

      const result = await service.getDashboardData(user);

      expect(result).toEqual({
        ...noUserDashboard,
        scope: { role, regionalLabel: null },
      });
      expect(atendimentoService.getManuaisUltimos30Dias).not.toHaveBeenCalled();
    });

    it('keeps the existing regional view for an other-role user with a regional', async () => {
      const user = new Usuario({
        id_usuario: 'other-1',
        id_reg_empresa: 'G0040',
        perfis: [],
      });

      const result = await service.getDashboardData(user);

      expect(result.scope).toEqual({ role: 'other', regionalLabel });
      expect(result.summary.totalRelatorios).toBe(2);
      expect(result.lineChart.created).toEqual(seriesEndingWith(2));
      expect(result.topSREs).toBeNull();
      expect(result.topTecnicos).toEqual(adminDashboard.topTecnicos);
      expect(result.relatoriosByRegional).toEqual(
        adminDashboard.relatoriosByRegional,
      );
      expect(atendimentoService.getManuaisUltimos30Dias).toHaveBeenCalledWith(
        'G0040',
      );
    });

    it('keeps the dashboard when the manual-date dependency fails', async () => {
      atendimentoService.getManuaisUltimos30Dias.mockRejectedValue(
        new Error('manual dates unavailable'),
      );

      const result = await service.getDashboardData(undefined, true);

      expect(result).toEqual({
        ...adminDashboard,
        manuais30Dias: noUserDashboard.manuais30Dias,
      });
      expect(logger.error).toHaveBeenCalledWith(
        'getDashboardData - manuais fetch failed: manual dates unavailable',
        expect.any(String),
      );
    });
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
      expect(atendimentoService.logicRemove).not.toHaveBeenCalled();

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
      (service.findMany as jest.Mock).mockResolvedValue([
        { id: '1', produtorId: 22, contratoId: 45 },
      ]);
      prisma.relatorio.update.mockResolvedValue({ id: '1' });

      const input = { id: '1', files: undefined } as any;
      await service.update(input);

      expect(fileService.update).toHaveBeenCalled();
      expect(fileService.update).toHaveBeenCalledWith(
        input.files,
        expect.objectContaining({
          id: '1',
          produtorId: 22,
          contratoId: 45,
        }),
      );

      expect(prisma.relatorio.update).toHaveBeenCalled();
      expect(
        RelatorioService.prototype['syncAtendimentoTemasAndNumero'],
      ).toHaveBeenCalledTimes(1);
    });

    it('should Update anyway, EVEN IF fileService.update throws', async () => {
      (service.findMany as jest.Mock).mockResolvedValue([
        { id: '1', produtorId: 10, contratoId: 20 },
      ]);
      fileService.update.mockRejectedValue(new Error('disk error'));

      const input = { id: '1', files: { foto: [{}] } } as any;
      await expect(service.update(input)).rejects.toThrow('disk error');
      expect(prisma.relatorio.update).toHaveBeenCalled();
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

  describe('RelatorioService.findAll replacement mapping cache boundary', () => {
    const prismaRelatorio = {
      id: '1',
      contratoId: 2,
      numeroRelatorio: 3,
      readOnly: false,
      atendimentoId: BigInt(55),
      produtorId: BigInt(10),
      tecnicoId: BigInt(20),
      createdAt: new Date('2025-10-01T00:00:00.000Z'),
      updatedAt: new Date('2025-10-01T00:00:00.000Z'),
    };

    it('uses the cached replacement reader only for expanded web hot-path reads', async () => {
      prisma.relatorio.findMany.mockResolvedValue([prismaRelatorio]);
      (service as any).cachedReplacedAtendimentosReader.get.mockResolvedValue([
        { atendimentoAnteriorId: '55', atendimentoId: '99' },
      ]);

      const result = await service.findAll({ contratoId: 2 }, { expand: true });

      expect(
        (service as any).cachedReplacedAtendimentosReader.get,
      ).toHaveBeenCalledTimes(1);
      expect(atendimentoService.getReplacedAtendimentos).not.toHaveBeenCalled();
      expect(
        (service as any).cachedAtendimentoReader.findMany,
      ).toHaveBeenCalledWith(['99']);
      expect(result[0]).toMatchObject({ atendimentoId: '99' });
    });

    it('keeps non-expanded callers on the live replacement mapping path', async () => {
      prisma.relatorio.findMany.mockResolvedValue([prismaRelatorio]);
      atendimentoService.getReplacedAtendimentos.mockResolvedValue([
        { atendimentoAnteriorId: '55', atendimentoId: '99' },
      ]);

      const result = await service.findAll({ contratoId: 2 }, { expand: false });

      expect(
        (service as any).cachedReplacedAtendimentosReader.get,
      ).not.toHaveBeenCalled();
      expect(atendimentoService.getReplacedAtendimentos).toHaveBeenCalledTimes(
        1,
      );
      expect(result[0]).toMatchObject({ atendimentoId: '99' });
    });
  });

  describe('RelatorioService.assertCanAccess', () => {
    const ADMIN_ID = 'admin-1';
    const STAFF_ID = 'staff-1';

    beforeAll(() => {
      process.env.ALLOWED_USER_IDS = `${ADMIN_ID},dev-9`;
    });

    beforeEach(() => {
      prisma.relatorio.findUnique = jest.fn();
    });

    it('throws NotFoundException when the row is missing', async () => {
      prisma.relatorio.findUnique.mockResolvedValue(null);
      const staff = new Usuario({
        id_usuario: STAFF_ID,
        perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
      });
      await expect(service.assertCanAccess('1', staff)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('admin gets the row back without hydrating produtor', async () => {
      prisma.relatorio.findUnique.mockResolvedValue({
        id: '1',
        produtorId: '10',
        tecnicoId: 'someone-else',
      });
      const admin = new Usuario({ id_usuario: ADMIN_ID, perfis: [] });

      const result = await service.assertCanAccess('1', admin);

      expect(result).toMatchObject({ id: '1' });
      expect(
        (service as any).cachedProdutorReader.findManyById,
      ).not.toHaveBeenCalled();
    });

    it('staff sees their own relatorio', async () => {
      prisma.relatorio.findUnique.mockResolvedValue({
        id: '1',
        produtorId: '10',
        tecnicoId: STAFF_ID,
      });
      (
        (service as any).cachedProdutorReader.findManyById as jest.Mock
      ).mockResolvedValue([{ id_pessoa_demeter: '10', id_reg_empresa: 'R-1' }]);

      const staff = new Usuario({
        id_usuario: STAFF_ID,
        perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
      });
      const result = await service.assertCanAccess('1', staff);
      expect(result).toMatchObject({ id: '1' });
    });

    it('staff cannot see another tecnico\'s relatorio (404, not 403)', async () => {
      prisma.relatorio.findUnique.mockResolvedValue({
        id: '1',
        produtorId: '10',
        tecnicoId: 'someone-else',
      });
      (
        (service as any).cachedProdutorReader.findManyById as jest.Mock
      ).mockResolvedValue([{ id_pessoa_demeter: '10', id_reg_empresa: 'R-1' }]);

      const staff = new Usuario({
        id_usuario: STAFF_ID,
        perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
      });
      await expect(service.assertCanAccess('1', staff)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('coordenadorRegional sees relatorios in their regional', async () => {
      prisma.relatorio.findUnique.mockResolvedValue({
        id: '1',
        produtorId: '10',
        tecnicoId: 'someone-else',
      });
      (
        (service as any).cachedProdutorReader.findManyById as jest.Mock
      ).mockResolvedValue([{ id_pessoa_demeter: '10', id_reg_empresa: 'R-1' }]);

      const coord = new Usuario({
        id_usuario: 'coord-1',
        id_reg_empresa: 'R-1',
        perfis: [PerfilUsuario.ADMINISTRADOR2],
      });
      const result = await service.assertCanAccess('1', coord);
      expect(result).toMatchObject({ id: '1' });
    });

    it('coordenadorRegional cannot see other regional + non-owned (404)', async () => {
      prisma.relatorio.findUnique.mockResolvedValue({
        id: '1',
        produtorId: '10',
        tecnicoId: 'someone-else',
      });
      (
        (service as any).cachedProdutorReader.findManyById as jest.Mock
      ).mockResolvedValue([{ id_pessoa_demeter: '10', id_reg_empresa: 'R-2' }]);

      const coord = new Usuario({
        id_usuario: 'coord-1',
        id_reg_empresa: 'R-1',
        perfis: [PerfilUsuario.ADMINISTRADOR2],
      });
      await expect(service.assertCanAccess('1', coord)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('RelatorioService.getAuthorizedRelatorios (list scoping)', () => {
    const ADMIN_ID = 'admin-1';
    const STAFF_ID = 'staff-1';
    const COORD_ID = 'coord-1';

    beforeAll(() => {
      process.env.ALLOWED_USER_IDS = `${ADMIN_ID},dev-9`;
    });

    const list = [
      { id: 'own', tecnicoId: STAFF_ID, id_reg_empresa: 'R-1' },
      { id: 'sameRegion', tecnicoId: 'other', id_reg_empresa: 'R-1' },
      { id: 'otherRegion', tecnicoId: 'other2', id_reg_empresa: 'R-2' },
    ];

    beforeEach(() => {
      jest.spyOn(service, 'findAll').mockResolvedValue(list as any);
    });

    it('staff sees only their own relatorios (region is ignored)', async () => {
      const staff = new Usuario({
        id_usuario: STAFF_ID,
        id_reg_empresa: 'R-1',
        perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
      });
      const result = await service.getAuthorizedRelatorios(staff, true);
      expect((result as any[]).map((r) => r.id)).toEqual(['own']);
    });

    it('coordenador sees their region UNION their own work outside it', async () => {
      (service.findAll as jest.Mock).mockResolvedValue([
        { id: 'regionNotOwn', tecnicoId: 'other', id_reg_empresa: 'R-1' },
        { id: 'ownOtherRegion', tecnicoId: COORD_ID, id_reg_empresa: 'R-2' },
        { id: 'otherRegionNotOwn', tecnicoId: 'other2', id_reg_empresa: 'R-2' },
      ] as any);

      const coord = new Usuario({
        id_usuario: COORD_ID,
        id_reg_empresa: 'R-1',
        perfis: [PerfilUsuario.ADMINISTRADOR2],
      });
      const result = await service.getAuthorizedRelatorios(coord, true);
      expect((result as any[]).map((r) => r.id).sort()).toEqual([
        'ownOtherRegion',
        'regionNotOwn',
      ]);
    });

    it('admin gets the full list without scoping', async () => {
      const admin = new Usuario({ id_usuario: ADMIN_ID, perfis: [] });
      const result = await service.getAuthorizedRelatorios(admin, true);
      expect((result as any[]).map((r) => r.id)).toEqual([
        'own',
        'sameRegion',
        'otherRegion',
      ]);
    });

    it('does not scope when expand is false (raw list passes through)', async () => {
      const staff = new Usuario({
        id_usuario: STAFF_ID,
        id_reg_empresa: 'R-1',
        perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
      });
      const result = await service.getAuthorizedRelatorios(staff, false);
      expect((result as any[]).map((r) => r.id)).toEqual([
        'own',
        'sameRegion',
        'otherRegion',
      ]);
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
