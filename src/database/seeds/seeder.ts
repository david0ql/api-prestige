import * as argon2 from 'argon2';
import { DataSource, EntityManager, In } from 'typeorm';
import { LocationType } from '../../common/enums/domain.enums';
import { SYSTEM_ROLES } from '../../common/enums/system-roles';
import { TechnicalSheet } from '../../modules/catalog/entities/technical-sheet.entity';
import { ConsumptionStandard } from '../../modules/masters/entities/consumption-standard.entity';
import { Customer } from '../../modules/masters/entities/customer.entity';
import { FinanceCategory } from '../../modules/masters/entities/finance-category.entity';
import { LaborRate } from '../../modules/masters/entities/labor-rate.entity';
import { Location } from '../../modules/masters/entities/location.entity';
import { Material } from '../../modules/masters/entities/material.entity';
import { MaterialCategory } from '../../modules/masters/entities/material-category.entity';
import { PaymentMethod } from '../../modules/masters/entities/payment-method.entity';
import { Product } from '../../modules/masters/entities/product.entity';
import { ProductFamily } from '../../modules/masters/entities/product-family.entity';
import { ProductVariant } from '../../modules/masters/entities/product-variant.entity';
import { ProductWorkshop } from '../../modules/masters/entities/product-workshop.entity';
import { ProductionStage } from '../../modules/masters/entities/production-stage.entity';
import { SystemParameter } from '../../modules/masters/entities/system-parameter.entity';
import { TechnicalVariable } from '../../modules/masters/entities/technical-variable.entity';
import { Unit } from '../../modules/masters/entities/unit.entity';
import { Workshop } from '../../modules/masters/entities/workshop.entity';
import { Role } from '../../modules/users/entities/role.entity';
import { User } from '../../modules/users/entities/user.entity';
import * as D from './seed-data';

/** Inserta o actualiza por clave natural (idempotente: el seed puede repetirse). */
async function upsert<T extends object>(
  m: EntityManager,
  entity: new () => T,
  where: Partial<T>,
  data: Partial<T>,
): Promise<T> {
  const repo = m.getRepository(entity);
  const found = await repo.findOne({ where: where as never });
  if (found) {
    return repo.save(repo.merge(found, data as never));
  }
  return repo.save(repo.create({ ...where, ...data } as never) as T);
}

export async function seedBase(ds: DataSource, adminPassword: string) {
  await ds.transaction(async (m) => {
    for (const [code, r] of Object.entries(SYSTEM_ROLES)) {
      await upsert(
        m,
        Role,
        { code },
        {
          name: r.name,
          description: r.description,
          permissions: r.permissions,
          isSystem: true,
          isWorkshopRole: !!r.isWorkshopRole,
          active: true,
        },
      );
    }
    for (const u of D.UNITS) await upsert(m, Unit, { code: u.code }, u);
    for (const c of D.CATEGORIES)
      await upsert(m, MaterialCategory, { code: c.code }, c);
    for (const l of D.LOCATIONS) await upsert(m, Location, { code: l.code }, l);
    for (const p of D.PAYMENT_METHODS)
      await upsert(m, PaymentMethod, { code: p.code }, p);
    for (const f of D.FINANCE_CATEGORIES)
      await upsert(m, FinanceCategory, { code: f.code }, f);
    for (const p of D.PARAMETERS) {
      const exists = await m.findOne(SystemParameter, {
        where: { key: p.key },
      });
      if (!exists) await m.save(SystemParameter, m.create(SystemParameter, p));
    }
    const admin = await m.findOne(User, { where: { username: 'admin' } });
    if (!admin) {
      const role = await m.findOneOrFail(Role, { where: { code: 'ADMIN' } });
      await m.save(
        User,
        m.create(User, {
          username: 'admin',
          email: 'admin@prestigegold.local',
          fullName: 'Administrador Prestige Gold',
          roleId: role.id,
          passwordHash: await argon2.hash(adminPassword, {
            type: argon2.argon2id,
          }),
          mustChangePassword: false,
        }),
      );
    }
  });
}

