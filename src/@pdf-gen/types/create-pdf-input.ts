import { PerfilPDFModel } from 'src/modules/perfil/types';
import { RelatorioPDF } from 'src/modules/relatorios/entities/relatorio-pdf.entity';

export type CreatePdfInput = {
  perfilPDFModel: PerfilPDFModel;
  relatorio: RelatorioPDF;
  nome_propriedade: string;
  dados_producao_in_natura: any;
  dados_producao_agro_industria: any;
};
