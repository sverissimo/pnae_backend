import { AtendimentoModel } from 'src/@domain/atendimento/atendimento-model';
import { ProdutorModel } from 'src/@domain/produtor/produtor-model';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { RelatorioPresentationModel } from '../dto/relatorio.presentation-model';

interface ManyToPresentationModelProps {
  relatorios: RelatorioModel[];
  produtores: ProdutorModel[];
  atendimentos: AtendimentoModel[];
}
export class RelatorioDataMapper {
  static manyToPresentationModel(
    input: ManyToPresentationModelProps,
  ): RelatorioPresentationModel[] {
    const { relatorios, produtores, atendimentos } = input;

    const produtorMap = new Map(
      (produtores || []).map((p) => [p.id_pessoa_demeter, p]),
    );
    const atendimentoMap = new Map(
      (atendimentos || []).map((a: any) => [a.id_at_atendimento, a]),
    );

    return relatorios.map((r) => {
      const produtor = produtorMap.get(r.produtorId);
      const atendimento = atendimentoMap.get(r.atendimentoId);

      this.checkAndUpdateReadOnly(r, atendimento);
      return {
        ...r,
        ...(produtor || {}),
        ...(atendimento || {}),
      };
    });
  }

  private static checkAndUpdateReadOnly(
    relatorio: RelatorioModel,
    atendimento?: AtendimentoModel,
  ): void {
    if (!atendimento) {
      relatorio.readOnly = false;
      return;
    }

    const { ativo, data_validacao, data_sei, data_see, sn_pendencia } =
      atendimento;
    if (
      data_validacao &&
      ativo &&
      (data_sei || data_see || sn_pendencia === 0)
    ) {
      relatorio.readOnly = true;
    } else {
      relatorio.readOnly = false;
    }
  }
}
