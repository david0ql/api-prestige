/**
 * Catálogo de permisos. Los roles (configurables en Administración) agrupan permisos;
 * los endpoints exigen permisos, nunca nombres de rol (mínimo privilegio).
 */
export enum Permission {
  // Administración
  USERS_MANAGE = 'users.manage',
  ROLES_MANAGE = 'roles.manage',
  PARAMS_MANAGE = 'params.manage',
  AUDIT_READ = 'audit.read',
  REVERSALS_AUTHORIZE = 'reversals.authorize',

  // Maestros y catálogo técnico
  MASTERS_READ = 'masters.read',
  MASTERS_MANAGE = 'masters.manage',
  CATALOG_READ = 'catalog.read',
  CATALOG_MANAGE = 'catalog.manage',

  // Balanza e inventario
  SCALE_WEIGH = 'scale.weigh',
  SCALE_MANUAL = 'scale.manual',
  SCALE_ADJUST = 'scale.adjust',
  INVENTORY_READ = 'inventory.read',
  INVENTORY_ENTRY = 'inventory.entry',
  INVENTORY_TRANSFER = 'inventory.transfer',
  INVENTORY_ADJUST = 'inventory.adjust',
  INVENTORY_OVERRIDE = 'inventory.override',

  // Producción (Oficina Madre)
  ORDERS_READ = 'orders.read',
  ORDERS_MANAGE = 'orders.manage',
  ORDERS_DISPATCH = 'orders.dispatch',
  ORDERS_RECEIVE = 'orders.receive',
  ORDERS_RECONCILE = 'orders.reconcile',
  ORDERS_APPROVE = 'orders.approve',
  ORDERS_AUTHORIZE_CHANGES = 'orders.authorize_changes',
  ORDERS_CANCEL = 'orders.cancel',
  REQUESTS_REVIEW = 'requests.review',
  DISCREPANCIES_APPROVE = 'discrepancies.approve',
  LABOR_APPROVE = 'labor.approve',
  QUALITY_VERIFY = 'quality.verify',

  // Portal de taller
  WORKSHOP_PORTAL = 'workshop.portal',

  // Evidencias
  MEDIA_READ = 'media.read',
  MEDIA_UPLOAD = 'media.upload',
  MEDIA_MODERATE = 'media.moderate',

  // Clientes y ventas
  CUSTOMERS_READ = 'customers.read',
  CUSTOMERS_MANAGE = 'customers.manage',
  SALES_MANAGE = 'sales.manage',
  PAYMENTS_MANAGE = 'payments.manage',
  CUSTOMER_MATERIAL_MANAGE = 'customer_material.manage',

  // Finanzas
  FINANCE_READ = 'finance.read',
  FINANCE_MANAGE = 'finance.manage',
  FINANCE_CLOSE = 'finance.close',

  // Indicadores, reportes y alertas
  DASHBOARD_OFFICE = 'dashboard.office',
  REPORTS_READ = 'reports.read',
  REPORTS_FINANCIAL = 'reports.financial',
  REPORTS_EXPORT = 'reports.export',
  ALERTS_READ = 'alerts.read',
  ALERTS_MANAGE = 'alerts.manage',
}

export const ALL_PERMISSIONS = Object.values(Permission);

/** Descripción legible de cada permiso (para la pantalla de roles). */
export const PERMISSION_LABELS: Record<Permission, string> = {
  [Permission.USERS_MANAGE]: 'Administrar usuarios',
  [Permission.ROLES_MANAGE]: 'Administrar roles y permisos',
  [Permission.PARAMS_MANAGE]: 'Administrar parámetros del sistema',
  [Permission.AUDIT_READ]: 'Consultar auditoría',
  [Permission.REVERSALS_AUTHORIZE]: 'Autorizar reversos',
  [Permission.MASTERS_READ]: 'Consultar maestros',
  [Permission.MASTERS_MANAGE]: 'Administrar maestros',
  [Permission.CATALOG_READ]: 'Consultar catálogo técnico',
  [Permission.CATALOG_MANAGE]: 'Administrar catálogo técnico',
  [Permission.SCALE_WEIGH]: 'Pesar en Balanza Madre',
  [Permission.SCALE_MANUAL]: 'Captura manual de peso',
  [Permission.SCALE_ADJUST]: 'Ajustar pesajes',
  [Permission.INVENTORY_READ]: 'Consultar inventario',
  [Permission.INVENTORY_ENTRY]: 'Registrar entradas de material',
  [Permission.INVENTORY_TRANSFER]: 'Asignar/trasladar material',
  [Permission.INVENTORY_ADJUST]: 'Ajustes de inventario',
  [Permission.INVENTORY_OVERRIDE]: 'Autorización excepcional de despacho',
  [Permission.ORDERS_READ]: 'Consultar órdenes de producción',
  [Permission.ORDERS_MANAGE]: 'Crear/editar órdenes',
  [Permission.ORDERS_DISPATCH]: 'Despachar material a talleres',
  [Permission.ORDERS_RECEIVE]: 'Recepcionar producción',
  [Permission.ORDERS_RECONCILE]: 'Conciliar órdenes',
  [Permission.ORDERS_APPROVE]: 'Aprobar y cerrar órdenes',
  [Permission.ORDERS_AUTHORIZE_CHANGES]: 'Autorizar modificación de órdenes',
  [Permission.ORDERS_CANCEL]: 'Cancelar órdenes',
  [Permission.REQUESTS_REVIEW]: 'Revisar solicitudes de material',
  [Permission.DISCREPANCIES_APPROVE]: 'Aprobar mermas/diferencias',
  [Permission.LABOR_APPROVE]: 'Aprobar mano de obra',
  [Permission.QUALITY_VERIFY]: 'Control de calidad y ley',
  [Permission.WORKSHOP_PORTAL]: 'Operar portal de taller',
  [Permission.MEDIA_READ]: 'Consultar evidencias',
  [Permission.MEDIA_UPLOAD]: 'Cargar evidencias',
  [Permission.MEDIA_MODERATE]: 'Ocultar/corregir evidencias',
  [Permission.CUSTOMERS_READ]: 'Consultar clientes',
  [Permission.CUSTOMERS_MANAGE]: 'Administrar clientes y operaciones',
  [Permission.SALES_MANAGE]: 'Registrar despachos/ventas',
  [Permission.PAYMENTS_MANAGE]: 'Registrar abonos monetarios',
  [Permission.CUSTOMER_MATERIAL_MANAGE]: 'Registrar aportes de material',
  [Permission.FINANCE_READ]: 'Consultar finanzas',
  [Permission.FINANCE_MANAGE]: 'Registrar ingresos/egresos',
  [Permission.FINANCE_CLOSE]: 'Cierres financieros',
  [Permission.DASHBOARD_OFFICE]: 'Dashboard Oficina Madre',
  [Permission.REPORTS_READ]: 'Reportes operativos',
  [Permission.REPORTS_FINANCIAL]: 'Reportes financieros',
  [Permission.REPORTS_EXPORT]: 'Exportar reportes',
  [Permission.ALERTS_READ]: 'Consultar alertas',
  [Permission.ALERTS_MANAGE]: 'Gestionar alertas',
};
