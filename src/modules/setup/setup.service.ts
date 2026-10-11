import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DataSource } from 'typeorm';
import { seedBase, seedDemo } from '../../database/seeds/seeder';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { Material } from '../masters/entities/material.entity';
import { Workshop } from '../masters/entities/workshop.entity';
import { ProductionOrder } from '../production/entities/production-order.entity';
import { User } from '../users/entities/user.entity';

/**
 * Carga inicial de datos por API: solo con el token de instalación y solo sobre una base vacía.
 * Nunca sobrescribe datos existentes.
 */
@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);
  private running = false;

  constructor(
    private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {}

  /** La base tiene datos si existe cualquier usuario, maestro o movimiento. */
  async hasData(): Promise<boolean> {
    const m = this.ds.manager;
    const counts = await Promise.all([
      m.count(User),
      m.count(Workshop),
      m.count(Material),
      m.count(ProductionOrder),
      m.count(InventoryMovement),
    ]);
    return counts.some((c) => c > 0);
  }

  async status() {
    return { initialized: await this.hasData(), seedEnabled: !!this.token() };
  }

  private token(): string {
    return process.env.SETUP_TOKEN ?? '';
  }

  private assertToken(given: string | undefined) {
    const expected = this.token();
    if (!expected)
      throw new NotFoundException(
        'La carga inicial por API no está habilitada',
      );
    // Comparación en tiempo constante sobre el hash (longitudes iguales).
    const a = createHash('sha256')
      .update(given ?? '')
      .digest();
    const b = createHash('sha256').update(expected).digest();
    if (!given || !timingSafeEqual(a, b))
      throw new UnauthorizedException('Token de instalación inválido');
  }

  async seed(token: string | undefined, demo = false) {
    this.assertToken(token);
    const production = this.config.get<string>('nodeEnv') === 'production';
    if (demo && production && process.env.SETUP_ALLOW_DEMO !== 'true')
      throw new ForbiddenException(
        'Los datos de demostración no se cargan en producción (SETUP_ALLOW_DEMO=true para permitirlo)',
      );
    if (this.running)
      throw new ConflictException('Ya hay una carga inicial en curso');
    this.running = true;
    try {
      if (await this.hasData())
        throw new ConflictException({
          error: 'ALREADY_INITIALIZED',
          message: 'La base ya tiene datos: la carga inicial no se ejecuta',
        });
      const password =
        process.env.SEED_ADMIN_PASSWORD ??
        this.config.get<string>('seed.adminPassword', '');
      if (
        production &&
        (!process.env.SEED_ADMIN_PASSWORD || password === 'Prestige.2026!')
      )
        throw new ForbiddenException(
          'Defina SEED_ADMIN_PASSWORD (contraseña inicial del administrador) para producción',
        );
      await seedBase(this.ds, password, process.env.SEED_ADMIN_EMAIL);
      if (demo) await seedDemo(this.ds, password);
      this.logger.log(
        `Carga inicial completada${demo ? ' (con demostración)' : ''}`,
      );
      return {
        seeded: true,
        demo,
        admin: { username: 'admin', mustChangePassword: production },
      };
    } finally {
      this.running = false;
    }
  }
}
