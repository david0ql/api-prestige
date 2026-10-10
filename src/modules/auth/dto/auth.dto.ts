import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Política de contraseña: ≥10 caracteres con mayúscula, minúscula, número y símbolo. */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,128}$/;
export const PASSWORD_MESSAGE =
  'La contraseña debe tener al menos 10 caracteres e incluir mayúscula, minúscula, número y símbolo';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Usuario o correo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  username!: string;

  @ApiProperty({ example: 'Prestige.2026!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@prestigegold.local' })
  @IsEmail()
  @MaxLength(160)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @ApiProperty()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}
