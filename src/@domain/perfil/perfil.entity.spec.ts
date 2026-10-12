import { CreatePerfilInputDto } from './dto/create-perfil.dto';
import { Perfil } from '.';

const createPerfilInputDto = {
  id_cliente: 'cliente-teste',
  id_tecnico: 'tecnico-teste',
  id_propriedade: 'propriedade-teste',
  at_prf_see_propriedade: { atividade: 'Ambas' },
  tipo_gestao_unidade: 'Coletiva',
  tipo_estabelecimento: 'Pessoa Jurídica',
  tipo_pessoa_juridica: 'Associação',
  orgao_fiscalizacao_sanitaria: 'IMA (Instituto Mineiro de Agropecuária)',
  possui_agroindustria_propria: 'Sim',
  agroindustria_precisa_adaptacao_reforma: 'Sim',
  possui_registro_orgao_fiscalizacao_sanitaria: 'Sim',
  dados_producao_in_natura: {
    tipo_regularizacao_uso_recursos_hidricos: 'Certidão de uso insignificante',
    tipo_regularizacao_ambiental: 'Certidão de dispensa de licenciamento',
    valor_total_obtido_pnae: '11.000,00',
    valor_total_obtido_outros: '12000,41',
    at_prf_see_grupos_produtos: [
      {
        producao_aproximada_ultimo_ano_pnae: '1.200,60',
        producao_aproximada_ultimo_ano_total: '1.500,00',
        at_prf_see_produto: [],
      },
      {
        at_prf_see_produto: [
          {
            producao_aproximada_ultimo_ano_pnae: '2.000,00',
            producao_aproximada_ultimo_ano_total: '1.200,00',
          },
          {
            producao_aproximada_ultimo_ano_pnae: '5.345,00',
            producao_aproximada_ultimo_ano_total: '3.500,00',
          },
        ],
      },
    ],
  },
  dados_producao_agro_industria: {
    valor_total_obtido_pnae: '22.000',
    valor_total_obtido_outros: '33000',
    at_prf_see_grupos_produtos: [
      {
        at_prf_see_produto: [
          {
            producao_aproximada_ultimo_ano_pnae: '5.200,00',
            producao_aproximada_ultimo_ano_total: '5.301,00',
          },
        ],
      },
      {
        at_prf_see_produto: [
          {
            producao_aproximada_ultimo_ano_pnae: '6.000,00',
            producao_aproximada_ultimo_ano_total: '6.500,00',
          },
        ],
      },
    ],
  },
} as unknown as CreatePerfilInputDto;

const createPerfilNaturaInputDto = {
  ...createPerfilInputDto,
  at_prf_see_propriedade: { atividade: 'Atividade Primária' },
  dados_producao_agro_industria: null,
  dados_producao_in_natura: {
    ...createPerfilInputDto.dados_producao_in_natura,
    valor_total_obtido_pnae: '11000',
    valor_total_obtido_outros: '12000',
    at_prf_see_grupos_produtos: [
      {
        producao_aproximada_ultimo_ano_pnae: '1.000,00',
        producao_aproximada_ultimo_ano_total: '4.000,00',
        at_prf_see_produto: [],
      },
      {
        at_prf_see_produto: [
          {
            producao_aproximada_ultimo_ano_pnae: '2.000,00',
            producao_aproximada_ultimo_ano_total: '2.200,00',
          },
          {
            producao_aproximada_ultimo_ano_pnae: '3.000,00',
            producao_aproximada_ultimo_ano_total: '3.300,00',
          },
        ],
      },
    ],
  },
} as unknown as CreatePerfilInputDto;

