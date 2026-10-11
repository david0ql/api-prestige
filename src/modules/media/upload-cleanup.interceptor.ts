import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { unlink } from 'node:fs/promises';
import { catchError, Observable, throwError } from 'rxjs';

/**
 * Multer guarda el archivo temporal antes de validar el DTO: si la petición falla en
 * cualquier punto (validación, permisos, reglas), el temporal se elimina.
 */
@Injectable()
export class UploadCleanupInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      catchError((err: unknown) => {
        const path = req.file?.path;
        if (path) void unlink(path).catch(() => undefined);
        return throwError(() => err);
      }),
    );
  }
}
