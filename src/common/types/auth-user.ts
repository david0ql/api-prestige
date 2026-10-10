/** Usuario autenticado adjunto a la request por JwtAuthGuard. */
export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roleCode: string;
  roleName: string;
  /** Si el usuario pertenece a un taller, todas sus consultas quedan aisladas a él. */
  workshopId: string | null;
  workshopCode: string | null;
  permissions: string[];
  sessionId: string;
}

export const isWorkshopUser = (u: AuthUser) => !!u.workshopId;
