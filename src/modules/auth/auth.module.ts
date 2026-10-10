import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthUserService } from './auth-user.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtAuthGuard } from './jwt-auth.guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, PasswordResetToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.accessSecret'),
        signOptions: { algorithm: 'HS256', issuer: 'prestige-gold' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'prestige-gold' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthUserService, JwtAuthGuard],
  exports: [AuthService, AuthUserService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
