jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => <T>(fn: () => Promise<T>) => fn(),
}));
jest.mock('graphql-request', () => ({
  gql: (literals: TemplateStringsArray) => literals[0],
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: jest.fn() })),
}));
jest.mock('src/@pdf-gen/demeter-pdf-assembler', () => ({
  assembleDemeterPdf: jest.fn(),
}));

import { Readable } from 'stream';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { PdfGenerator } from 'src/@pdf-gen/pdf-gen';
import { assembleDemeterPdf } from 'src/@pdf-gen/demeter-pdf-assembler';
import { RelatorioExportService } from './relatorios.export.service';
import { ZipCreator } from 'src/@zip-gen/ZipCreator';

describe('RelatorioExportService.createDemeterRelatorioPdf', () => {
  const coverBytes = Buffer.from('%PDF cover');
  const combinedBytes = Buffer.from('%PDF combined');

  const buildService = ({
    produtorOverrides = {},
    arquivos = [] as any[],
  } = {}) => {
    const service = Object.create(
      RelatorioExportService.prototype,
    ) as RelatorioExportService;

    const atendimentoService = {
      findOne: jest.fn().mockResolvedValue({
        id_at_atendimento: '987',
        data_inicio_atendimento: '2026-06-20',
        id_und_empresa: 'H1234',
        at_cli_atend_prop: {
          id_pessoa_demeter: '42',
          id_pl_propriedade: '100',
        },
        at_atendimento_usuario: {
          id_usuario: '7',
        },
      }),
      getArquivosAtendimento: jest.fn().mockResolvedValue(arquivos),
    };
    const produtorApi = {
      getProdutorById: jest.fn().mockResolvedValue({
        nm_pessoa: 'João da Silva',
        nr_cpf_cnpj: '12345678901',
        caf: 'CAF-1',
        dap: null,
        id_und_empresa: 'H1234',
        propriedades: [{ nome_propriedade: 'Sítio A' }],
        perfis: [buildPerfil(1), buildPerfil(2)],
        ...produtorOverrides,
      }),
    };

    (service as any).atendimentoService = atendimentoService;
    (service as any).produtorApi = produtorApi;

    return { service, atendimentoService, produtorApi };
  };

  const arquivo = (
    idArquivo: string,
    tipoArquivo: string,
    contentType = tipoArquivo,
  ) => ({
    idArquivo,
    tipoArquivo,
    contentType,
    buffer: Buffer.from(`file-${idArquivo}`),
  });

  let generateDemeterPdfSpy: jest.SpyInstance;

  beforeEach(() => {
    generateDemeterPdfSpy = jest
      .spyOn(PdfGenerator, 'generateDemeterPdf')
      .mockResolvedValue(Readable.from([coverBytes]) as any);
    (assembleDemeterPdf as jest.Mock).mockResolvedValue(combinedBytes);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (assembleDemeterPdf as jest.Mock).mockReset();
  });

  it('assembles cover + every relatório PDF + every foto, keeping idArquivo order per group', async () => {
    const arquivos = [
      arquivo('3', 'application/pdf'),
      arquivo('5', 'image/jpeg'),
      arquivo('9', 'application/pdf'),
      arquivo('11', 'image/gif'),
    ];
    const { service, atendimentoService, produtorApi } = buildService({
      arquivos,
    });

    const result = await service.createDemeterRelatorioPdf('987');

    expect(atendimentoService.getArquivosAtendimento).toHaveBeenCalledWith(
      '987',
    );
    expect(atendimentoService.findOne).toHaveBeenCalledWith('987');
    expect(produtorApi.getProdutorById).toHaveBeenCalledWith('42');

    const input = generateDemeterPdfSpy.mock.calls[0][0];
    expect(input.produtor).toMatchObject({
      nomeProdutor: 'João da Silva',
      cpf: '123.456.789-01',
      caf: 'CAF-1',
      id_und_empresa: 'H1234',
    });
    expect(input.atendimento).toMatchObject({
      atendimentoId: '987',
      produtorId: '42',
      propriedadeId: '100',
      tecnicoId: '7',
    });
    expect(input.nome_propriedade).toBe('Sítio A');
    expect(input.perfilPDFModel).not.toBeNull();
    expect(input.possuiArquivos).toBe(true);

    const assembly = (assembleDemeterPdf as jest.Mock).mock.calls[0][0];
    expect(assembly.coverPdf.equals(coverBytes)).toBe(true);
    expect(assembly.relatorioPdfs.map((a) => a.idArquivo)).toEqual(['3', '9']);
    expect(assembly.fotos.map((a) => a.idArquivo)).toEqual(['5', '11']);

    expect(result.pdf.equals(combinedBytes)).toBe(true);
    expect(result.nomeProdutor).toBe('João da Silva');
  });

  it('rejects application/msword with a clear unsupported-file error before any PDF work', async () => {
    const { service } = buildService({
      arquivos: [arquivo('3', 'application/msword')],
    });

    await expect(service.createDemeterRelatorioPdf('987')).rejects.toThrow(
      new BadRequestException(
        'Arquivo em formato não suportado para o relatório manual: application/msword.',
      ),
    );

    expect(generateDemeterPdfSpy).not.toHaveBeenCalled();
    expect(assembleDemeterPdf).not.toHaveBeenCalled();
  });

  it('degrades to a cover-only PDF when the atendimento has no files', async () => {
    const { service } = buildService({ arquivos: [] });

    const result = await service.createDemeterRelatorioPdf('987');

    const input = generateDemeterPdfSpy.mock.calls[0][0];
    expect(input.possuiArquivos).toBe(false);

    const assembly = (assembleDemeterPdf as jest.Mock).mock.calls[0][0];
    expect(assembly.relatorioPdfs).toEqual([]);
    expect(assembly.fotos).toEqual([]);
    expect(result.pdf.equals(combinedBytes)).toBe(true);
  });

  it('falls back to a minimal cover when the produtor has no perfil', async () => {
    const { service } = buildService({
      produtorOverrides: { perfis: [] },
      arquivos: [arquivo('3', 'application/pdf')],
    });

    await service.createDemeterRelatorioPdf('987');

    const input = generateDemeterPdfSpy.mock.calls[0][0];
    expect(input.perfilPDFModel).toBeNull();
    expect(input.dados_producao_in_natura).toBeNull();
    expect(input.dados_producao_agro_industria).toBeNull();
  });
});

