import { UsuarioModel } from 'src/@domain/usuario/usuario-model';

export type RelatorioPDF = {
  id: string;
  produtorId: string | BigInt;
  tecnicoId: string | BigInt;
  contratoId: number;
  nomeProdutor?: string;
  nomeTecnico: string;
  matricula: string;
  numeroRelatorio: number;
  assunto: string;
  orientacao: string;
  produtor?: ProdutorPDFInput;
  pictureURI?: string;
  assinaturaURI?: string;
  municipio?: string;
  outrosExtensionistas?: UsuarioModel[];
  data?: string | Date;
  createdAt: any;
  updatedAt?: any;
} | null;

export type ProdutorPDFInput = {
  nomeProdutor: string;
  cpfProdutor: string;
  dap?: string;
  id_und_empresa: string;
};
