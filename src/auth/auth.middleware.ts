// auth.middleware.ts
import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest } from './types/authenticated-request';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  async use(req: Request, res: any, next: NextFunction) {
    if (
      req.method === 'OPTIONS' || // CORS preflight
      req.baseUrl.match('/relatorios/pdf') ||
      req.baseUrl.match('/relatorios/zip') ||
      req.baseUrl.match('/cmc') ||
      req.baseUrl.match('/login')
    ) {
      return next();
    }

    const cookies =
      (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    const authHeader = req.headers['authorization'];
    let token: string | undefined;
    let tokenSource: 'header' | 'cookie' | undefined;

    if (authHeader) {
      const [scheme, value] = authHeader.split(' ');
      if (!value || !/^Bearer$/i.test(scheme)) {
        throw new UnauthorizedException('Erro na autenticação de usuário.');
      }
      token = value;
      tokenSource = 'header';
    } else if (cookies.auth_token) {
      token = cookies.auth_token;
      tokenSource = 'cookie';
    }

    if (!token) {
      throw new ForbiddenException('É necessária autenticação de usuário.');
    }

    // if (tokenSource === 'header' && typeof res.cookie === 'function') {
    //   res.cookie('auth_token', token, {
    //     httpOnly: true,
    //     sameSite: 'lax',
    //     secure: process.env.NODE_ENV === 'production',
    //   });
    // }

    // 1) Mobile: static client token still works
    if (token === process.env.CLIENT_TOKEN) {
      return next();
    }

    // 2) Web: verify JWT cryptographically
    try {
      const decoded = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      (req as AuthenticatedRequest).user = decoded; // optional: expose decoded claims to downstream
      return next();
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
