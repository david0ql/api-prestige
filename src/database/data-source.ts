import 'dotenv/config';
import { DataSource } from 'typeorm';
import configuration from '../config/configuration';
import { buildTypeOrmOptions } from './typeorm.options';

/** DataSource para la CLI de TypeORM (generar/ejecutar migraciones). */
export default new DataSource(buildTypeOrmOptions(configuration().database));
