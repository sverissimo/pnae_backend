import { PerfilPDFModel } from 'src/modules/perfil/types';
import { RelatorioPDF } from 'src/modules/relatorios/entities/relatorio-pdf.entity';

export type CreatePdfInput = {
  perfilPDFModel: PerfilPDFModel;
  relatorio: RelatorioPDF;
  nome_propriedade: string;
  dados_producao_in_natura: any;
  dados_producao_agro_industria: any;
};

export type ManualPdfInput = {
  perfilPDFModel: PerfilPDFModel | null;
  produtor: {
    nomeProdutor: string;
    cpf: string;
    caf: string | null;
    id_und_empresa: string | null;
  };
  atendimento: {
    atendimentoId: string;
    data: string | null;
    id_und_empresa: string | null;
    produtorId: string;
    propriedadeId: string | null;
    tecnicoId: string | null;
  };
  nome_propriedade: string | null;
  dados_producao_in_natura: any;
  dados_producao_agro_industria: any;
  possuiArquivos: boolean;
};
