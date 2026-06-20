import { PerfilUsuario } from './perfil-usuario.enum';
import { UsuarioModel } from './usuario-model';

export type UsuarioRole = 'admin' | 'coordenadorRegional' | 'staff' | 'other';

const SIMULATE_USER: Partial<Usuario> | null =
  // process.env.NODE_ENV !== 'production'
  false // --> disable simulation
    ? {
        perfis: [PerfilUsuario.MOD_ATIV_TECNICO, PerfilUsuario.ADMINISTRADOR2], // Simulate staff user with both profiles
        id_reg_empresa: 'G0001',
        // id_reg_empresa: 'G0040',
        id_usuario: process.env.ALLOWED_USER_IDS?.split(',')[1] || '1', // Simulate the first admin user
        // id_usuario: '2413',
      }
    : null;

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
    if (SIMULATE_USER) Object.assign(this, SIMULATE_USER); // Simulate staff user for testing
  }

  private getAdminUserIds(): string[] {
    const ids = process.env.ALLOWED_USER_IDS || '';
    const adminIds = ids.split(',').map((id) => id.trim());
    if (SIMULATE_USER) return adminIds.slice(-1); //test isStaff users
    return adminIds;
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

  getRole(): UsuarioRole {
    if (this.isCoordenadorRegional()) return 'coordenadorRegional';
    if (this.isAdmin() || this.isDeveloper()) return 'admin';
    if (this.isStaff()) return 'staff';
    return 'other';
  }

  isOwnerOf(ownerId?: string | number | bigint | null): boolean {
    if (ownerId === null || ownerId === undefined) return false;
    return String(this.id_usuario) === String(ownerId);
  }

  isInRegion(regionId?: string | null): boolean {
    return !!this.id_reg_empresa && this.id_reg_empresa === regionId;
  }

  // Resource visibility only; capability (role) is gated separately by the route.
  hasAccessTo({
    ownerId,
    regionId,
  }: {
    ownerId?: string | number | bigint | null;
    regionId?: string | null;
  } = {}): boolean {
    if (this.isAdmin() || this.isDeveloper()) return true;
    if (this.isCoordenadorRegional()) {
      return this.isInRegion(regionId) || this.isOwnerOf(ownerId);
    }
    if (this.isStaff()) return this.isOwnerOf(ownerId);
    return false;
  }
}
