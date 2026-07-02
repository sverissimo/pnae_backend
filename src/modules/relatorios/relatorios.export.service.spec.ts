jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => <T>(fn: () => Promise<T>) => fn(),
}));
jest.mock('graphql-request', () => ({
  gql: (literals: TemplateStringsArray) => literals[0],
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: jest.fn() })),
}));
jest.mock('src/@pdf-gen/manual-pdf-assembler', () => ({
  assembleManualPdf: jest.fn(),
}));

import { Readable } from 'stream';
import { BadRequestException } from '@nestjs/common';
import { PdfGenerator } from 'src/@pdf-gen/pdf-gen';
import { assembleManualPdf } from 'src/@pdf-gen/manual-pdf-assembler';
import { RelatorioExportService } from './relatorios.export.service';

describe('RelatorioExportService.createManualRelatorioPdf', () => {
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

  let generateManualPdfSpy: jest.SpyInstance;

  beforeEach(() => {
    generateManualPdfSpy = jest
      .spyOn(PdfGenerator, 'generateManualPdf')
      .mockResolvedValue(Readable.from([coverBytes]) as any);
    (assembleManualPdf as jest.Mock).mockResolvedValue(combinedBytes);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (assembleManualPdf as jest.Mock).mockReset();
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

    const result = await service.createManualRelatorioPdf('987');

    expect(atendimentoService.getArquivosAtendimento).toHaveBeenCalledWith(
      '987',
    );
    expect(atendimentoService.findOne).toHaveBeenCalledWith('987');
    expect(produtorApi.getProdutorById).toHaveBeenCalledWith('42');

    const input = generateManualPdfSpy.mock.calls[0][0];
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

    const assembly = (assembleManualPdf as jest.Mock).mock.calls[0][0];
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

    await expect(service.createManualRelatorioPdf('987')).rejects.toThrow(
      new BadRequestException(
        'Arquivo em formato não suportado para o relatório manual: application/msword.',
      ),
    );

    expect(generateManualPdfSpy).not.toHaveBeenCalled();
    expect(assembleManualPdf).not.toHaveBeenCalled();
  });

  it('degrades to a cover-only PDF when the atendimento has no files', async () => {
    const { service } = buildService({ arquivos: [] });

    const result = await service.createManualRelatorioPdf('987');

    const input = generateManualPdfSpy.mock.calls[0][0];
    expect(input.possuiArquivos).toBe(false);

    const assembly = (assembleManualPdf as jest.Mock).mock.calls[0][0];
    expect(assembly.relatorioPdfs).toEqual([]);
    expect(assembly.fotos).toEqual([]);
    expect(result.pdf.equals(combinedBytes)).toBe(true);
  });

  it('falls back to a minimal cover when the produtor has no perfil', async () => {
    const { service } = buildService({
      produtorOverrides: { perfis: [] },
      arquivos: [arquivo('3', 'application/pdf')],
    });

    await service.createManualRelatorioPdf('987');

    const input = generateManualPdfSpy.mock.calls[0][0];
    expect(input.perfilPDFModel).toBeNull();
    expect(input.dados_producao_in_natura).toBeNull();
    expect(input.dados_producao_agro_industria).toBeNull();
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
