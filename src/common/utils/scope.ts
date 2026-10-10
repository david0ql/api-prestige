import { NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../types/auth-user';

/**
 * Aislamiento entre talleres (RN-014, CA-007, RNF-004). Un usuario de taller que
 * intenta acceder a un recurso de otro taller recibe 404 (no se revela que existe).
 */
export function assertWorkshopAccess(user: AuthUser, workshopId: string | null | undefined): void {
  if (user.workshopId && user.workshopId !== workshopId) {
    throw new NotFoundException('Registro no encontrado');
  }
}

/** Devuelve el filtro de taller a aplicar en listados (null = sin restricción). */
export function workshopScope(user: AuthUser): string | null {
  return user.workshopId ?? null;
}
