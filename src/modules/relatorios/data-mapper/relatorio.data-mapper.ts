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

      // preserve previous behavior: merge produtor, atendimento and regional fields into the returned object
      return {
        ...r,
        ...(produtor || {}),
        ...(atendimento || {}),
      };
    });
  }
}
