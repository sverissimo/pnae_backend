import { Request } from 'express';
import { Usuario } from 'src/@domain/usuario/usuario.entity';

export type AuthenticatedRequest = Request & { user?: Usuario };
