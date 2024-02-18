import { LabelValue } from 'src/common/files/types';

export type PerfilPDFModel = {
  perfilData: LabelValue[];
  producaoNatura?: LabelValue[];
  producaoIndustrial?: LabelValue[];
};
