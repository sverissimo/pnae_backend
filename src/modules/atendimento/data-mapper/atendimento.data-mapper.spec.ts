import { AtendimentoDataMapper } from './atendimento.data-mapper';
import { AtendimentoComRelatorioManualItemDTO } from '../dto/atendimento-com-relatorio-manual.dto';

const baseItem: AtendimentoComRelatorioManualItemDTO = {
  id_at_atendimento: '1980461',
  data_inicio_atendimento: '2026-06-20',
  data_fim_atendimento: '2026-06-20',
  data_validacao: null,
  data_atualizacao: '2026-06-21',
  data_criacao: '2026-06-20',
  data_sei: null,
  data_see: null,
  sn_pendencia: 0,
  sn_validado: 1,
  dt_update_record: '2026-06-21T13:42:05.000Z',
  id_at_anterior: null,
  id_und_empresa: 'H1234',
  ativo: true,
  clientes: [],
  usuarios: [],
};

describe('AtendimentoDataMapper.toComRelatorioManual', () => {
  it('collapses first cliente and usuario, preserving scalar fields', () => {
    const item = AtendimentoDataMapper.toComRelatorioManual(
      {
        ...baseItem,
        clientes: [
          {
            produtor: {
              nm_pessoa: 'João',
              nr_cpf_cnpj: '123',
              dap: 'DAP',
              caf: null,
            },
            propriedade: {
              nome_propriedade: 'Sítio A',
              geo_ponto_texto: 'POINT(1 2)',
            },
          },
          {
            produtor: {
              nm_pessoa: 'Maria',
              nr_cpf_cnpj: null,
              dap: null,
              caf: null,
            },
            propriedade: null,
          },
        ],
        usuarios: [
          {
            id_usuario: '7',
            nome_usuario: 'TECNICA',
            id_und_empresa: 'H1234',
          },
        ],
      },
      {
        nomeMunicipio: 'Viçosa',
        id_reg_empresa: 'G0040',
        nomeRegional: 'Regional Viçosa',
      },
    );

    expect(item.id_at_atendimento).toBe('1980461');
    expect(item.produtor?.nm_pessoa).toBe('João');
    expect(item.propriedade?.nome_propriedade).toBe('Sítio A');
    expect(item.usuario?.id_usuario).toBe('7');
    expect(item.nomeMunicipio).toBe('Viçosa');
    expect(item.id_reg_empresa).toBe('G0040');
    expect(item.nomeRegional).toBe('Regional Viçosa');
  });

  it('maps empty arrays and localidade misses to nulls', () => {
    const item = AtendimentoDataMapper.toComRelatorioManual(baseItem);

    expect(item.produtor).toBeNull();
    expect(item.propriedade).toBeNull();
    expect(item.usuario).toBeNull();
    expect(item.nomeMunicipio).toBeNull();
    expect(item.id_reg_empresa).toBeNull();
    expect(item.nomeRegional).toBeNull();
  });
});

describe('AtendimentoDataMapper.toComRelatorioManualPage', () => {
  it('keeps the upstream page envelope and enriches by id_und_empresa', () => {
    const page = AtendimentoDataMapper.toComRelatorioManualPage(
      {
        items: [baseItem],
        pageSize: 200,
        nextCursor: '1980461',
        hasMore: true,
      },
      new Map([
        [
          'H1234',
          {
            nomeMunicipio: 'Viçosa',
            id_reg_empresa: 'G0040',
            nomeRegional: 'Regional Viçosa',
          },
        ],
      ]),
    );

    expect(page.pageSize).toBe(200);
    expect(page.nextCursor).toBe('1980461');
    expect(page.hasMore).toBe(true);
    expect(page.items[0].nomeRegional).toBe('Regional Viçosa');
  });
});
