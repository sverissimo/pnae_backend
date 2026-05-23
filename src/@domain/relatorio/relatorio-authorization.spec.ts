import { canUserSeeRelatorio } from './relatorio-authorization';
import { Usuario } from '../usuario/usuario.entity';
import { PerfilUsuario } from '../usuario/perfil-usuario.enum';

const ADMIN_ID = 'admin-1';
const STAFF_ID = 'staff-1';
const COORD_ID = 'coord-1';

beforeAll(() => {
  process.env.ALLOWED_USER_IDS = `${ADMIN_ID},dev-9`;
});

function makeUser(overrides: Partial<Usuario>): Usuario {
  return new Usuario({
    id_usuario: STAFF_ID,
    perfis: [PerfilUsuario.MOD_ATIV_TECNICO],
    ...(overrides as any),
  });
}

describe('canUserSeeRelatorio', () => {
  it('admin sees everything regardless of regional/owner', () => {
    const admin = makeUser({ id_usuario: ADMIN_ID, perfis: [] });
    expect(
      canUserSeeRelatorio(
        { tecnicoId: 'someone-else', id_reg_empresa: 'R-X' },
        admin,
      ),
    ).toBe(true);
  });

  it('coordenadorRegional sees own regional', () => {
    const coord = makeUser({
      id_usuario: COORD_ID,
      id_reg_empresa: 'R-1',
      perfis: [PerfilUsuario.ADMINISTRADOR2],
    });
    expect(
      canUserSeeRelatorio(
        { tecnicoId: 'someone-else', id_reg_empresa: 'R-1' },
        coord,
      ),
    ).toBe(true);
  });

  it('coordenadorRegional sees own work even outside regional', () => {
    const coord = makeUser({
      id_usuario: COORD_ID,
      id_reg_empresa: 'R-1',
      perfis: [PerfilUsuario.ADMINISTRADOR2],
    });
    expect(
      canUserSeeRelatorio(
        { tecnicoId: COORD_ID, id_reg_empresa: 'R-OTHER' },
        coord,
      ),
    ).toBe(true);
  });

  it('coordenadorRegional cannot see other-regional non-owned', () => {
    const coord = makeUser({
      id_usuario: COORD_ID,
      id_reg_empresa: 'R-1',
      perfis: [PerfilUsuario.ADMINISTRADOR2],
    });
    expect(
      canUserSeeRelatorio(
        { tecnicoId: 'someone-else', id_reg_empresa: 'R-2' },
        coord,
      ),
    ).toBe(false);
  });

  it('staff sees only their own relatorios', () => {
    const staff = makeUser({ id_usuario: STAFF_ID });
    expect(
      canUserSeeRelatorio(
        { tecnicoId: STAFF_ID, id_reg_empresa: 'R-1' },
        staff,
      ),
    ).toBe(true);
    expect(
      canUserSeeRelatorio(
        { tecnicoId: 'someone-else', id_reg_empresa: 'R-1' },
        staff,
      ),
    ).toBe(false);
  });

  it('handles string vs number tecnicoId equality', () => {
    const staff = makeUser({ id_usuario: '42' });
    expect(canUserSeeRelatorio({ tecnicoId: 42 }, staff)).toBe(true);
  });

  it('non-staff non-coordinator non-admin gets nothing', () => {
    const stranger = new Usuario({ id_usuario: 'x', perfis: [] });
    expect(
      canUserSeeRelatorio(
        { tecnicoId: 'x', id_reg_empresa: 'R-1' },
        stranger,
      ),
    ).toBe(false);
  });
});
