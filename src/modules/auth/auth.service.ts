import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { AuditAction } from '../../common/enums/domain.enums';
import type { AuthUser } from '../../common/types/auth-user';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthUserService } from './auth-user.service';
import { randomToken, sha256 } from './token.util';
import type { AccessTokenPayload } from './jwt-auth.guard';

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

export interface IssuedSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: AuthUser;
}

/** Hash de referencia para igualar tiempos cuando el usuario no existe. */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$Zy4o3o0m0kH1pCq0iU3oZ5n6pX9bqJYp0b7c6m3w1fA';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly authUsers: AuthUserService,
  ) {}

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  private findForLogin(identifier: string) {
    const id = identifier.trim().toLowerCase();
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .leftJoinAndSelect('u.role', 'role')
      .leftJoinAndSelect('u.workshop', 'workshop')
      .where([{ username: id }, { email: id }])
      .getOne();
  }

  /** P01: login con bloqueo temporal tras N intentos fallidos (anti fuerza bruta). */
  async login(
    identifier: string,
    password: string,
    client: ClientInfo,
  ): Promise<IssuedSession> {
    const user = await this.findForLogin(identifier);
    const maxFailed = this.config.get<number>('security.maxFailedLogins', 5);
    const lockMinutes = this.config.get<number>('security.lockMinutes', 15);
    const generic = new UnauthorizedException(
      'Usuario o contraseña incorrectos',
    );

    if (!user) {
      await argon2.verify(DUMMY_HASH, password).catch(() => false);
      await this.audit.log({
        action: AuditAction.LOGIN_FAILED,
        entityType: 'Auth',
        username: identifier.slice(0, 160),
        userId: null,
        description: 'Usuario inexistente',
      });
      throw generic;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        `Cuenta bloqueada temporalmente por intentos fallidos. Intente después de ${user.lockedUntil.toISOString()}`,
      );
    }
    const ok = await argon2
      .verify(user.passwordHash, password)
      .catch(() => false);
    if (!ok) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= maxFailed) {
        user.lockedUntil = new Date(Date.now() + lockMinutes * 60_000);
        user.failedLoginAttempts = 0;
      }
      await this.users.update(user.id, {
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil,
      });
      await this.audit.log({
        action: AuditAction.LOGIN_FAILED,
        entityType: 'Auth',
        entityId: user.id,
        userId: user.id,
        username: user.username,
        description: user.lockedUntil
          ? 'Contraseña incorrecta; cuenta bloqueada'
          : 'Contraseña incorrecta',
      });
      throw generic;
    }
    if (!user.active || !user.role.active)
      throw new ForbiddenException('Usuario inactivo');

    await this.users.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });
    // Rehash transparente si cambian los parámetros de argon2.
    if (argon2.needsRehash(user.passwordHash)) {
      await this.users.update(user.id, {
        passwordHash: await AuthService.hashPassword(password),
      });
    }
    const session = await this.issue(user, randomUUID(), client);
    await this.audit.log({
      action: AuditAction.LOGIN,
      entityType: 'Auth',
      entityId: user.id,
      userId: user.id,
      username: user.username,
    });
    return session;
  }

  private async issue(
    user: User,
    family: string,
    client: ClientInfo,
  ): Promise<IssuedSession> {
    const accessTtl = this.config.get<number>('jwt.accessTtl', 900);
    const refreshTtl = this.config.get<number>('jwt.refreshTtl', 604800);
    const payload: AccessTokenPayload = {
      sub: user.id,
      sid: family,
      typ: 'access',
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: accessTtl,
    });
    const refreshToken = randomToken();
    const refreshExpiresAt = new Date(Date.now() + refreshTtl * 1000);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: sha256(refreshToken),
        family,
        expiresAt: refreshExpiresAt,
        userAgent: client.userAgent?.slice(0, 255) ?? null,
        ip: client.ip ?? null,
      }),
    );
    return {
      accessToken,
      expiresIn: accessTtl,
      refreshToken,
      refreshExpiresAt,
      user: AuthUserService.toAuthUser(user, family),
    };
  }

  /**
   * Rotación de refresh token. Si llega un token ya rotado/revocado se asume robo
   * y se revoca toda la familia de la sesión.
   */
  async refresh(
    rawToken: string | undefined,
    client: ClientInfo,
  ): Promise<IssuedSession> {
    if (!rawToken) throw new UnauthorizedException('Sesión no encontrada');
    const token = await this.refreshTokens.findOne({
      where: { tokenHash: sha256(rawToken) },
    });
    if (!token) throw new UnauthorizedException('Sesión inválida');
    if (token.revokedAt || token.rotatedAt) {
      await this.refreshTokens.update(
        { family: token.family },
        { revokedAt: new Date() },
      );
      this.authUsers.invalidateUser(token.userId);
      await this.audit.log({
        action: AuditAction.LOGOUT,
        entityType: 'Auth',
        entityId: token.userId,
        userId: token.userId,
        description: 'Reuso de refresh token detectado: sesión revocada',
      });
      throw new UnauthorizedException('Sesión revocada');
    }
    if (token.expiresAt < new Date())
      throw new UnauthorizedException('Sesión expirada');
    const user = await this.users.findOne({ where: { id: token.userId } });
    if (!user || !user.active)
      throw new UnauthorizedException('Usuario inactivo');

    return this.dataSource.transaction(async (m) => {
      await m.update(RefreshToken, { id: token.id }, { rotatedAt: new Date() });
      const accessTtl = this.config.get<number>('jwt.accessTtl', 900);
      const payload: AccessTokenPayload = {
        sub: user.id,
        sid: token.family,
        typ: 'access',
      };
      const accessToken = await this.jwt.signAsync(payload, {
        expiresIn: accessTtl,
      });
      const refreshToken = randomToken();
      await m.save(
        m.create(RefreshToken, {
          userId: user.id,
          tokenHash: sha256(refreshToken),
          family: token.family,
          // La familia conserva el vencimiento absoluto original (no se extiende sin límite).
          expiresAt: token.expiresAt,
          userAgent: client.userAgent?.slice(0, 255) ?? null,
          ip: client.ip ?? null,
        }),
      );
      return {
        accessToken,
        expiresIn: accessTtl,
        refreshToken,
        refreshExpiresAt: token.expiresAt,
        user: AuthUserService.toAuthUser(user, token.family),
      };
    });
  }

  async logout(user: AuthUser): Promise<void> {
    await this.refreshTokens.update(
      { userId: user.id, family: user.sessionId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    this.authUsers.invalidateUser(user.id);
    await this.audit.log({
      action: AuditAction.LOGOUT,
      entityType: 'Auth',
      entityId: user.id,
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    this.authUsers.invalidateUser(userId);
  }

  async changePassword(
    user: AuthUser,
    current: string,
    next: string,
  ): Promise<void> {
    const entity = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where({ id: user.id })
      .getOneOrFail();
    if (
      !(await argon2.verify(entity.passwordHash, current).catch(() => false))
    ) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (current === next)
      throw new BadRequestException('La nueva contraseña debe ser diferente');
    await this.users.update(user.id, {
      passwordHash: await AuthService.hashPassword(next),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    });
    // Cierra las demás sesiones abiertas del usuario.
    await this.refreshTokens.update(
      { userId: user.id, family: Not(user.sessionId), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    this.authUsers.invalidateUser(user.id);
    await this.audit.log({
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: user.id,
      description: 'Cambio de contraseña por el usuario',
    });
  }

  /** P01 recuperación de acceso: respuesta idéntica exista o no el correo. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findOne({
      where: { email: email.trim().toLowerCase(), active: true },
    });
    if (!user) return;
    const raw = randomToken(32);
    await this.resetTokens.save(
      this.resetTokens.create({
        userId: user.id,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      }),
    );
    const url = `${this.config.get<string>('webUrl')}/restablecer?token=${encodeURIComponent(raw)}`;
    await this.mail.send(
      user.email,
      'Prestige Gold · Recuperación de acceso',
      `<p>Hola ${user.fullName},</p><p>Para restablecer tu contraseña ingresa al siguiente enlace (vence en 30 minutos):</p><p><a href="${url}">${url}</a></p><p>Si no lo solicitaste, ignora este mensaje.</p>`,
      `Hola ${user.fullName}. Restablece tu contraseña (vence en 30 minutos): ${url}`,
    );
    await this.audit.log({
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      username: user.username,
      description: 'Solicitud de recuperación de acceso',
    });
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const token = await this.resetTokens.findOne({
      where: {
        tokenHash: sha256(rawToken),
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!token)
      throw new BadRequestException('El enlace es inválido o ya venció');
    await this.dataSource.transaction(async (m) => {
      await m.update(
        PasswordResetToken,
        { id: token.id },
        { usedAt: new Date() },
      );
      await m.update(
        User,
        { id: token.userId },
        {
          passwordHash: await AuthService.hashPassword(newPassword),
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          mustChangePassword: false,
        },
      );
      await m.update(
        RefreshToken,
        { userId: token.userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    });
    this.authUsers.invalidateUser(token.userId);
    await this.audit.log({
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: token.userId,
      userId: token.userId,
      description: 'Contraseña restablecida con enlace de recuperación',
    });
  }
}
