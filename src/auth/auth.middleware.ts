// auth.middleware.ts
import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  async use(req: Request, res: any, next: NextFunction) {
    if (
      req.method === 'OPTIONS' || // CORS preflight
      req.baseUrl.match('/relatorios/pdf') ||
      req.baseUrl.match('/relatorios/zip') ||
      req.baseUrl.match('/cmc')
    ) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      throw new ForbiddenException('É necessária autenticação de usuário.');
    }

    const [scheme, token] = authHeader.split(' ');

    if (!token || !/^Bearer$/i.test(scheme)) {
      throw new UnauthorizedException('Erro na autenticação de usuário.');
    }

    // 1) Mobile: static client token still works
    if (token === process.env.CLIENT_TOKEN) {
      return next();
    }

    console.log(
      '🚀 - AuthMiddleware - use - process.env.JWT_SECRET:',
      process.env.JWT_SECRET,
    );
    // 2) Web: verify JWT cryptographically
    try {
      const decoded = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      (req as any).user = decoded; // optional: expose decoded claims to downstream
      return next();
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
