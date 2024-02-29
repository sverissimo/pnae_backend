export class CreateAtendimentoDto {
  id_usuario: string;
  id_und_empresa: string;
  link_pdf: string;
  id_pessoa_demeter: string;
  id_pl_propriedade: string;
  id_at_anterior?: string;
  numero_relatorio?: string;
}