describe('RelatorioExportService.resolveZipItems', () => {
  const buildResolverService = ({
    relatorios = [] as any[],
    produtores = [] as any[],
    demeterById = {} as Record<string, any>,
  } = {}) => {
    const service = Object.create(
      RelatorioExportService.prototype,
    ) as RelatorioExportService;

    const relatorioService = {
      findAll: jest.fn().mockResolvedValue(relatorios),
    };
    const produtorService = {
      findManyById: jest.fn().mockResolvedValue(produtores),
    };
    const atendimentoService = {
      getAtendimentoComRelatorioDemeter: jest.fn(
        async (id: string) => demeterById[id] ?? null,
      ),
    };

    (service as any).relatorioService = relatorioService;
    (service as any).produtorService = produtorService;
    (service as any).atendimentoService = atendimentoService;
    (service as any).logger = { error: jest.fn(), warn: jest.fn() };

    return { service, relatorioService, produtorService, atendimentoService };
  };

  it('splits requested ids into PNAE-backed, Demeter-only, and skipped, preserving paste order', async () => {
    const relatorio = { id: 'r1', atendimentoId: '100', produtorId: '55' };
    const { service, relatorioService, produtorService } =
      buildResolverService({
        relatorios: [relatorio],
        produtores: [
          {
            id_pessoa_demeter: '55',
            municipio: 'Lavras',
            regional_sre: 'SRE Sul',
          },
        ],
        demeterById: {
          '200': {
            id_at_atendimento: '200',
            nomeRegional: 'Regional Emater Norte',
            regionalSre: 'SRE Norte',
            nomeMunicipio: 'Montes Claros',
          },
        },
      });

    const { items, skippedIds } = await service.resolveZipItems([
      '200',
      '100',
      '300',
    ]);

    expect(relatorioService.findAll).toHaveBeenCalledWith({ contratoId: 2 });
    expect(produtorService.findManyById).toHaveBeenCalledWith(['55']);

    expect(items).toEqual([
      {
        source: 'demeter',
        atendimentoId: '200',
        regional: 'SRE Norte',
        municipio: 'Montes Claros',
        demeter: expect.objectContaining({ id_at_atendimento: '200' }),
      },
      {
        source: 'pnae',
        atendimentoId: '100',
        regional: 'SRE Sul',
        municipio: 'Lavras',
        relatorio,
      },
    ]);
    expect(skippedIds).toEqual(['300']);
  });

  it('falls back to placeholder regional/município names when unresolved', async () => {
    const { service } = buildResolverService({
      relatorios: [{ id: 'r1', atendimentoId: '100', produtorId: '55' }],
      produtores: [], // produtor lookup misses
      demeterById: {
        '200': {
          id_at_atendimento: '200',
          nomeRegional: 'Regional Emater Norte', // must NOT be used as grouping fallback
          regionalSre: null,
          nomeMunicipio: null,
        },
      },
    });

    const { items } = await service.resolveZipItems(['100', '200']);

    expect(items[0]).toMatchObject({
      source: 'pnae',
      regional: 'regional_nao_encontrada',
      municipio: 'mun_nao_encontrado',
    });
    expect(items[1]).toMatchObject({
      source: 'demeter',
      regional: 'regional_nao_encontrada',
      municipio: 'mun_nao_encontrado',
    });
  });

  it('skips the Demeter and produtor lookups when they have no ids to resolve', async () => {
    const pnaeOnly = buildResolverService({
      relatorios: [{ id: 'r1', atendimentoId: '100', produtorId: '55' }],
      produtores: [
        { id_pessoa_demeter: '55', municipio: 'Lavras', regional_sre: 'SRE Sul' },
      ],
    });

    await pnaeOnly.service.resolveZipItems(['100']);
    expect(
      pnaeOnly.atendimentoService.getAtendimentoComRelatorioDemeter,
    ).not.toHaveBeenCalled();

    const demeterOnly = buildResolverService({
      demeterById: {
        '200': {
          id_at_atendimento: '200',
          regionalSre: 'SRE Norte',
          nomeMunicipio: 'Montes Claros',
        },
      },
    });

    await demeterOnly.service.resolveZipItems(['200']);
    expect(demeterOnly.produtorService.findManyById).not.toHaveBeenCalled();
  });
});

