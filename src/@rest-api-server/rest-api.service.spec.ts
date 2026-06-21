import { ConfigService } from '@nestjs/config';
import { RestAPI } from './rest-api.service';

describe('RestAPI atendimento PATCH-status callers (shared patchAtendimentoValidacao helper)', () => {
  const buildRestAPI = () =>
    new RestAPI({
      get: (key: string) => (key === 'url' ? 'http://gateway' : 'tok'),
    } as unknown as ConfigService);

  // Every public caller maps 1:1 to a gateway /api/<route>/:id PATCH. The table
  // locks the shared-helper widening so a miswired route (or a coordenador route
  // broken by the union change) fails here.
  type PatchCaller =
    | 'aprovarAtendimento'
    | 'criarPendenciaAtendimento'
    | 'aprovarSei'
    | 'removerAprovacaoSei';

  const ROUTES: { caller: PatchCaller; path: string }[] = [
    { caller: 'aprovarAtendimento', path: 'aprovarAtendimento' },
    { caller: 'criarPendenciaAtendimento', path: 'criarPendenciaAtendimento' },
    { caller: 'aprovarSei', path: 'aprovarSei' },
    { caller: 'removerAprovacaoSei', path: 'removerAprovacaoSei' },
  ];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(ROUTES)(
    '$caller PATCHes /api/$path/:id with auth headers and resolves on res.ok',
    async ({ caller, path }) => {
      const restAPI = buildRestAPI();
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: true } as Response);

      await expect(restAPI[caller]('99')).resolves.toBeUndefined();

      expect(fetchSpy).toHaveBeenCalledWith(`http://gateway/api/${path}/99`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer tok' },
      });
    },
  );

  it.each(ROUTES)(
    '$caller falls back to "$path/:id failed" when the error body is not parseable',
    async ({ caller, path }) => {
      const restAPI = buildRestAPI();
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      } as unknown as Response);

      await expect(restAPI[caller]('99')).rejects.toMatchObject({
        message: `${path}/99 failed`,
        status: 500,
      });
    },
  );

  it.each(ROUTES)(
    '$caller surfaces the gateway { error } body verbatim (no "[RestAPI]" prefix) with the status',
    async ({ caller }) => {
      const restAPI = buildRestAPI();
      const gatewayMessage =
        'Atendimento inexistente ou ainda não validado pelo coordenador regional.';
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: gatewayMessage }),
      } as unknown as Response);

      await expect(restAPI[caller]('99')).rejects.toMatchObject({
        message: gatewayMessage,
        status: 400,
      });
    },
  );
});
