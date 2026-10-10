/** Enumeraciones del dominio Prestige Gold (valores persistidos: no renombrar). */

export enum RecordStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum UnitKind {
  MASS = 'MASS',
  COUNT = 'COUNT',
  LENGTH = 'LENGTH',
}

export enum LocationType {
  MOTHER_OFFICE = 'MOTHER_OFFICE',
  WORKSHOP = 'WORKSHOP',
  TRANSIT = 'TRANSIT',
  CUSTOMER = 'CUSTOMER',
  OTHER = 'OTHER',
}

export enum StandardBasis {
  /** Cantidad de insumo por cada gramo de producto objetivo. */
  PER_GRAM = 'PER_GRAM',
  /** Cantidad de insumo por unidad de producto. */
  PER_UNIT = 'PER_UNIT',
  /** Cantidad por lote de N gramos (lotSizeGrams). */
  PER_LOT = 'PER_LOT',
}

export enum LaborBasis {
  GRAM = 'GRAM',
  UNIT = 'UNIT',
  LOT = 'LOT',
}

export enum WeighingSource {
  SCALE = 'SCALE',
  MANUAL = 'MANUAL',
}

export enum WeighingPurpose {
  ENTRY = 'ENTRY',
  DISPATCH = 'DISPATCH',
  RECEPTION = 'RECEPTION',
  CUSTOMER_MATERIAL = 'CUSTOMER_MATERIAL',
  SALE = 'SALE',
  OTHER = 'OTHER',
}

export enum MovementType {
  /** Entrada de material a Prestige Gold (compra, cliente, etc.). */
  ENTRY = 'ENTRY',
  /** Salida desde Oficina Madre hacia tránsito/taller. */
  DISPATCH = 'DISPATCH',
  /** Taller acepta la entrega: tránsito → custodia del taller. */
  CUSTODY_ACCEPTANCE = 'CUSTODY_ACCEPTANCE',
  /** Entrega rechazada por el taller: tránsito → Oficina Madre. */
  DISPATCH_REJECTION = 'DISPATCH_REJECTION',
  /** Retorno pesado de material (sobrante, no utilizado, devolución). */
  RETURN = 'RETURN',
  /** Consumo aprobado de insumos en producción (sale de la custodia). */
  CONSUMPTION = 'CONSUMPTION',
  /** Producto intermedio aprobado que entra como material (p. ej. hilo). */
  PRODUCTION_OUTPUT = 'PRODUCTION_OUTPUT',
  /** Traslado entre ubicaciones. */
  TRANSFER = 'TRANSFER',
  /** Ajuste positivo/negativo auditado. */
  ADJUSTMENT = 'ADJUSTMENT',
  /** Merma/pérdida aprobada. */
  LOSS = 'LOSS',
  /** Abono/aporte de material de cliente. */
  CUSTOMER_CONTRIBUTION = 'CUSTOMER_CONTRIBUTION',
  /** Reverso de un movimiento (RN-015: nunca se borra). */
  REVERSAL = 'REVERSAL',
}

export enum MovementStatus {
  CONFIRMED = 'CONFIRMED',
  REVERSED = 'REVERSED',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING_MATERIALS = 'PENDING_MATERIALS',
  READY_FOR_DISPATCH = 'READY_FOR_DISPATCH',
  DISPATCHED = 'DISPATCHED',
  ACCEPTED_BY_WORKSHOP = 'ACCEPTED_BY_WORKSHOP',
  IN_PRODUCTION = 'IN_PRODUCTION',
  PARTIAL = 'PARTIAL',
  FINISHED_BY_WORKSHOP = 'FINISHED_BY_WORKSHOP',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED_CLOSED = 'APPROVED_CLOSED',
  REJECTED_ADJUSTMENT = 'REJECTED_ADJUSTMENT',
  CANCELLED = 'CANCELLED',
}

export enum OrderPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum DispatchStatus {
  PENDING_ACCEPTANCE = 'PENDING_ACCEPTANCE',
  ACCEPTED = 'ACCEPTED',
  ACCEPTED_WITH_OBSERVATIONS = 'ACCEPTED_WITH_OBSERVATIONS',
  REJECTED = 'REJECTED',
}

export enum InsufficiencyAction {
  /** Completar la cantidad desde inventario disponible. */
  COMPLETE_FROM_INVENTORY = 'COMPLETE_FROM_INVENTORY',
  /** Solicitar/fabricar el insumo faltante (genera orden borrador del intermedio). */
  REQUEST_FABRICATION = 'REQUEST_FABRICATION',
  /** Modificar la orden con autorización (reduce objetivo). */
  MODIFY_ORDER = 'MODIFY_ORDER',
  /** Despachar parcialmente; la orden queda pendiente del faltante. */
  DISPATCH_PARTIAL = 'DISPATCH_PARTIAL',
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DISPATCHED = 'DISPATCHED',
  CANCELLED = 'CANCELLED',
}

