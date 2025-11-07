import { PerfilUsuario } from './perfil-usuario.enum';
import { UsuarioModel } from './usuario-model';

export class Usuario {
  id_usuario?: string;
  login_usuario?: string;
  nome_usuario?: string;
  email_usuario?: string | null;
  celular_usuario?: string | null;
  matricula_usuario?: string | null;
  digito_matricula?: string | null;
  id_und_empresa?: string | null;
  id_reg_empresa?: string | null;
  sexo_usuario?: string | null;
  perfis: PerfilUsuario[];
  private readonly adminUserIds: string[];

  constructor({
    id_usuario,
    login_usuario,
    nome_usuario,
    email_usuario,
    celular_usuario,
    matricula_usuario,
    digito_matricula,
    id_und_empresa,
    id_reg_empresa,
    sexo_usuario,
    perfis = [],
  }: Partial<UsuarioModel>) {
    this.id_usuario = String(id_usuario);
    this.login_usuario = login_usuario;
    this.nome_usuario = nome_usuario;
    this.email_usuario = email_usuario;
    this.celular_usuario = celular_usuario;
    this.matricula_usuario = matricula_usuario;
    this.digito_matricula = digito_matricula;
    this.id_und_empresa = id_und_empresa;
    this.id_reg_empresa = id_reg_empresa;
    this.sexo_usuario = sexo_usuario;
    this.perfis = perfis;
    this.adminUserIds = this.getAdminUserIds();
  }

  private getAdminUserIds(): string[] {
    const ids = process.env.ALLOWED_USER_IDS || '';
    return ids.split(',').map((id) => id.trim());
    // .slice(-1); //test isStaff users
  }

  isAdmin(): boolean {
    return this.adminUserIds.includes(this.id_usuario);
  }

  isDeveloper(): boolean {
    return this.id_usuario === this.adminUserIds[0];
  }

  isCoordenadorRegional(): boolean {
    return (
      !this.isAdmin() && this.perfis.includes(PerfilUsuario.ADMINISTRADOR2)
    );
  }

  isStaff(): boolean {
    return (
      !this.isAdmin() &&
      !this.isCoordenadorRegional() &&
      this?.perfis?.length > 0 &&
      this.perfis.includes(PerfilUsuario.MOD_ATIV_TECNICO)
    );
  }

  isProdutor(): boolean {
    return !this?.perfis || this?.perfis?.length === 0;
  }

  hasAccessTo(
    entity: {
      id_reg_empresa?: string | null;
      usuarioId?: string | null;
    } & Object,
  ): boolean {
    return (
      this.isAdmin() ||
      this.id_reg_empresa === entity?.id_reg_empresa ||
      this.id_usuario === entity?.usuarioId
    );
  }

  isOwnerOf(entity: Record<string, any>): boolean {
    return (
      this.id_usuario === entity?.usuarioId ||
      this.id_usuario === entity?.tecnicoId ||
      this.id_usuario === entity?.id_usuario
    );
  }
}
