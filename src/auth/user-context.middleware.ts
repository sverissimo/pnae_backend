import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const cookies =
      (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    const token = cookies.auth_token;
    if (!token) return next();
    if (token === process.env.CLIENT_TOKEN) return next();

    try {
      const decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      (req as any).user = decoded;
      // (req as any).user = { ...decoded, id_usuario: 2412 }; // Testing ONLY !!!
      // (req as any).user = { ...decoded, id_usuario: 3138 }; // Testing ONLY !!!
    } catch (_e) {
    } finally {
      next();
    }
  }
}
