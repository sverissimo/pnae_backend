import { LabelValue } from 'src/common/types';

export type PerfilPDFModel = {
  perfilData: LabelValue[];
  producaoNatura?: LabelValue[];
  producaoIndustrial?: LabelValue[];
};
