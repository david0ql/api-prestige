import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marca un endpoint como público (sin JWT). Usar con extremo cuidado. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
