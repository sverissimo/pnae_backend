import { RelatorioDto } from 'src/modules/relatorios/dto/relatorio.dto';
import { RelatorioModel } from './relatorio-model';
import { toBRTimezone } from 'src/utils';

export class Relatorio {
  constructor(private readonly relatorio: RelatorioModel) {
    this.relatorio = relatorio;
    this.validate();
  }

  private validate() {
    const { produtorId, tecnicoId } = this.relatorio;
    if (!produtorId) {
      throw new Error('Produtor não pode ser vazio');
    }
    if (!tecnicoId) {
      throw new Error('Técnico não pode ser vazio');
    }
    if (!this.relatorio.numeroRelatorio) {
      throw new Error('Número do relatório não pode ser vazio');
    }
    if (!this.relatorio.contratoId) {
      throw new Error('Contrato não pode ser vazio');
    }
  }

  public static validate(relatorio: RelatorioModel) {
    const { assunto, orientacao } = new Relatorio(relatorio).toModel();
    if (!assunto) {
      throw new Error('O campo assunto é obrigatório.');
    }
    if (!orientacao) {
      throw new Error('O campo orientação é obrigatório.');
    }
  }

  toModel(): RelatorioModel {
    return this.relatorio;
  }

  static toModel(relatorioDto: RelatorioDto): RelatorioModel {
    const {
      produtorId,
      tecnicoId,
      atendimentoId,
      numeroRelatorio,
      createdAt,
      updatedAt,
      ...relatorio
    } = relatorioDto;
    const relatorioModel = {
      ...relatorio,
      produtorId: String(produtorId),
      tecnicoId: String(tecnicoId),
      atendimentoId: atendimentoId ? String(atendimentoId) : undefined,
      numeroRelatorio: +numeroRelatorio,
      createdAt: createdAt ? toBRTimezone(createdAt).toISOString() : undefined,
      updatedAt: updatedAt ? toBRTimezone(updatedAt).toISOString() : undefined,
    };
    return relatorioModel;
  }

  toDto(): RelatorioDto {
    const {
      produtorId,
      tecnicoId,
      contratoId,
      numeroRelatorio,
      assunto,
      orientacao,
      atendimentoId,
      createdAt,
      updatedAt,
      ...relatorio
    } = this.relatorio;
    const relatorioDto = {
      ...relatorio,
      produtorId: BigInt(produtorId),
      tecnicoId: BigInt(tecnicoId),
      numeroRelatorio: Number(numeroRelatorio),
      assunto: assunto || '',
      orientacao: orientacao || '',
      contratoId: Number(contratoId),
      atendimentoId: atendimentoId ? BigInt(atendimentoId) : undefined,
      createdAt: createdAt ? new Date(createdAt) : undefined,
      updatedAt: updatedAt ? new Date(updatedAt) : undefined,
      readOnly:
        relatorio.readOnly === true || String(relatorio.readOnly) === 'true'
          ? true
          : false,
    };

    return relatorioDto;
  }

  static updateFieldsToDTO(
    relatorioModel: Partial<RelatorioModel>,
  ): Partial<RelatorioDto> {
    const {
      produtorId,
      tecnicoId,
      numeroRelatorio,
      createdAt,
      updatedAt,
      readOnly,
      contratoId,
      atendimentoId,
      ...relatorio
    } = {
      ...relatorioModel,
    };

    const relatorioDto = {
      ...relatorio,
      produtorId: produtorId ? BigInt(produtorId) : undefined,
      tecnicoId: tecnicoId ? BigInt(tecnicoId) : undefined,
      atendimentoId: atendimentoId ? BigInt(atendimentoId) : undefined,
      numeroRelatorio: numeroRelatorio ? +numeroRelatorio : undefined,
      createdAt: createdAt ? new Date(createdAt) : undefined,
      updatedAt: updatedAt ? new Date(updatedAt) : undefined,
      contratoId: contratoId ? Number(contratoId) : undefined,
      readOnly:
        readOnly === undefined
          ? undefined
          : readOnly === true || String(readOnly) === 'true'
            ? true
            : false,
    };
    return relatorioDto;
  }
}
