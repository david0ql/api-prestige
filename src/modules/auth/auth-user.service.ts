import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import type { AuthUser } from '../../common/types/auth-user';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

/**
 * Resuelve el AuthUser de cada request validando que el usuario siga activo y que
 * su sesión no haya sido revocada (logout/bloqueo surten efecto inmediato).
 * Caché corto en memoria para no consultar la BD en cada petición.
 */
@Injectable()
export class AuthUserService {
  private cache = new Map<string, { user: AuthUser; expires: number }>();
  private static readonly TTL_MS = 10_000;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
  ) {}

  invalidateUser(userId: string): void {
    for (const key of this.cache.keys())
      if (key.startsWith(`${userId}:`)) this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  async resolve(userId: string, sessionId: string): Promise<AuthUser> {
    const key = `${userId}:${sessionId}`;
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.user;

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.active || !user.role?.active) {
      throw new UnauthorizedException('Usuario inactivo');
    }
    const session = await this.tokens.exists({
      where: {
        userId,
        family: sessionId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!session) throw new UnauthorizedException('Sesión finalizada');

    const auth = AuthUserService.toAuthUser(user, sessionId);
    this.cache.set(key, {
      user: auth,
      expires: Date.now() + AuthUserService.TTL_MS,
    });
    return auth;
  }

  static toAuthUser(user: User, sessionId: string): AuthUser {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      roleCode: user.role.code,
      roleName: user.role.name,
      workshopId: user.workshopId,
      workshopCode: user.workshop?.code ?? null,
      // Un usuario de taller nunca hereda permisos de oficina aunque su rol los tenga.
      permissions: user.role.permissions,
      sessionId,
    };
  }
}
