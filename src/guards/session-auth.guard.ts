import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { Usuario } from 'src/modules/usuario/entity/usuario-model';

export interface SessionRequest extends Request {
  session: {
    user?: Partial<Usuario>;
    [key: string]: any;
  };
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<SessionRequest>();

    if (req.session?.user) {
      (req as any).user = req.session.user;
      return true;
    }
    return false;
  }
}
