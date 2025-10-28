import { UsuarioModel } from 'src/@domain/usuario/usuario-model';

interface PerfilDemeter {
  perfil: {
    descricao_perfil: string;
  };
}

interface ger_und_empresa {
  nm_und_empresa: string;
  fk_und_empresa: string;
  id_und_empresa: string;
}

export interface UsuarioGQLOutputDto extends UsuarioModel {
  ger_und_empresa: {
    nm_und_empresa: string;
    id_und_empresa: string;
    ger_und_empresa?: ger_und_empresa;
  };
  perfil_demeter: PerfilDemeter[];
}

export interface UsuarioLoginOutputDto {
  id_usuario: string;
  login_usuario?: string;
  nome_usuario: string | null;
  email_usuario?: string | null;
  celular_usuario?: string | null;
  matricula_usuario?: string | null;
  digito_matricula?: string | null;
  id_und_empresa?: string | null;
  id_reg_empresa?: string | null;
  sexo_usuario?: string | null;
  perfis: string[];
}
