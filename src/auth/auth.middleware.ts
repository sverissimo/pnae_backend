// auth.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.baseUrl.match('/relatorios/pdf')) {
      return next();
    }

    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      return res
        .status(403)
        .json({ message: 'É necessária autenticação de usuário para acessar essa página.' });
    }
    const token = authHeader.split(' ')[1];

    const authToken = process.env.CLIENT_TOKEN;
    if (token !== authToken) {
      return res.status(401).json({ message: 'Autenticação de usuário inválida.' });
    }

    next();
  }
}
