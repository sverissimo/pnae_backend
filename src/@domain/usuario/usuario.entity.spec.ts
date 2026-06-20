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

  it('identifies ownership when ownerId matches (string)', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({ id_usuario: 'owner' });
    expect(user.isOwnerOf('owner')).toBe(true);
  });

  it('returns false for ownership when ownerId differs', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({ id_usuario: 'owner' });
    expect(user.isOwnerOf('other')).toBe(false);
  });

  it('coerces ownerId across string/number/bigint for ownership', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({ id_usuario: '42' });
    expect(user.isOwnerOf(42)).toBe(true);
    expect(user.isOwnerOf(42n)).toBe(true);
    expect(user.isOwnerOf('42')).toBe(true);
  });

  it('returns false ownership for null/undefined ownerId', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({ id_usuario: 'owner' });
    expect(user.isOwnerOf(null)).toBe(false);
    expect(user.isOwnerOf(undefined)).toBe(false);
  });

  it('isInRegion requires a region and an exact match', () => {
    const { Usuario } = loadModules('admin-1,admin-2');
    const user = new Usuario({ id_usuario: '2', id_reg_empresa: 'G0001' });
    expect(user.isInRegion('G0001')).toBe(true);
    expect(user.isInRegion('G0040')).toBe(false);
    const regionless = new Usuario({ id_usuario: '3' });
    expect(regionless.isInRegion('G0001')).toBe(false);
  });

  describe('hasAccessTo (resource visibility, P2)', () => {
    it('admin sees everything regardless of region/owner', () => {
      const { Usuario } = loadModules('admin-1,dev-9');
      const admin = new Usuario({ id_usuario: 'admin-1', perfis: [] });
      expect(admin.hasAccessTo({ ownerId: 'someone-else', regionId: 'R-X' })).toBe(
        true,
      );
    });

    it('developer (first admin id) sees everything', () => {
      const { Usuario } = loadModules('dev-9,admin-1');
      const dev = new Usuario({ id_usuario: 'dev-9', perfis: [] });
      expect(dev.hasAccessTo({ ownerId: 'someone-else', regionId: 'R-X' })).toBe(
        true,
      );
    });

    it('coordenador regional sees own region', () => {
      const { Usuario, PerfilUsuario } = loadModules('admin-1,dev-9');
      const coord = new Usuario({
        id_usuario: 'coord-1',
        id_reg_empresa: 'R-1',
        perfis: [PerfilUsuario.ADMINISTRADOR2],
      });
      expect(
        coord.hasAccessTo({ ownerId: 'someone-else', regionId: 'R-1' }),
      ).toBe(true);
    });

    it('coordenador regional sees own work even outside their region', () => {
      const { Usuario, PerfilUsuario } = loadModules('admin-1,dev-9');
      const coord = new Usuario({
        id_usuario: 'coord-1',
        id_reg_empresa: 'R-1',
        perfis: [PerfilUsuario.ADMINISTRADOR2],
      });
      expect(
        coord.hasAccessTo({ ownerId: 'coord-1', regionId: 'R-OTHER' }),
      ).toBe(true);
    });

    it('coordenador regional cannot see other-region non-owned', () => {
      const { Usuario, PerfilUsuario } = loadModules('admin-1,dev-9');
      const coord = new Usuario({
        id_usuario: 'coord-1',
        id_reg_empresa: 'R-1',
        perfis: [PerfilUsuario.ADMINISTRADOR2],
      });
      expect(
        coord.hasAccessTo({ ownerId: 'someone-else', regionId: 'R-2' }),
      ).toBe(false);
    });

    it('staff sees only their own work, never by region', () => {
      const { Usuario, PerfilUsuario } = loadModules('admin-1,dev-9');
      const staff = new Usuario({
        id_usuario: 'staff-1',
        id_reg_empresa: 'R-1',
        perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
      });
      expect(staff.hasAccessTo({ ownerId: 'staff-1', regionId: 'R-1' })).toBe(
        true,
      );
      expect(
        staff.hasAccessTo({ ownerId: 'someone-else', regionId: 'R-1' }),
      ).toBe(false);
    });

    it('produtor / other role gets nothing, even when owning', () => {
      const { Usuario } = loadModules('admin-1,dev-9');
      const stranger = new Usuario({
        id_usuario: 'x',
        id_reg_empresa: 'R-1',
        perfis: [],
      });
      expect(stranger.hasAccessTo({ ownerId: 'x', regionId: 'R-1' })).toBe(false);
    });
  });
});
