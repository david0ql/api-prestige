import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { AuditAction } from '../../common/enums/domain.enums';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';

/** Entidades que no se auditan automáticamente (ruido o la propia bitácora). */
const SKIP = new Set([
  'AuditLog',
  'RefreshToken',
  'PasswordResetToken',
  'DocumentSequence',
  'InventoryBalance',
  'StoryShare',
]);

/**
 * Auditoría automática (RF-036 / RNF-003) de toda creación y edición hecha con el
 * ORM: se escribe en la MISMA transacción, así no hay cambio sin bitácora.
 * Captura el antes (databaseEntity) y el después.
 */
@Injectable()
export class AuditSubscriber implements EntitySubscriberInterface {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly audit: AuditService,
  ) {
    dataSource.subscribers.push(this);
  }

  private name(target: unknown): string {
    if (typeof target === 'function') return target.name;
    return String(target);
  }

  async afterInsert(event: InsertEvent<any>): Promise<void> {
    const type = this.name(event.metadata.target);
    if (SKIP.has(type)) return;
    const entry = this.audit.buildEntry({
      action: AuditAction.CREATE,
      entityType: type,
      entityId: event.entity?.id ?? null,
      after: event.entity,
    });
    await event.manager.save(AuditLog, entry);
  }

  async afterUpdate(event: UpdateEvent<any>): Promise<void> {
    const type = this.name(event.metadata.target);
    if (SKIP.has(type) || !event.entity) return;
    const changed = event.updatedColumns.map((c) => c.propertyName);
    if (
      changed.length === 0 ||
      changed.every((c) => ['updatedAt', 'version'].includes(c))
    )
      return;
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const c of changed) {
      before[c] = event.databaseEntity?.[c];
      after[c] = (event.entity as Record<string, unknown>)[c];
    }
    const entry = this.audit.buildEntry({
      action: AuditAction.UPDATE,
      entityType: type,
      entityId:
        (event.entity as { id?: string }).id ??
        event.databaseEntity?.id ??
        null,
      before,
      after,
    });
    await event.manager.save(AuditLog, entry);
  }
}