describe('RelatorioExportService.createZipJob', () => {
  const buildJobService = () => {
    const service = Object.create(
      RelatorioExportService.prototype,
    ) as RelatorioExportService;

    const job = {
      id: '9',
      getState: jest.fn().mockResolvedValue('waiting'),
      data: { userId: '10', atendimentoIds: ['1', '2'] },
    };
    const zipQueue = { add: jest.fn().mockResolvedValue(job) };
    const redis = { set: jest.fn().mockResolvedValue('OK') };

    (service as any).zipQueue = zipQueue;
    (service as any).redis = redis;
    (service as any).logger = { error: jest.fn() };

    return { service, zipQueue, redis };
  };

  it('enqueues the ids and stores id-based job metadata without date fields', async () => {
    const { service, zipQueue, redis } = buildJobService();

    const result = await service.createZipJob({
      userId: '10',
      atendimentoIds: ['1', '2'],
    });

    expect(zipQueue.add).toHaveBeenCalledWith(
      'build-zip',
      { userId: '10', atendimentoIds: ['1', '2'] },
      expect.objectContaining({ attempts: 1 }),
    );

    const metadataCall = redis.set.mock.calls.find(
      ([key]) => key === 'zip:9',
    );
    const metadata = JSON.parse(metadataCall[1]);
    expect(metadata).toEqual({
      userId: '10',
      status: 'waiting',
      atendimentoCount: 2,
      requestedAtendimentoIds: ['1', '2'],
    });
    expect(metadataCall.slice(2)).toEqual(['EX', 60 * 60 * 24]);

    expect(redis.set).toHaveBeenCalledWith('zip:last', '9');
    expect(result).toEqual({
      jobId: '9',
      status: 'waiting',
      userId: '10',
      atendimentoIds: ['1', '2'],
    });
  });
});

