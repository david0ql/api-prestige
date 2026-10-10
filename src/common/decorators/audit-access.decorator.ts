import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACCESS_KEY = 'auditAccess';
/**
 * RF-036: registra en bitácora el ACCESO (lectura) a información crítica.
 * El AuditAccessInterceptor escribe una entrada por cada request exitosa.
 */
export const AuditAccess = (entityType: string) =>
  SetMetadata(AUDIT_ACCESS_KEY, entityType);
