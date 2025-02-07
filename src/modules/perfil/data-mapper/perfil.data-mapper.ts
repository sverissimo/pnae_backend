import { pascalize } from 'humps';
import { PerfilOptionDTO } from '../types/perfil-option.dto';
import { primeNumbers } from '../constants/primeNumbers';
import { PerfilModel } from 'src/@domain/perfil/perfil.model';
import { DadosProducaoModel } from '../types';
import { primeNumbersPerfilProps } from '../constants/primeNumberPerfilProps';

export class PerfilDataMapper {
  static convertStringPropsToPrimeNumbers = (
    perfilInput: PerfilModel | any,
    perfilOptionsDTO: PerfilOptionDTO[],
  ) => {
    const processPerfil = (
      perfil: PerfilModel | DadosProducaoModel,
      id_contrato: number,
    ) => {
      for (const key in perfil) {
        if (
          key === 'dados_producao_in_natura' ||
          key === 'dados_producao_agro_industria'
        ) {
          processPerfil(perfil[key], id_contrato);
        }

        const shouldModify = primeNumbersPerfilProps.includes(key);

        if (shouldModify) {
          const primeNumber = PerfilDataMapper.getPrimeNumber(
            key,
            perfil[key],
            perfilOptionsDTO,
            id_contrato,
          );
          perfil[key] = primeNumber;
        }
      }
    };

    processPerfil(perfilInput, perfilInput.id_contrato);
  };

  private static getPrimeNumber = (
    key: string,
    values: string[],
    perfilOptionsDTO: PerfilOptionDTO[],
    idContrato: number,
  ) => {
    const ids = perfilOptionsDTO
      .filter((option) => {
        return (
          option.tipo === this.toPascalCaseAndNormalize(key) &&
          values.includes(option.descricao) &&
          option.id_contrato === idContrato
        );
      })
      .map((option) => option.id);

    if (ids.length === 0) return;

    const primeNumberValue = ids.reduce((acc, id) => acc * primeNumbers[id], 1);
    return primeNumberValue;
  };

  // Altera para PascalCase e corrige erros do BD Demeter
  private static toPascalCaseAndNormalize = (str: string) => {
    const camelizedField = pascalize(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/De/g, '')
      .replace(/Da/g, '')
      .replace(/Dos/g, '')
      .replace(/Do/g, '')
      .replace(/Que/g, '')
      .replace('(R$)', '')
      .replace('ProcedimentoPosColheita', 'ProcedimentosPosColheita')
      .replace('TipoEstabelecimento', 'TipoOrganizacaoEstabelecimento')
      .replace('ValorTotalObtidoPNAE', 'ValorPnae')
      .replace('ValorTotalObtidoPnae', 'ValorPnae')
      .replace('ValorTotalObtidoOutros', 'ValorDemais');
    return camelizedField;
  };
}
