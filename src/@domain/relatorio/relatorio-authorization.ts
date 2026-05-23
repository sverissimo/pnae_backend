import { Usuario } from 'src/@domain/usuario/usuario.entity';

export interface RelatorioForAuthorization {
  tecnicoId?: string | number | bigint | null;
  id_reg_empresa?: string | null;
}

/**
 * Pure visibility predicate. Same rule used by `/relatorios/all` (list) and
 * `GET /relatorios/:id`, `PATCH /relatorios/:id`, and `DELETE /relatorios/:id`
 * (detail / update / remove) so a user can never reach — or mutate — a
 * relatório the list would hide.
 *
 * - admin / developer       → see everything
 * - coordenadorRegional     → their regional UNION their own work
 * - staff (extensionista)   → only their own relatorios (`tecnicoId`)
 * - anything else           → no access
 */
export function canUserSeeRelatorio(
  r: RelatorioForAuthorization,
  user: Usuario,
): boolean {
  if (user.isAdmin() || user.isDeveloper()) return true;
  const isOwn = String(r.tecnicoId) === String(user.id_usuario);
  if (user.isCoordenadorRegional()) {
    const inRegional =
      !!user.id_reg_empresa && r.id_reg_empresa === user.id_reg_empresa;
    return inRegional || isOwn;
  }
  if (user.isStaff()) return isOwn;
  return false;
}
