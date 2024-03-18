import { readFileSync } from 'fs';
import { join } from 'path';
import { CreatePerfilInputDto } from './dto/create-perfil.dto';
import { Perfil } from '.';

const filePath = join(
  __dirname,
  '../../../db/mockData/create-perfil-input.dto.json',
);
const filePath2 = join(
  __dirname,
  '../../../db/mockData/create-perfil-input-natura.dto.json',
);
const fileContents = readFileSync(filePath, 'utf8');
const fileContents2 = readFileSync(filePath2, 'utf8');
const perfilInput = JSON.parse(fileContents);
const perfilInputNatura = JSON.parse(fileContents2);
const createPerfilNaturaInputDto = perfilInputNatura as CreatePerfilInputDto;
const createPerfilInputDto = perfilInput as CreatePerfilInputDto;

describe('inputToOutputDTO method', () => {
  it('should return a DTO object', () => {
    const perfil = new Perfil(createPerfilInputDto);

    const dto = perfil.inputDTOToOutputDTO();

    expect(dto).toHaveProperty('id_propriedade');
    expect(dto.id_cliente).toBe('91025');
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

    expect(prodNatura.valor_total_obtido_pnae).toBe('11000');
    expect(prodNatura.valor_total_obtido_outros).toBe('12000');
    expect(prodInd.valor_total_obtido_pnae).toBe('22000');
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
