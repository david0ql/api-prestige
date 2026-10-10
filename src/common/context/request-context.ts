import type { ClsStore } from 'nestjs-cls';
import type { AuthUser } from '../types/auth-user';

/**
 * Contexto por request (AsyncLocalStorage vía nestjs-cls). Lo usa la auditoría para
 * saber quién hizo el cambio sin pasar el usuario por cada capa.
 */
export interface RequestContextStore extends ClsStore {
  user?: AuthUser;
  ip?: string;
  userAgent?: string;
  path?: string;
}
