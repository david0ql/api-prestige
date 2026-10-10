import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AuthService, IssuedSession } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
} from './dto/auth.dto';

export const REFRESH_COOKIE = 'pg_rt';

/** Límite de intentos de login por minuto e IP (configurable para pruebas de carga/e2e). */
const loginLimit = () => Number(process.env.LOGIN_THROTTLE_LIMIT ?? 10);

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(expires?: Date): CookieOptions {
    const prefix = this.config.get<string>('apiPrefix', 'api');
    return {
      httpOnly: true,
      secure: this.config.get<string>('nodeEnv') === 'production',
      sameSite: 'strict',
      path: `/${prefix}/auth`,
      expires,
    };
  }

  private client(req: Request) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  /** El refresh token viaja solo en cookie httpOnly; el access token en el cuerpo. */
  private respond(res: Response, s: IssuedSession) {
    res.cookie(
      REFRESH_COOKIE,
      s.refreshToken,
      this.cookieOptions(s.refreshExpiresAt),
    );
    return { accessToken: s.accessToken, expiresIn: s.expiresIn, user: s.user };
  }

  @Public()
  @Throttle({ default: { limit: loginLimit, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'P01 · Inicio de sesión' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.auth.login(dto.username, dto.password, this.client(req)),
    );
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Renueva el access token (rota la cookie de refresco)',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Defensa CSRF adicional: navegadores no envían este header en peticiones cross-site simples.
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      throw new UnauthorizedException('Petición no permitida');
    }
    try {
      const raw = (req.cookies as Record<string, string> | undefined)?.[
        REFRESH_COOKIE
      ];
      return this.respond(res, await this.auth.refresh(raw, this.client(req)));
    } catch (e) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(user);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario actual, rol, taller y permisos' })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('change-password')
  @HttpCode(204)
  @ApiBearerAuth()
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(user, dto.currentPassword, dto.newPassword);
  }

  @Public()
  @Throttle({
    default: {
      limit: () => Number(process.env.FORGOT_THROTTLE_LIMIT ?? 5),
      ttl: 60_000,
    },
  })
  @Post('forgot-password')
  @HttpCode(202)
  @ApiOperation({
    summary: 'P01 · Recuperación de acceso (envía enlace por correo)',
  })
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return {
      message:
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(204)
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
  }
}
