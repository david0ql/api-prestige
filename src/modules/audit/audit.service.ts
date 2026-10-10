import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { EntityManager, Repository } from 'typeorm';
import { AuditAction } from '../../common/enums/domain.enums';
import type { RequestContextStore } from '../../common/context/request-context';
import { AuditLog } from './entities/audit-log.entity';
import { sanitizeForAudit } from './audit.util';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  description?: string;
  /** Para eventos sin usuario en contexto (login fallido). */
  username?: string;
  userId?: string | null;
}

/** Registro explícito de acciones de negocio en la bitácora (RF-036). */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    private readonly cls: ClsService<RequestContextStore>,
  ) {}

  buildEntry(e: AuditEntry): AuditLog {
    const user = this.cls.isActive() ? this.cls.get('user') : undefined;
    return this.repo.create({
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      before: sanitizeForAudit(e.before),
      after: sanitizeForAudit(e.after),
      description: e.description ?? null,
      userId: e.userId !== undefined ? e.userId : (user?.id ?? null),
      username: e.username ?? user?.username ?? null,
      workshopId: user?.workshopId ?? null,
      ip: this.cls.isActive() ? (this.cls.get('ip') ?? null) : null,
      userAgent: this.cls.isActive()
        ? (this.cls.get('userAgent')?.slice(0, 255) ?? null)
        : null,
      path: this.cls.isActive()
        ? (this.cls.get('path')?.slice(0, 200) ?? null)
        : null,
    });
  }

  /** Guarda en la transacción indicada (si existe) para que sea atómico con el cambio. */
  async log(e: AuditEntry, manager?: EntityManager): Promise<void> {
    const entry = this.buildEntry(e);
    if (manager) await manager.save(AuditLog, entry);
    else await this.repo.save(entry);
  }
}
