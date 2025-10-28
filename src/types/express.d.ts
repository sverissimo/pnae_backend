import 'express';
import { Usuario } from '../@domain/usuario/usuario.entity';

declare module 'express-serve-static-core' {
  interface Request {
    user?: Usuario;
  }
}
