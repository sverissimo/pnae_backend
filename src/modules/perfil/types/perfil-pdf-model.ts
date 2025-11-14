import { LabelValue } from 'src/modules/files/types';

export type PerfilPDFModel = {
  perfilData: LabelValue[];
  producaoNatura?: LabelValue[];
  producaoIndustrial?: LabelValue[];
};
