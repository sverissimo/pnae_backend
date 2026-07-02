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

describe('RestAPI.getArquivos', () => {
  const buildRestAPI = () =>
    new RestAPI({
      get: (key: string) => (key === 'url' ? 'http://gateway' : 'tok'),
    } as unknown as ConfigService);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests only application/pdf for relatório files (docx/msword branches removed)', async () => {
    const restAPI = buildRestAPI();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ arquivo: 'pdf-base64' }),
    } as unknown as Response);

    await expect(
      restAPI.getArquivos({ atendimentoId: '2290036', fileType: 'relatorio' }),
    ).resolves.toEqual({
      arquivo: 'pdf-base64',
      contentType: 'application/pdf',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://gateway/api/getArquivos?atendimentoId=2290036&fileType=application/pdf',
      { headers: { Authorization: 'Bearer tok' } },
    );
  });

  it('tries only the supported image MIME types for foto files (tiff branch removed)', async () => {
    const restAPI = buildRestAPI();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ arquivo: 'png-base64' }),
      } as unknown as Response);

    await expect(
      restAPI.getArquivos({ atendimentoId: '2290036', fileType: 'foto' }),
    ).resolves.toEqual({
      arquivo: 'png-base64',
      contentType: 'image/png',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://gateway/api/getArquivos?atendimentoId=2290036&fileType=image/jpeg',
      { headers: { Authorization: 'Bearer tok' } },
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://gateway/api/getArquivos?atendimentoId=2290036&fileType=image/png',
      { headers: { Authorization: 'Bearer tok' } },
    );
  });

  it('returns null (no fetch beyond the supported set) when no supported file matches', async () => {
    const restAPI = buildRestAPI();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: false, status: 400 } as Response);

    await expect(
      restAPI.getArquivos({ atendimentoId: '2290036', fileType: 'foto' }),
    ).resolves.toBeNull();

    // Exactly the three supported image MIMEs are probed — no image/tiff fallback.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
