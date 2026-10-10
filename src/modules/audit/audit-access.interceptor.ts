import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_ACCESS_KEY } from '../../common/decorators/audit-access.decorator';
import { AuditAction } from '../../common/enums/domain.enums';
import { AuditService } from './audit.service';

/** Registra accesos de lectura a información crítica marcada con @AuditAccess. */
@Injectable()
export class AuditAccessInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entityType = this.reflector.get<string>(
      AUDIT_ACCESS_KEY,
      context.getHandler(),
    );
    if (!entityType) return next.handle();
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => {
        void this.audit.log({
          action: AuditAction.ACCESS,
          entityType,
          entityId: req.params?.id ?? null,
          description: `${req.method} ${req.originalUrl ?? req.url}`.slice(
            0,
            300,
          ),
        });
      }),
    );
  }
}
