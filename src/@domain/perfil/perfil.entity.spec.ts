import { readFileSync } from 'fs';
import { join } from 'path';
import { CreatePerfilInputDto } from './dto/create-perfil.dto';
import { Perfil } from '.';

const filePath = join(__dirname, '../../../db/mockData/create-perfil-input.dto.json');
const fileContents = readFileSync(filePath, 'utf8');
const perfilInput = JSON.parse(fileContents);
const createPerfilInputDto = perfilInput as CreatePerfilInputDto;

describe('toDTO method', () => {
  it.only('should return a DTO object', () => {
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
    expect(dto.dados_producao_in_natura.tipo_regularizacao_uso_recursos_hidricos).toBe(
      'CERTIDAO_USO_INSIGNIFICANTE',
    );
    expect(dto.dados_producao_in_natura.tipo_regularizacao_ambiental).toBe(
      'CERTIDAO_DISPENSA_LICENCIAMENTO',
    );

    expect(dto.ativo).toBe(true);
  });
});
