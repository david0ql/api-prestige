import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { EntityNotFoundError, OptimisticLockVersionMismatchError, QueryFailedError } from 'typeorm';

/**
 * Formato de error uniforme. Nunca filtra detalles internos (stack/SQL) al cliente;
 * traduce errores de integridad de PostgreSQL a 409 legibles.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let error = 'Internal Server Error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        error = (b.error as string) ?? exception.name;
        details = b.details;
      }
    } else if (exception instanceof EntityNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      message = 'Registro no encontrado';
      error = 'Not Found';
    } else if (exception instanceof OptimisticLockVersionMismatchError) {
      status = HttpStatus.CONFLICT;
      message = 'El registro fue modificado por otro usuario. Recargue e intente de nuevo.';
      error = 'Conflict';
    } else if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as { code?: string })?.code;
      if (code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'Ya existe un registro con ese valor único';
        error = 'Conflict';
      } else if (code === '23503') {
        status = HttpStatus.CONFLICT;
        message = 'La operación viola una referencia entre registros';
        error = 'Conflict';
      } else if (code === '22P02') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Identificador o valor con formato inválido';
        error = 'Bad Request';
      } else {
        this.logger.error(`SQL error en ${request.method} ${request.url}: ${exception.message}`);
      }
    } else {
      this.logger.error(
        `Excepción no controlada en ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      ...(details !== undefined ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
