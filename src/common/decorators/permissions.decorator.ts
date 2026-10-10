import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse } from '@nestjs/swagger';
import { Permission } from '../enums/permission.enum';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSION_KEY = 'anyPermission';

/** Exige TODOS los permisos indicados. */
export const RequirePermissions = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    ApiBearerAuth(),
    ApiForbiddenResponse({
      description: `Requiere: ${permissions.join(', ')}`,
    }),
  );

/** Exige AL MENOS UNO de los permisos indicados (p. ej. oficina u portal de taller). */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(ANY_PERMISSION_KEY, permissions),
    ApiBearerAuth(),
    ApiForbiddenResponse({
      description: `Requiere alguno de: ${permissions.join(', ')}`,
    }),
  );
