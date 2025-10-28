import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Usuario } from 'src/@domain/usuario/usuario.entity';
import { UsuarioModel } from 'src/@domain/usuario/usuario-model';

@Injectable()
export class UserHydrationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: Usuario | Partial<UsuarioModel> }>();
    if (req?.user && !(req.user instanceof Usuario)) {
      req.user = new Usuario(req.user as Partial<UsuarioModel>);
    }
    return next.handle();
  }
}
