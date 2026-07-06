import { AtendimentoGraphQLAPI } from './atendimento-api.service';
import {
  atendimentosComRelatorioManualQuery,
  atendimentosManuaisUltimos30DiasQuery,
} from './queries/atendimento-queries';

describe('AtendimentoGraphQLAPI.getAtendimentosComRelatorioDemeter', () => {
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

    const result = await api.getAtendimentosComRelatorioDemeter({
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

    await api.getAtendimentosComRelatorioDemeter({ pageSize: 200 });

    expect(request).toHaveBeenCalledWith(atendimentosComRelatorioManualQuery, {
      pageSize: 200,
      cursor: undefined,
      id_usuario: undefined,
      id_reg_empresa: undefined,
    });
  });
});

describe('AtendimentoGraphQLAPI.getManuaisUltimos30Dias', () => {
  const buildApi = () => {
    const api = Object.create(
      AtendimentoGraphQLAPI.prototype,
    ) as AtendimentoGraphQLAPI;
    const dates = ['2026-07-01'];
    const request = jest
      .fn()
      .mockResolvedValue({ atendimentosManuaisUltimos30Dias: dates });
    (api as any).client = { request };
    return { api, request, dates };
  };

  it('forwards regional scope to the gateway when provided', async () => {
    const { api, request, dates } = buildApi();

    const result = await api.getManuaisUltimos30Dias('G0040');

    expect(request).toHaveBeenCalledWith(atendimentosManuaisUltimos30DiasQuery, {
      id_reg_empresa: 'G0040',
    });
    expect(result).toBe(dates);
  });

  it('sends an unscoped query for admin/developer callers', async () => {
    const { api, request } = buildApi();

    await api.getManuaisUltimos30Dias();

    expect(request).toHaveBeenCalledWith(atendimentosManuaisUltimos30DiasQuery, {
      id_reg_empresa: undefined,
    });
  });
});
