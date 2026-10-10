import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  ANY_PERMISSION_KEY,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import type { AuthUser } from '../types/auth-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets))
      return true;

    const all =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets) ??
      [];
    const any =
      this.reflector.getAllAndOverride<string[]>(ANY_PERMISSION_KEY, targets) ??
      [];
    if (all.length === 0 && any.length === 0) return true;

    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('Sin contexto de usuario');
    const granted = new Set(user.permissions);

    const missing = all.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Permiso requerido: ${missing.join(', ')}`);
    }
    if (any.length > 0 && !any.some((p) => granted.has(p))) {
      throw new ForbiddenException(`Requiere alguno de: ${any.join(', ')}`);
    }
    return true;
  }
}
