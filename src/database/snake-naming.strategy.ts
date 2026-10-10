import { DefaultNamingStrategy, NamingStrategyInterface, Table } from 'typeorm';

const snake = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

/**
 * Propiedades camelCase en TS ↔ columnas snake_case en PostgreSQL, sin repetir
 * `name:` en cada @Column.
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(className: string, customName?: string): string {
    return customName ?? snake(className);
  }

  columnName(
    propertyName: string,
    customName: string | undefined,
    prefixes: string[],
  ): string {
    return (
      snake(prefixes.concat('').join('_')) + (customName ?? snake(propertyName))
    );
  }

  relationName(propertyName: string): string {
    return snake(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snake(`${relationName}_${referencedColumnName}`);
  }

  joinTableName(firstTableName: string, secondTableName: string): string {
    return snake(`${firstTableName}_${secondTableName}`);
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snake(`${tableName}_${columnName ?? propertyName}`);
  }

  // Mantiene compatibilidad con la firma de la estrategia por defecto.
  primaryKeyName(tableOrName: Table | string, columnNames: string[]): string {
    return super.primaryKeyName(tableOrName, columnNames);
  }
}
