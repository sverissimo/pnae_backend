import { AtendimentoGraphQLAPI } from './atendimento-api.service';
import { atendimentosComRelatorioManualQuery } from './queries/atendimento-queries';

describe('AtendimentoGraphQLAPI.getAtendimentosComRelatorioManual', () => {
  const buildApi = () => {
    const api = Object.create(
      AtendimentoGraphQLAPI.prototype,
    ) as AtendimentoGraphQLAPI;
    const page = { items: [], pageSize: 200, nextCursor: null, hasMore: false };
    const request = jest
      .fn()
      .mockResolvedValue({ atendimentosComRelatorioManual: page });
    (api as any).client = { request };
    return { api, request, page };
  };

  // Regression guard: the authorization scope is derived in the controller and
  // threaded through the service, but it only takes effect if these variables
  // actually reach the gateway. The resolver reads id_usuario/id_reg_empresa
  // strictly from the query args, so dropping them here = unscoped (everyone
  // sees everything) behind otherwise-green tests.
  it('forwards the full scope (pageSize, cursor, id_usuario, id_reg_empresa) to the gateway', async () => {
    const { api, request, page } = buildApi();

    const result = await api.getAtendimentosComRelatorioManual({
      pageSize: 200,
      cursor: '1980461',
      id_usuario: '2',
      id_reg_empresa: 'G0040',
    });

    expect(request).toHaveBeenCalledWith(atendimentosComRelatorioManualQuery, {
      pageSize: 200,
      cursor: '1980461',
      id_usuario: '2',
      id_reg_empresa: 'G0040',
    });
    expect(result).toBe(page);
  });

  it('sends no scope for admin/developer (id_usuario/id_reg_empresa absent)', async () => {
    const { api, request } = buildApi();

    await api.getAtendimentosComRelatorioManual({ pageSize: 200 });

    expect(request).toHaveBeenCalledWith(atendimentosComRelatorioManualQuery, {
      pageSize: 200,
      cursor: undefined,
      id_usuario: undefined,
      id_reg_empresa: undefined,
    });
  });
});
