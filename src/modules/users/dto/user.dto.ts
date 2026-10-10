import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ALL_PERMISSIONS } from '../../../common/enums/permission.enum';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../../auth/dto/auth.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateUserDto {
  @ApiProperty({ example: 'operaciones2' })
  @Matches(/^[a-zA-Z0-9._-]{3,60}$/, { message: 'Usuario: 3-60 caracteres alfanuméricos, punto, guion' })
  username!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password!: string;

  @ApiProperty()
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({ description: 'Obligatorio para roles de taller' })
  @IsOptional()
  @IsUUID()
  workshopId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password', 'username'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdminResetPasswordDto {
  @ApiProperty()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password!: string;
}

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workshopId?: string;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'SUPERVISOR' })
  @Matches(/^[A-Z0-9_]{2,40}$/, { message: 'Código: mayúsculas, números y guion bajo' })
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isWorkshopRole?: boolean;
}

export class UpdateRoleDto extends PartialType(OmitType(CreateRoleDto, ['code'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
