export type ColumnType =
  | 'text'
  | 'grams'
  | 'money'
  | 'number'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'boolean';

export interface ReportColumn {
  key: string;
  label: string;
  type?: ColumnType;
}

/** Formato tabular uniforme: lo consume la web y el exportador a Excel/CSV. */
export interface TabularReport {
  key: string;
  title: string;
  description?: string;
  filters?: Record<string, unknown>;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary?: Record<string, number | string>;
  charts?: Record<string, unknown>;
}