describe('inputToOutputDTO method', () => {
  it('should return a DTO object', () => {
    const perfil = new Perfil(createPerfilInputDto);

    const dto = perfil.inputDTOToOutputDTO();

    expect(dto).toHaveProperty('id_propriedade');
    expect(dto.id_cliente).toBe('cliente-teste');
    expect(dto.at_prf_see_propriedade.atividade).toBe('AMBAS');
    expect(dto.tipo_gestao_unidade).toBe('COLETIVA');
    expect(dto.tipo_estabelecimento).toBe('PJ');
    expect(dto.tipo_pessoa_juridica).toBe('ASSOCIACAO');
    expect(dto.orgao_fiscalizacao_sanitaria).toBe('IMA');
    expect(dto.possui_agroindustria_propria).toBe(true);
    expect(dto.agroindustria_precisa_adaptacao_reforma).toBe(true);
    expect(dto.possui_registro_orgao_fiscalizacao_sanitaria).toBe(true);
    expect(
      dto.dados_producao_in_natura.tipo_regularizacao_uso_recursos_hidricos,
    ).toBe('CERTIDAO_USO_INSIGNIFICANTE');
    expect(dto.dados_producao_in_natura.tipo_regularizacao_ambiental).toBe(
      'CERTIDAO_DISPENSA_LICENCIAMENTO',
    );

    expect(dto.ativo).toBe(true);
  });

  it('should return a DTO object with the correct DADOS PRODUCAO >> valor_pnae/outros values >> NATURA', () => {
    const perfil = new Perfil(createPerfilNaturaInputDto);

    const dto = perfil.inputDTOToOutputDTO();

    expect(dto.dados_producao_in_natura.valor_total_obtido_pnae).toBe('11000');
    expect(dto.dados_producao_in_natura.valor_total_obtido_outros).toBe(
      '12000',
    );
  });

  it('should return a DTO object with the correct DADOS PRODUCAO >>  values >> AMBAS', () => {
    const perfil = new Perfil(createPerfilInputDto);

    const dto = perfil.inputDTOToOutputDTO();
    const prodNatura = dto.dados_producao_in_natura;
    const prodInd = dto.dados_producao_agro_industria;

    expect(prodNatura.valor_total_obtido_pnae).toBe('11.000,00');
    expect(prodNatura.valor_total_obtido_outros).toBe('12000,41');
    expect(prodInd.valor_total_obtido_pnae).toBe('22.000');
    expect(prodInd.valor_total_obtido_outros).toBe('33000');
  });

  it('should return a DTO object with the correct GROUP >> producao_pnae/total values for NATURA', () => {
    const perfil = new Perfil(createPerfilNaturaInputDto);

    const dto = perfil.inputDTOToOutputDTO();
    const gruposProdutos =
      dto.dados_producao_in_natura.at_prf_see_grupos_produtos;

    expect(gruposProdutos[0].producao_aproximada_ultimo_ano_pnae).toBe('1000');
    expect(gruposProdutos[0].producao_aproximada_ultimo_ano_total).toBe('4000');
  });

  it('should return a DTO object with the correct GROUP >> PRODUTO >> producao_pnae/total values for NATURA', () => {
    const perfil = new Perfil(createPerfilNaturaInputDto);
    const dto = perfil.inputDTOToOutputDTO();
    const gruposProdutos =
      dto.dados_producao_in_natura.at_prf_see_grupos_produtos;
    const produtos = gruposProdutos[1].at_prf_see_produto;
    expect(produtos[0].producao_aproximada_ultimo_ano_pnae).toBe('2000');
    expect(produtos[0].producao_aproximada_ultimo_ano_total).toBe('2200');
    expect(produtos[1].producao_aproximada_ultimo_ano_pnae).toBe('3000');
    expect(produtos[1].producao_aproximada_ultimo_ano_total).toBe('3300');
  });

  it('should return a DTO object with the correct GROUP >> producao_pnae/total values for AMBAS', () => {
    const perfil = new Perfil(createPerfilInputDto);

    const dto = perfil.inputDTOToOutputDTO();
    const gruposProdutos =
      dto.dados_producao_in_natura.at_prf_see_grupos_produtos;

    expect(gruposProdutos[0].producao_aproximada_ultimo_ano_pnae).toBe('1201');
    expect(gruposProdutos[0].producao_aproximada_ultimo_ano_total).toBe('1500');
  });

  it('should return a DTO object with the correct GROUP >> PRODUTO >> producao_pnae/total values for AMBAS', () => {
    const perfil = new Perfil(createPerfilInputDto);
    const dto = perfil.inputDTOToOutputDTO();
    const gruposProdutos =
      dto.dados_producao_in_natura.at_prf_see_grupos_produtos;
    const gruposProdutos2 =
      dto.dados_producao_agro_industria.at_prf_see_grupos_produtos;
    const produtos = gruposProdutos[1].at_prf_see_produto;
    const produtos2 = gruposProdutos2[0].at_prf_see_produto;
    const produtos3 = gruposProdutos2[1].at_prf_see_produto;

    expect(produtos[0].producao_aproximada_ultimo_ano_pnae).toBe('2000');
    expect(produtos[0].producao_aproximada_ultimo_ano_total).toBe('1200');
    expect(produtos[1].producao_aproximada_ultimo_ano_pnae).toBe('5345');
    expect(produtos[1].producao_aproximada_ultimo_ano_total).toBe('3500');

    expect(produtos2[0].producao_aproximada_ultimo_ano_pnae).toBe('5200');
    expect(produtos2[0].producao_aproximada_ultimo_ano_total).toBe('5301');
    expect(produtos3[0].producao_aproximada_ultimo_ano_pnae).toBe('6000');
    expect(produtos3[0].producao_aproximada_ultimo_ano_total).toBe('6500');
  });
});

describe('toPDFModel activity normalization', () => {
  const buildPerfil = (at_prf_see_propriedade: unknown) =>
    ({
      tipo_perfil: 'ENTRADA',
      nome_propriedade: 'Sítio',
      at_prf_see_propriedade,
    }) as any;

  it.each([
    ['undefined relation', undefined],
    ['empty relation', []],
    ['all-null activities', [{ atividade: null }]],
  ])('handles %s without throwing', (_case, atividades) => {
    const result = new Perfil().toPDFModel(buildPerfil(atividades));
    const atividade = result.perfilData.find(
      (item) => item.label === 'Atividade Desenvolvida',
    );

    expect(atividade?.value).toBeUndefined();
    expect(result).not.toHaveProperty('producaoNatura');
    expect(result).not.toHaveProperty('producaoIndustrial');
  });
});
