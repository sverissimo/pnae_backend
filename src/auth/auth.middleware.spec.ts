import {
  All,
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  Post,
  Req,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import cookieParser = require('cookie-parser');
import { AuthMiddleware } from './auth.middleware';
import { UserContextMiddleware } from './user-context.middleware';
import { PlainTextExceptionFilter } from 'src/filters/plain-text-exception.filter';

const REPORTING_TOKEN = 'test-reporting-token';
const MOBILE_TOKEN = 'test-mobile-token';
const JWT_SECRET = 'test-jwt-secret';
const ENV_KEYS = ['REPORTING_BEARER_TOKEN', 'CLIENT_TOKEN', 'JWT_SECRET'];

@Controller()
class AuthProbeController {
  @Get('relatorios/dashboard')
  getDashboard(@Req() req: Request) {
    return this.requestAccess(req);
  }

  @Post('relatorios/dashboard')
  postDashboard(@Req() req: Request) {
    return this.requestAccess(req);
  }

  @All([
    'other',
    'relatorios/dashboard/x',
    'relatorios/dashboardx',
    'relatorios',
    'relatorios/all',
    'relatorios/:id',
    'relatorios/pdf/:id',
    'relatorios/manual',
    'relatorios/zip/status',
    'sync/:collection/checkForUpdates',
    'usuario/login',
    'files/:id',
    'cmc',
    'login',
  ])
  otherRoutes(@Req() req: Request) {
    return this.requestAccess(req);
  }

  private requestAccess(req: Request) {
    return {
      reportingAccess: req.reportingAccess === true,
      user: req.user ?? null,
    };
  }
}

@Module({
  imports: [JwtModule.register({ secret: JWT_SECRET })],
  controllers: [AuthProbeController],
})
class AuthProbeModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware, UserContextMiddleware).forRoutes('*');
  }
}

