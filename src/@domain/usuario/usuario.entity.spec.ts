describe('Usuario entity', () => {
  const originalAllowedUsers = process.env.ALLOWED_USER_IDS;

  type UsuarioConstructor = typeof import('./usuario.entity').Usuario;
  type PerfilUsuarioEnum = typeof import('./perfil-usuario.enum').PerfilUsuario;

  const loadModules = (
    allowedIds = 'admin-1,admin-2',
  ): {
    Usuario: UsuarioConstructor;
    PerfilUsuario: PerfilUsuarioEnum;
  } => {
    jest.resetModules();
    process.env.ALLOWED_USER_IDS = allowedIds;
    const { Usuario } = require('./usuario.entity') as {
      Usuario: UsuarioConstructor;
    };
    const { PerfilUsuario } = require('./perfil-usuario.enum') as {
      PerfilUsuario: PerfilUsuarioEnum;
    };
    return { Usuario, PerfilUsuario };
  };

  afterAll(() => {
    if (originalAllowedUsers === undefined) {
      delete process.env.ALLOWED_USER_IDS;
    } else {
      process.env.ALLOWED_USER_IDS = originalAllowedUsers;
    }
  });

  it('recognizes admins based on allowed id list', () => {
    const { Usuario } = loadModules('alpha,beta');
    const user = new Usuario({ id_usuario: 'beta' });
    expect(user.isAdmin()).toBe(true);
  });

  it('returns false for non-admins', () => {
    const { Usuario } = loadModules('alpha,beta');
    const user = new Usuario({ id_usuario: 'gamma' });
    expect(user.isAdmin()).toBe(false);
  });

  it('detects developer as the first admin id', () => {
    const { Usuario } = loadModules('dev,admin');
    const developer = new Usuario({ id_usuario: 'dev' });
    expect(developer.isDeveloper()).toBe(true);
  });

  it('does not flag other admins as developer', () => {
    const { Usuario } = loadModules('dev,admin');
    const admin = new Usuario({ id_usuario: 'admin' });
    expect(admin.isDeveloper()).toBe(false);
  });

  it('marks staff when user has technical profile only', () => {
    const { Usuario, PerfilUsuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({
      id_usuario: 'regular-user',
      perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
    });
    expect(user.isAdmin()).toBe(false);
    expect(user.isCoordenadorRegional()).toBe(false);
    expect(user.isDeveloper()).toBe(false);
    expect(user.isStaff()).toBe(true);
  });

  it('does not mark staff for administrators', () => {
    const { Usuario, PerfilUsuario } = loadModules('admin-1,admin-2');
    const admin = new Usuario({
      id_usuario: 'admin-1',
      perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
    });
    expect(admin.isStaff()).toBe(false);
    expect(admin.isProdutor()).toBe(false);
    expect(admin.isAdmin()).toBe(true);
  });

  it('identifies producer when no profiles are assigned', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({ id_usuario: 'producer' });
    expect(user.isProdutor()).toBe(true);
  });

  it('is not producer when profiles exist', () => {
    const { Usuario, PerfilUsuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({
      id_usuario: 'technician',
      perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
    });
    expect(user.isProdutor()).toBe(false);
  });

  it('grants access to admins regardless of entity ownership', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const admin = new Usuario({ id_usuario: 'admin-1' });
    expect(
      admin.hasAccessTo({ id_reg_empresa: 'r-123', usuarioId: 'u-9' }),
    ).toBe(true);
  });

  it('grants access when user shares regional company id', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({ id_usuario: '2', id_reg_empresa: 'region-7' });
    expect(user.hasAccessTo({ id_reg_empresa: 'region-7' })).toBe(true);
  });

  it('grants access when user owns the entity', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({ id_usuario: 'owner' });
    expect(user.hasAccessTo({ usuarioId: 'owner' })).toBe(true);
  });

  it('denies access when none of the rules apply', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({
      id_usuario: 'someone',
      id_reg_empresa: 'region-1',
    });
    expect(
      user.hasAccessTo({ id_reg_empresa: 'region-2', usuarioId: 'other-user' }),
    ).toBe(false);
  });

  it('identifies ownership when usuarioId matches', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({ id_usuario: 'owner' });
    expect(user.isOwnerOf({ usuarioId: 'owner' })).toBe(true);
  });

  it('returns false for ownership when usuarioId differs', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({ id_usuario: 'owner' });
    expect(user.isOwnerOf({ usuarioId: 'other' })).toBe(false);
  });
});
