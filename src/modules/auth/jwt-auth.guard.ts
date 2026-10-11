import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ALLOW_PENDING_PASSWORD_KEY } from '../../common/decorators/allow-pending-password.decorator';
import type { RequestContextStore } from '../../common/context/request-context';
import { AuthUserService } from './auth-user.service';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'access';
}

/** Guard global: exige Bearer JWT válido salvo en endpoints @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly authUsers: AuthUserService,
    private readonly cls: ClsService<RequestContextStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token)
      throw new UnauthorizedException('Token no provisto');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    if (payload.typ !== 'access')
      throw new UnauthorizedException('Token inválido');

    const user = await this.authUsers.resolve(payload.sub, payload.sid);
    (req as Request & { user: unknown }).user = user;
    if (this.cls.isActive()) this.cls.set('user', user);
    // Contraseña inicial/restablecida: solo puede ver su perfil, cambiarla o cerrar sesión.
    if (
      user.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      throw new ForbiddenException({
        error: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Debe cambiar su contraseña antes de continuar',
      });
    return true;
  }
}