describe('RelatorioExportService Phase 2 ZIP helpers', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'relatorio-export-test-'));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  const buildFileService = ({
    relatorios = [] as any[],
    produtores = [] as any[],
    demeterById = {} as Record<string, any>,
    atendimentoRows = [] as any[],
  } = {}) => {
    const service = Object.create(
      RelatorioExportService.prototype,
    ) as RelatorioExportService;

    const logger = { error: jest.fn(), warn: jest.fn() };
    const atendimentoService = {
      getAtendimentoComRelatorioDemeter: jest.fn(
        async (id: string) => demeterById[id] ?? null,
      ),
      findMany: jest.fn().mockResolvedValue(atendimentoRows),
      setAtendimentosExportDate: jest.fn().mockResolvedValue(undefined),
    };
    const redis = {
      hset: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({}),
    };
    (service as any).relatorioService = {
      findAll: jest.fn().mockResolvedValue(relatorios),
    };
    (service as any).produtorService = {
      findManyById: jest.fn().mockResolvedValue(produtores),
    };
    (service as any).atendimentoService = atendimentoService;
    (service as any).redis = redis;
    (service as any).logger = logger;
    (service as any).historyDir = tmpDir;

    return { service, logger, atendimentoService, redis };
  };

  it('returns the empty-job message when no requested id resolves to a relatório', async () => {
    const { service, logger } = buildFileService();

    const result = await service.createZipFile({
      atendimentoIds: ['1', '2'],
    });

    expect(result).toBe('Não há nenhum relatório para ser anexado no SEI.');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('1, 2'),
    );
  });

  it('writes a Demeter PDF buffer to a collision-safe temp file with a stable ZIP filename', async () => {
    const { service } = buildFileService();
    jest.spyOn(service, 'createDemeterRelatorioPdf').mockResolvedValue({
      pdf: Buffer.from('%PDF demeter'),
      nomeProdutor: 'João/da Silva',
    });

    const result = await (service as any).createDemeterPDFFile({
      source: 'demeter',
      atendimentoId: '987',
      regional: 'SRE Sul',
      municipio: 'Lavras/MG',
      demeter: { id_at_atendimento: '987' },
    });

    expect(result.filename).toBe('2.3_LavrasMG_Joãoda Silva_987_manual.pdf');
    expect(path.basename(result.filePath)).toContain('demeter-987');
    await expect(fsp.readFile(result.filePath)).resolves.toEqual(
      Buffer.from('%PDF demeter'),
    );
  });

  it('returns dual-format ZIP history metadata for date-range and atendimento-id files', async () => {
    const { service } = buildFileService();
    await fsp.writeFile(
      path.join(tmpDir, 'relatorios_2026-06-01_a_2026-06-30.zip'),
      'old',
    );
    await fsp.writeFile(
      path.join(tmpDir, 'relatorios_atendimentos_2026-07-03_153000.zip'),
      'new',
    );

    const history = await service.getZipHistory();

    const dateRange = history.find((item) =>
      item.filename.startsWith('relatorios_2026-06-01'),
    );
    const byIds = history.find((item) =>
      item.filename.startsWith('relatorios_atendimentos_2026-07-03'),
    );

    expect(dateRange).toMatchObject({
      filename: 'relatorios_2026-06-01_a_2026-06-30.zip',
      mode: 'date-range',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    });
    expect(byIds).toMatchObject({
      filename: 'relatorios_atendimentos_2026-07-03_153000.zip',
      mode: 'atendimento-ids',
    });
    expect(byIds).not.toHaveProperty('fromDate');
    expect(byIds).not.toHaveProperty('toDate');
  });

  it('creates a final ZIP from mixed PNAE and Demeter items', async () => {
    const relatorio = { id: 'r1', atendimentoId: '100', produtorId: '55' };
    const atendimentoRows = [
      { id_at_atendimento: '200', dt_export_ok: null },
      { id_at_atendimento: '100', dt_export_ok: null },
    ];
    const { service, atendimentoService, redis } = buildFileService({
      relatorios: [relatorio],
      produtores: [
        { id_pessoa_demeter: '55', municipio: 'Lavras', regional_sre: 'SRE Sul' },
      ],
      demeterById: {
        '200': {
          id_at_atendimento: '200',
          nomeRegional: 'Regional Emater Norte',
          regionalSre: 'SRE Norte',
          nomeMunicipio: 'Montes Claros',
        },
      },
      atendimentoRows,
    });
    jest
      .spyOn(service, 'createPDFStream')
      .mockResolvedValue({ filename: 'pnae.pdf', filePath: '/tmp/pnae.pdf' });
    jest
      .spyOn(service as any, 'createDemeterPDFFile')
      .mockResolvedValue({ filename: 'demeter.pdf', filePath: '/tmp/demeter.pdf' });
    const regionSpy = jest
      .spyOn(ZipCreator.prototype, 'generateRegionZipParts')
      .mockImplementation(async function (municipios: any[], createFile: any) {
        for (const municipio of municipios) {
          for (const item of municipio.items) {
            await createFile(item);
          }
        }
        return [`/tmp/${(this as any).region}.zip`];
      });
    const finalSpy = jest
      .spyOn(ZipCreator, 'generateFinalZip')
      .mockResolvedValue('/tmp/relatorios_atendimentos_2026-07-03_153000.zip');
    jest.spyOn<any, any>(service as any, 'buildZipTimestamp').mockReturnValue(
      '2026-07-03_153000',
    );

    const result = await service.createZipFile({
      atendimentoIds: ['200', '100'],
    });

    expect(regionSpy).toHaveBeenCalledTimes(2);
    expect(service.createPDFStream).toHaveBeenCalledWith('r1', relatorio);
    expect((service as any).createDemeterPDFFile).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'demeter', atendimentoId: '200' }),
    );
    expect(finalSpy).toHaveBeenCalledWith({
      filePaths: expect.arrayContaining(['/tmp/SRE Norte.zip', '/tmp/SRE Sul.zip']),
      finalZipName: 'relatorios_atendimentos_2026-07-03_153000.zip',
    });
    expect(result).toBe('/tmp/relatorios_atendimentos_2026-07-03_153000.zip');

    // Post-ZIP side effects: export-date marking + included-ids Redis hash (plan §6/§7).
    expect(atendimentoService.findMany).toHaveBeenCalledWith(['200', '100']);
    expect(atendimentoService.setAtendimentosExportDate).toHaveBeenCalledWith(
      atendimentoRows,
    );
    expect(redis.hset).toHaveBeenCalledWith(
      'zip:atendimentos-incluidos',
      'relatorios_atendimentos_2026-07-03_153000.zip',
      JSON.stringify(['200', '100']),
    );
  });

  it('excludes ids whose PDF generation failed from the side effects', async () => {
    const relatorio = { id: 'r1', atendimentoId: '100', produtorId: '55' };
    const { service, atendimentoService, redis } = buildFileService({
      relatorios: [relatorio],
      produtores: [
        { id_pessoa_demeter: '55', municipio: 'Lavras', regional_sre: 'SRE Sul' },
      ],
      demeterById: {
        '200': {
          id_at_atendimento: '200',
          regionalSre: 'SRE Sul',
          nomeMunicipio: 'Lavras',
        },
      },
    });
    jest
      .spyOn(service, 'createPDFStream')
      .mockResolvedValue({ filename: 'pnae.pdf', filePath: '/tmp/pnae.pdf' });
    jest
      .spyOn(service as any, 'createDemeterPDFFile')
      .mockRejectedValue(new Error('PDF quebrado'));
    jest
      .spyOn(ZipCreator.prototype, 'generateRegionZipParts')
      .mockImplementation(async function (municipios: any[], createFile: any) {
        for (const municipio of municipios) {
          for (const item of municipio.items) {
            // Same per-item skip-and-continue behavior as the real ZipCreator.
            await createFile(item).catch(() => null);
          }
        }
        return [`/tmp/${(this as any).region}.zip`];
      });
    jest
      .spyOn(ZipCreator, 'generateFinalZip')
      .mockResolvedValue('/tmp/relatorios_atendimentos_2026-07-04_090000.zip');

    await service.createZipFile({ atendimentoIds: ['200', '100'] });

    expect(atendimentoService.findMany).toHaveBeenCalledWith(['100']);
    expect(redis.hset).toHaveBeenCalledWith(
      'zip:atendimentos-incluidos',
      'relatorios_atendimentos_2026-07-04_090000.zip',
      JSON.stringify(['100']),
    );
  });

  it('keeps the ZIP result when the post-ZIP side effects fail', async () => {
    const { service, logger, redis } = buildFileService();
    jest.spyOn(service, 'resolveZipItems').mockResolvedValue({
      items: [
        {
          source: 'pnae',
          atendimentoId: '100',
          regional: 'SRE Sul',
          municipio: 'Lavras',
          relatorio: { id: 'r1' } as any,
        },
      ],
      skippedIds: [],
    });
    jest
      .spyOn(service as any, 'createZipFilesForAllRegions')
      .mockResolvedValue({
        filePaths: ['/tmp/SRE Sul.zip'],
        includedAtendimentoIds: ['100'],
      });
    jest
      .spyOn(ZipCreator, 'generateFinalZip')
      .mockResolvedValue('/tmp/relatorios_atendimentos_2026-07-04_100000.zip');
    (service as any).atendimentoService.findMany.mockRejectedValue(
      new Error('gateway offline'),
    );
    redis.hset.mockRejectedValue(new Error('redis offline'));

    const result = await service.createZipFile({ atendimentoIds: ['100'] });

    expect(result).toBe('/tmp/relatorios_atendimentos_2026-07-04_100000.zip');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('gateway offline'),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('redis offline'),
    );
  });

  it('fails the job when ids resolve but every PDF generation fails', async () => {
    const { service } = buildFileService();
    jest.spyOn(service, 'resolveZipItems').mockResolvedValue({
      items: [
        {
          source: 'demeter',
          atendimentoId: '2289131',
          regional: 'SRE Sul',
          municipio: 'Lavras',
          demeter: { id_at_atendimento: '2289131' } as any,
        },
      ],
      skippedIds: [],
    });
    jest
      .spyOn(service as any, 'createZipFilesForAllRegions')
      .mockResolvedValue({ filePaths: [], includedAtendimentoIds: [] });

    await expect(
      service.createZipFile({ atendimentoIds: ['2289131'] }),
    ).rejects.toThrow(
      'Falha ao gerar os PDFs dos relatórios selecionados. Verifique os logs para identificar o atendimento com erro.',
    );
  });

  it('returns the Redis hash keyed by ZIP filename, skipping malformed entries', async () => {
    const { service, redis } = buildFileService();
    redis.hgetall.mockResolvedValue({
      'relatorios_atendimentos_2026-07-03_153000.zip': '["100","200"]',
      'relatorios_atendimentos_2026-07-04_090000.zip': '[300]',
      'broken.zip': 'not-json',
      'not-array.zip': '{"a":1}',
    });

    const result = await service.getAtendimentosIncluidos();

    expect(redis.hgetall).toHaveBeenCalledWith('zip:atendimentos-incluidos');
    expect(result).toEqual({
      'relatorios_atendimentos_2026-07-03_153000.zip': ['100', '200'],
      'relatorios_atendimentos_2026-07-04_090000.zip': ['300'],
    });
  });
});

function buildPerfil(id_contrato: number) {
  return {
    id_contrato,
    tipo_perfil: 'ENTRADA',
    participa_organizacao: true,
    grau_interesse_pnae: 'ALTO',
    at_prf_see_propriedade: [{ atividade: 'ATIVIDADE_PRIMARIA' }],
    dados_producao_in_natura: {
      at_prf_see_grupos_produtos: [],
      controla_custos_producao: true,
      dificuldade_fornecimento: '',
      forma_entrega_produtos: '',
      informacoes_adicionais: '',
      local_comercializacao: '',
      valor_total_obtido_pnae: '',
      valor_total_obtido_outros: '',
    },
    dados_producao_agro_industria: {
      at_prf_see_grupos_produtos: [],
    },
  };
}
