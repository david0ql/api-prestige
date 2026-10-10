import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DocumentSequence } from './entities/document-sequence.entity';

/**
 * Genera consecutivos por prefijo y año dentro de la transacción del llamador,
 * bloqueando la fila (SELECT … FOR UPDATE vía ORM) para evitar duplicados.
 */
@Injectable()
export class SequenceService {
  async next(
    manager: EntityManager,
    prefix: string,
    padding = 5,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const repo = manager.getRepository(DocumentSequence);
    await repo
      .createQueryBuilder()
      .insert()
      .values({ prefix, year, lastValue: 0 })
      .orIgnore()
      .execute();
    const seq = await repo.findOneOrFail({
      where: { prefix, year },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
    });
    seq.lastValue += 1;
    await repo.save(seq);
    return `${prefix}-${year}-${String(seq.lastValue).padStart(padding, '0')}`;
  }
}
