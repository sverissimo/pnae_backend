import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';

// Whitelist of RelatorioModel fields known to the frozen mobile app.
// Any field outside this list is web-only and must not be sent to mobile,
// otherwise the client errors when parsing unknown properties.
export const MOBILE_RELATORIO_FIELDS = [
  'id',
  'produtorId',
  'tecnicoId',
  'contratoId',
  'numeroRelatorio',
  'assunto',
  'orientacao',
  'pictureURI',
  'assinaturaURI',
  'atendimentoId',
  'atendimentoAnteriorId',
  'outroExtensionista',
  'coordenadas',
  'readOnly',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof RelatorioModel)[];
