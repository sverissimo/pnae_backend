import { RelatorioDto } from 'src/modules/relatorios/dto/relatorio.dto';
import { RelatorioModel } from './relatorio-model';

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
  }

  toModel(): RelatorioModel {
    return this.relatorio;
  }

  static toModel(relatorioDto: RelatorioDto): RelatorioModel {
    const { produtorId, tecnicoId, numeroRelatorio, createdAt, updatedAt, ...relatorio } =
      relatorioDto;
    const relatorioModel = {
      ...relatorio,
      produtorId: String(produtorId),
      tecnicoId: String(tecnicoId),
      numeroRelatorio: +numeroRelatorio,
      createdAt: createdAt ? createdAt.toISOString() : undefined,
      updatedAt: updatedAt ? updatedAt.toISOString() : undefined,
    };
    return relatorioModel;
  }

  toDto(): RelatorioDto {
    const { produtorId, tecnicoId, numeroRelatorio, createdAt, updatedAt, ...relatorio } =
      this.relatorio;
    const relatorioDto = {
      ...relatorio,
      produtorId: BigInt(produtorId),
      tecnicoId: BigInt(tecnicoId),
      numeroRelatorio: +numeroRelatorio,
      createdAt: createdAt ? new Date(createdAt) : undefined,
      updatedAt: updatedAt ? new Date(updatedAt) : undefined,
      readOnly: relatorio.readOnly === true || String(relatorio.readOnly) === 'true' ? true : false,
    };
    return relatorioDto;
  }

  static updateFieldsToDTO(relatorioModel: Partial<RelatorioModel>): Partial<RelatorioDto> {
    const { produtorId, tecnicoId, numeroRelatorio, createdAt, updatedAt, readOnly, ...relatorio } =
      {
        ...relatorioModel,
      };

    const relatorioDto = {
      ...relatorio,
      produtorId: produtorId ? BigInt(produtorId) : undefined,
      tecnicoId: tecnicoId ? BigInt(tecnicoId) : undefined,
      numeroRelatorio: numeroRelatorio ? +numeroRelatorio : undefined,
      createdAt: createdAt ? new Date(createdAt) : undefined,
      updatedAt: updatedAt ? new Date(updatedAt) : undefined,
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