describe('AuthMiddleware under the Nest wildcard mount', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtService;
  let originalEnv: Record<string, string | undefined>;
  let mountedPath: { baseUrl: string; path: string };
  let middlewareSpy: jest.SpyInstance;

  beforeAll(async () => {
    const originalUse = AuthMiddleware.prototype.use;
    middlewareSpy = jest.spyOn(AuthMiddleware.prototype, 'use');
    middlewareSpy.mockImplementation(function (
      this: AuthMiddleware,
      req,
      res,
      next,
    ) {
      mountedPath = { baseUrl: req.baseUrl, path: req.path };
      return originalUse.call(this, req, res, next);
    });

    app = await NestFactory.create(AuthProbeModule, { logger: false });
    app.use(cookieParser());
    app.useGlobalFilters(new PlainTextExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    jwt = app.get(JwtService);
  });

  beforeEach(() => {
    originalEnv = Object.fromEntries(
      ENV_KEYS.map((key) => [key, process.env[key]]),
    );
    process.env.REPORTING_BEARER_TOKEN = REPORTING_TOKEN;
    process.env.CLIENT_TOKEN = MOBILE_TOKEN;
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  afterAll(async () => {
    await app?.close();
    middlewareSpy?.mockRestore();
  });

  const request = (
    path: string,
    method = 'GET',
    headers: Record<string, string> = {},
    body?: string,
  ) => fetch(`${baseUrl}${path}`, { method, headers, body });
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const expectUnauthorized = async (
    response: Awaited<ReturnType<typeof fetch>>,
  ) => {
    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Token inválido ou expirado.');
  };

  it.each([
    '/relatorios/dashboard',
    '/relatorios/dashboard/',
    '/relatorios/dashboard?x=1',
    '/relatorios/dashboard/?x=1',
  ])(
    'accepts header reporting access on GET %s without a user',
    async (path) => {
      const response = await request(path, 'GET', bearer(REPORTING_TOKEN));

      expect(response.status).toBe(200);
      expect(mountedPath).toEqual({
        baseUrl: '/relatorios/dashboard',
        path: '/',
      });
      expect(await response.json()).toEqual({
        reportingAccess: true,
        user: null,
      });
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])(
    'rejects reporting access with %s on the dashboard',
    async (method) => {
      const response = await request(
        '/relatorios/dashboard',
        method,
        bearer(REPORTING_TOKEN),
      );

      expect(response.status).toBe(401);
      expect(await response.text()).toBe(
        method === 'HEAD' ? '' : 'Token inválido ou expirado.',
      );
    },
  );

  it.each([
    '/other',
    '/relatorios/all',
    '/relatorios/dashboard/x',
    '/relatorios/dashboardx',
    '/Relatorios/Dashboard',
    '/relatorios/DASHBOARD',
  ])('rejects reporting access on %s', async (path) => {
    await expectUnauthorized(
      await request(path, 'GET', bearer(REPORTING_TOKEN)),
    );
    expect(mountedPath.baseUrl).toBe(path);
  });

  it('rejects a reporting token supplied only through the cookie', async () => {
    await expectUnauthorized(
      await request('/relatorios/dashboard', 'GET', {
        Cookie: `auth_token=${REPORTING_TOKEN}`,
      }),
    );
  });

  it.each([undefined, ''])(
    'disables reporting access when env is %s',
    async (value) => {
      if (value === undefined) delete process.env.REPORTING_BEARER_TOKEN;
      else process.env.REPORTING_BEARER_TOKEN = value;

      await expectUnauthorized(
        await request('/relatorios/dashboard', 'GET', bearer(REPORTING_TOKEN)),
      );
    },
  );

  it.each([
    'x',
    'x'.repeat(REPORTING_TOKEN.length),
    'x'.repeat(REPORTING_TOKEN.length + 30),
  ])(
    'rejects a wrong token of any length (%s) without a 500',
    async (token) => {
      await expectUnauthorized(
        await request('/relatorios/dashboard', 'GET', bearer(token)),
      );
    },
  );

  it.each([
    ['GET', '/relatorios/dashboard'],
    ['POST', '/relatorios/dashboard'],
    ['POST', '/relatorios'],
    ['GET', '/relatorios?produtorId=42'],
    ['PATCH', '/relatorios/rel-1'],
    ['DELETE', '/relatorios/rel-1'],
    ['POST', '/sync/relatorios/checkForUpdates'],
    ['GET', '/files/file-1'],
  ])('preserves mobile authentication on %s %s', async (method, path) => {
    const response = await request(path, method, bearer(MOBILE_TOKEN));

    expect(response.status).toBe(
      method === 'POST' && path === '/relatorios/dashboard' ? 201 : 200,
    );
    expect(await response.json()).toEqual({
      reportingAccess: false,
      user: null,
    });
  });

  it.each(['/relatorios/dashboard', '/other'])(
    'keeps mobile behavior when reporting and mobile tokens collide on %s',
    async (path) => {
      process.env.REPORTING_BEARER_TOKEN = MOBILE_TOKEN;

      const response = await request(path, 'GET', bearer(MOBILE_TOKEN));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        reportingAccess: false,
        user: null,
      });
    },
  );

  it.each(['header', 'cookie'])(
    'preserves valid JWT claims from the %s',
    async (source) => {
      const token = await jwt.signAsync({
        id_usuario: 'test-user',
        perfis: [],
      });
      const claims = jwt.verify(token);
      const headers: Record<string, string> =
        source === 'header' ? bearer(token) : { Cookie: `auth_token=${token}` };

      const response = await request('/relatorios/dashboard', 'GET', headers);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        reportingAccess: false,
        user: claims,
      });
    },
  );

  it.each(['header', 'cookie'])(
    'rejects an invalid JWT from the %s',
    async (source) => {
      const token = await jwt.signAsync(
        { id_usuario: 'test-user' },
        { secret: 'different-test-secret' },
      );
      const headers: Record<string, string> =
        source === 'header' ? bearer(token) : { Cookie: `auth_token=${token}` };

      await expectUnauthorized(
        await request('/relatorios/dashboard', 'GET', headers),
      );
    },
  );

  it('retains header priority over a valid cookie', async () => {
    const token = await jwt.signAsync({ id_usuario: 'test-user' });

    await expectUnauthorized(
      await request('/relatorios/dashboard', 'GET', {
        ...bearer('invalid-header-token'),
        Cookie: `auth_token=${token}`,
      }),
    );
  });

  it('propagates the reporting marker even when user context loads a valid cookie', async () => {
    const token = await jwt.signAsync({ id_usuario: 'test-user', perfis: [] });

    const response = await request('/relatorios/dashboard', 'GET', {
      ...bearer(REPORTING_TOKEN),
      Cookie: `auth_token=${token}`,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reportingAccess: true,
      user: jwt.verify(token),
    });
  });

  it('keeps no-token requests forbidden with the existing plain-text error', async () => {
    const response = await request('/relatorios/dashboard');

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('É necessária autenticação de usuário.');
  });

  it.each(['Basic test-token', 'Bearer', 'Bearer '])(
    'preserves the malformed-header plain-text error for %s',
    async (Authorization) => {
      const response = await request('/relatorios/dashboard', 'GET', {
        Authorization,
      });

      expect(response.status).toBe(401);
      expect(await response.text()).toBe('Erro na autenticação de usuário.');
    },
  );

  it('preserves the existing mobile-token cookie behavior', async () => {
    const response = await request('/relatorios/dashboard', 'GET', {
      Cookie: `auth_token=${MOBILE_TOKEN}`,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reportingAccess: false,
      user: null,
    });
  });

  it.each([
    '/relatorios/pdf/rel-1',
    '/relatorios/manual',
    '/relatorios/zip/status',
    '/cmc',
    '/login',
    '/usuario/login',
  ])('keeps the public bypass %s without a token', async (path) => {
    const response = await request(path);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reportingAccess: false,
      user: null,
    });
  });

  it('keeps OPTIONS requests public without granting reporting access', async () => {
    const response = await request('/other', 'OPTIONS');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reportingAccess: false,
      user: null,
    });
  });

  it('ignores client-supplied marker-like headers, query parameters, and body', async () => {
    const response = await request(
      '/relatorios/dashboard?reportingAccess=true',
      'POST',
      {
        ...bearer(MOBILE_TOKEN),
        'Content-Type': 'application/json',
        reportingAccess: 'true',
      },
      JSON.stringify({ reportingAccess: true }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      reportingAccess: false,
      user: null,
    });
  });

  it('does not log the configured reporting credential on success or rejection', async () => {
    const logSpies = (['log', 'warn', 'error', 'info', 'debug'] as const).map(
      (method) => jest.spyOn(console, method).mockImplementation(() => {}),
    );
    try {
      const accepted = await request(
        '/relatorios/dashboard',
        'GET',
        bearer(REPORTING_TOKEN),
      );
      expect(accepted.status).toBe(200);
      await accepted.text();
      await expectUnauthorized(
        await request('/other', 'GET', bearer(REPORTING_TOKEN)),
      );

      const logged = logSpies
        .flatMap((spy) => spy.mock.calls)
        .map((args) => args.map(String).join(' '))
        .join('\n');
      expect(logged).not.toContain(REPORTING_TOKEN);
    } finally {
      logSpies.forEach((spy) => spy.mockRestore());
    }
  });
});