export async function seedDemo(ds: DataSource, password: string) {
  await ds.transaction(async (m) => {
    const gram = await m.findOneOrFail(Unit, { where: { code: 'g' } });
    const cats = new Map(
      (await m.find(MaterialCategory)).map((c) => [c.code, c]),
    );
    for (const mat of D.DEMO_MATERIALS) {
      const { category, ...rest } = mat;
      await upsert(
        m,
        Material,
        { code: mat.code },
        { ...rest, categoryId: cats.get(category)!.id, baseUnitId: gram.id },
      );
    }
    const materials = new Map((await m.find(Material)).map((x) => [x.code, x]));
    for (const f of D.DEMO_FAMILIES)
      await upsert(m, ProductFamily, { code: f.code }, f);
    const families = new Map(
      (await m.find(ProductFamily)).map((x) => [x.code, x]),
    );
    for (const w of D.DEMO_WORKSHOPS) {
      const ws = await upsert(m, Workshop, { code: w.code }, w);
      await upsert(
        m,
        Location,
        { code: `TALLER-${w.code}` },
        {
          name: `Custodia taller ${w.name}`,
          type: LocationType.WORKSHOP,
          workshopId: ws.id,
        },
      );
    }
    const workshops = new Map((await m.find(Workshop)).map((x) => [x.code, x]));
    for (const s of D.DEMO_STAGES) {
      const { families: fam, ...rest } = s;
      const stage = await upsert(
        m,
        ProductionStage,
        { code: s.code },
        { mandatory: true, isFinal: false, ...rest },
      );
      stage.families = (fam ?? []).map((c) => families.get(c)!);
      await m.save(ProductionStage, stage);
    }
    for (const v of D.DEMO_VARIABLES) {
      const { families: fam, ...rest } = v;
      const variable = await upsert(
        m,
        TechnicalVariable,
        { code: v.code },
        { options: [], requiredOnFinish: false, ...rest },
      );
      variable.families = (fam ?? []).map((c) => families.get(c)!);
      await m.save(TechnicalVariable, variable);
    }
    const adminRole = await m.findOneOrFail(Role, { where: { code: 'ADMIN' } });
    const admin = await m.findOneOrFail(User, {
      where: { roleId: adminRole.id },
    });
    for (const p of D.DEMO_PRODUCTS) {
      const product = await upsert(
        m,
        Product,
        { code: p.code },
        {
          name: p.name,
          familyId: families.get(p.family)!.id,
          targetPurity: p.targetPurity,
          purityTolerance: p.purityTolerance,
          requiresPurityCheck: true,
          requiresQualityCheck: true,
          lossTolerancePct: p.lossTolerancePct,
          outputMaterialId: (p as { output?: string }).output
            ? materials.get((p as { output?: string }).output!)!.id
            : null,
          standardWeight: p.sheet.standardWeight,
        },
      );
      for (const code of p.workshops) {
        await upsert(
          m,
          ProductWorkshop,
          { productId: product.id, workshopId: workshops.get(code)!.id },
          { enabled: true },
        );
      }
      for (const s of p.standards) {
        await upsert(
          m,
          ConsumptionStandard,
          { productId: product.id, materialId: materials.get(s.material)!.id },
          {
            basis: s.basis,
            quantity: s.quantity,
            tolerancePct: s.tolerancePct,
            active: true,
          },
        );
      }
      for (const v of (p as { variants?: { code: string; name: string }[] })
        .variants ?? []) {
        await upsert(
          m,
          ProductVariant,
          { productId: product.id, code: v.code },
          { name: v.name },
        );
      }
      if (product.currentSheetVersion === 0) {
        await m.save(
          TechnicalSheet,
          m.create(TechnicalSheet, {
            productId: product.id,
            versionNumber: 1,
            ...p.sheet,
            targetPurity: p.targetPurity,
            purityTolerance: p.purityTolerance,
            changeReason: 'Ficha inicial (parametrización Fase 0)',
            createdById: admin.id,
          }),
        );
        await m.update(Product, { id: product.id }, { currentSheetVersion: 1 });
      }
    }
    for (const r of D.DEMO_LABOR_RATES) {
      const exists = await m.findOne(LaborRate, {
        where: { workshopId: workshops.get(r.workshop)!.id, basis: r.basis },
      });
      if (!exists)
        await m.save(
          LaborRate,
          m.create(LaborRate, {
            workshopId: workshops.get(r.workshop)!.id,
            basis: r.basis,
            rate: r.rate,
            validFrom: '2026-01-01',
          }),
        );
    }
    for (const c of D.DEMO_CUSTOMERS)
      await upsert(
        m,
        Customer,
        { documentType: c.documentType, documentNumber: c.documentNumber },
        c,
      );
    const roles = new Map(
      (
        await m.find(Role, {
          where: { code: In(D.DEMO_USERS.map((u) => u.role)) },
        })
      ).map((r) => [r.code, r]),
    );
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    for (const u of D.DEMO_USERS) {
      const exists = await m.findOne(User, { where: { username: u.username } });
      if (exists) continue;
      await m.save(
        User,
        m.create(User, {
          username: u.username,
          email: u.email,
          fullName: u.fullName,
          roleId: roles.get(u.role)!.id,
          workshopId: u.workshop ? workshops.get(u.workshop)!.id : null,
          passwordHash: hash,
          mustChangePassword: false,
        }),
      );
    }
  });
}
