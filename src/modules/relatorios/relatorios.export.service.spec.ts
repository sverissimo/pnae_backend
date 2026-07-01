jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => <T>(fn: () => Promise<T>) => fn(),
}));
jest.mock('graphql-request', () => ({
  gql: (literals: TemplateStringsArray) => literals[0],
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: jest.fn() })),
}));

import { NotFoundException } from '@nestjs/common';
import { RelatorioExportService } from './relatorios.export.service';

describe('RelatorioExportService.createManualPdfInput', () => {
  const buildService = ({
    produtorOverrides = {},
    getArquivos,
  }: {
    produtorOverrides?: Record<string, any>;
    getArquivos?: jest.Mock;
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
      getArquivos:
        getArquivos ??
        jest.fn().mockImplementation(({ fileType }) => {
          const bytes =
            fileType === 'relatorio'
              ? Buffer.from('%PDF manual')
              : Buffer.from([0xff, 0xd8, 0xff]);
          return Promise.resolve({
            buffer: bytes,
            contentType:
              fileType === 'relatorio' ? 'application/pdf' : 'image/jpeg',
          });
        }),
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

  it('builds manual PDF input from atendimento, produtor, perfil, and Demeter files', async () => {
    const { service, atendimentoService, produtorApi } = buildService();

    const input = await service.createManualPdfInput('987');

    expect(atendimentoService.findOne).toHaveBeenCalledWith('987');
    expect(produtorApi.getProdutorById).toHaveBeenCalledWith('42');
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
    expect(input.imagens).toHaveLength(2);
    expect(input.imagens[0]).toMatchObject({
      legenda: 'Relatório assinado',
    });
    expect(input.imagens[0].dataUri).toContain('data:application/pdf;base64,');
  });

  it('falls back to a minimal cover when the produtor has no perfil', async () => {
    const { service } = buildService({
      produtorOverrides: { perfis: [] },
    });

    const input = await service.createManualPdfInput('987');

    expect(input.perfilPDFModel).toBeNull();
    expect(input.dados_producao_in_natura).toBeNull();
    expect(input.dados_producao_agro_industria).toBeNull();
    expect(input.imagens).toHaveLength(2);
  });

  it('renders whatever files exist when one manual file is missing', async () => {
    const getArquivos = jest.fn().mockImplementation(({ fileType }) => {
      if (fileType === 'foto') {
        throw new NotFoundException('Arquivo não encontrado.');
      }
      return Promise.resolve({
        buffer: Buffer.from('%PDF manual'),
        contentType: 'application/pdf',
      });
    });
    const { service } = buildService({ getArquivos });

    const input = await service.createManualPdfInput('987');

    expect(input.imagens).toEqual([
      expect.objectContaining({ legenda: 'Relatório assinado' }),
    ]);
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
