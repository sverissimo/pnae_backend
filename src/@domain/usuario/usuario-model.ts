import { PerfilUsuario } from './perfil-usuario.enum';

export interface UsuarioModel {
  id_usuario: string;
  login_usuario: string;
  nome_usuario?: string | null;
  email_usuario?: string | null;
  celular_usuario?: string | null;
  token_demeter: string;
  data_cadastro: Date;
  data_expiracao_token_demeter: Date;
  ativo: boolean;
  cpf_usuario?: string | null;
  matricula_usuario?: string | null;
  digito_matricula?: string | null;
  situacao_emater?: string | null;
  id_und_empresa?: string | null;
  id_cargo?: string | null;
  orgao_classe?: string | null;
  sexo_usuario?: string | null;
  dt_update_record?: Date | null;
  id_reg_empresa?: string | null;
  perfis: PerfilUsuario[];
}