export enum ApprovalStatus {
  PROPOSED = 'PROPOSED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ReceiptType {
  PARTIAL = 'PARTIAL',
  FINAL = 'FINAL',
}

export enum ReceiptLineType {
  FINISHED_PRODUCT = 'FINISHED_PRODUCT',
  LEFTOVER = 'LEFTOVER',
  UNUSED = 'UNUSED',
  RETURN = 'RETURN',
}

export enum QualityResult {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum PurityMethod {
  XRF = 'XRF',
  TOUCHSTONE = 'TOUCHSTONE',
  FIRE_ASSAY = 'FIRE_ASSAY',
  DENSITY = 'DENSITY',
  ACID_TEST = 'ACID_TEST',
  OTHER = 'OTHER',
}

export enum PurityStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  CONFORMING = 'CONFORMING',
  NON_CONFORMING = 'NON_CONFORMING',
}

export enum DiscrepancyType {
  /** Merma de proceso: consumido − producto terminado. */
  PROCESS_LOSS = 'PROCESS_LOSS',
  /** Faltante en custodia: entregado − consumido − retornado > 0. */
  CUSTODY_SHORTAGE = 'CUSTODY_SHORTAGE',
  /** Sobrante en custodia: retornos/consumos superan lo entregado. */
  CUSTODY_SURPLUS = 'CUSTODY_SURPLUS',
  /** Diferencia entre peso despachado y peso declarado recibido por el taller. */
  DISPATCH_DIFFERENCE = 'DISPATCH_DIFFERENCE',
  /** Diferencia entre lo declarado por el taller y lo pesado en recepción. */
  RECEPTION_DIFFERENCE = 'RECEPTION_DIFFERENCE',
  /** Diferencia manual (otros). */
  OTHER = 'OTHER',
}

export enum DiscrepancyStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum FinishedGoodStatus {
  QUARANTINE = 'QUARANTINE',
  AVAILABLE = 'AVAILABLE',
  REJECTED = 'REJECTED',
  SOLD = 'SOLD',
}

export enum MediaKind {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
}

export enum MediaPurpose {
  STAGE = 'STAGE',
  PROGRESS = 'PROGRESS',
  FINISHED = 'FINISHED',
  RECEPTION = 'RECEPTION',
  QUALITY = 'QUALITY',
  PURITY_SUPPORT = 'PURITY_SUPPORT',
  CATALOG = 'CATALOG',
  FINANCE_SUPPORT = 'FINANCE_SUPPORT',
  DISPATCH = 'DISPATCH',
  SIGNATURE = 'SIGNATURE',
  ORDER_ATTACHMENT = 'ORDER_ATTACHMENT',
  CUSTOMER_MATERIAL = 'CUSTOMER_MATERIAL',
}

export enum OperationType {
  SALE = 'SALE',
  CUSTOM_ORDER = 'CUSTOM_ORDER',
}

export enum OperationStatus {
  OPEN = 'OPEN',
  PARTIALLY_DISPATCHED = 'PARTIALLY_DISPATCHED',
  DISPATCHED = 'DISPATCHED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum ContributionTiming {
  BEFORE_FABRICATION = 'BEFORE_FABRICATION',
  AFTER_FABRICATION = 'AFTER_FABRICATION',
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum TransactionStatus {
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

export enum TransactionSource {
  MANUAL = 'MANUAL',
  CUSTOMER_PAYMENT = 'CUSTOMER_PAYMENT',
  WORKSHOP_PAYMENT = 'WORKSHOP_PAYMENT',
  MATERIAL_PURCHASE = 'MATERIAL_PURCHASE',
  REVERSAL = 'REVERSAL',
}

export enum CostType {
  MATERIAL = 'MATERIAL',
  LABOR = 'LABOR',
  OTHER = 'OTHER',
}

export enum AlertType {
  SHORTAGE = 'SHORTAGE',
  MIN_STOCK = 'MIN_STOCK',
  DELAY = 'DELAY',
  ABNORMAL_CONSUMPTION = 'ABNORMAL_CONSUMPTION',
  DIFFERENCE = 'DIFFERENCE',
  PENDING_OPERATION = 'PENDING_OPERATION',
  PURITY_NON_CONFORMING = 'PURITY_NON_CONFORMING',
  QUALITY_REJECTED = 'QUALITY_REJECTED',
  REQUEST_DEVIATION = 'REQUEST_DEVIATION',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export enum VariableDataType {
  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
  BOOLEAN = 'BOOLEAN',
  SELECT = 'SELECT',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REVERSE = 'REVERSE',
  ACCESS = 'ACCESS',
  LOGIN = 'LOGIN',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_RESET = 'PASSWORD_RESET',
  STATUS_CHANGE = 'STATUS_CHANGE',
  SIGN = 'SIGN',
  OVERRIDE = 'OVERRIDE',
  EXPORT = 'EXPORT',
  HIDE = 'HIDE',
}
