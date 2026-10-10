import { LaborBasis, LocationType, StandardBasis, TransactionType, UnitKind, VariableDataType } from '../../common/enums/domain.enums';

/** Datos base (Fase 0 – Parametrización). Los códigos son configurables (sección 18). */
export const UNITS = [
  { code: 'g', name: 'Gramo', kind: UnitKind.MASS, factorToGram: 1, isBase: true },
  { code: 'kg', name: 'Kilogramo', kind: UnitKind.MASS, factorToGram: 1000 },
  { code: 'ozt', name: 'Onza troy', kind: UnitKind.MASS, factorToGram: 31.1034768 },
  { code: 'ct', name: 'Quilate (peso)', kind: UnitKind.MASS, factorToGram: 0.2 },
  { code: 'un', name: 'Unidad', kind: UnitKind.COUNT, factorToGram: 1 },
];

export const CATEGORIES = [
  { code: 'METAL', name: 'Metal precioso', isPreciousMetal: true },
  { code: 'METAL_BASE', name: 'Metal base', isPreciousMetal: false },
  { code: 'LIGA', name: 'Liga / aleación', isPreciousMetal: false },
  { code: 'SOLDADURA', name: 'Soldadura', isPreciousMetal: false },
  { code: 'PIEDRA', name: 'Piedras', isPreciousMetal: false },
  { code: 'INTERMEDIO', name: 'Producto intermedio', isPreciousMetal: true },
  { code: 'COMPONENTE', name: 'Componentes / herrajes', isPreciousMetal: false },
];

export const LOCATIONS = [
  { code: 'OFICINA-MADRE', name: 'Oficina Madre Prestige Gold', type: LocationType.MOTHER_OFFICE },
  { code: 'TRANSITO', name: 'Material en tránsito', type: LocationType.TRANSIT },
];

export const PAYMENT_METHODS = [
  { code: 'EFECTIVO', name: 'Efectivo' },
  { code: 'TRANSFERENCIA', name: 'Transferencia bancaria' },
  { code: 'TARJETA', name: 'Tarjeta débito/crédito' },
  { code: 'CHEQUE', name: 'Cheque' },
];

export const FINANCE_CATEGORIES = [
  { code: 'ABONO_CLIENTE', name: 'Abono de cliente', type: TransactionType.INCOME, isSystem: true },
  { code: 'VENTA_CONTADO', name: 'Venta de contado', type: TransactionType.INCOME },
  { code: 'OTROS_INGRESOS', name: 'Otros ingresos', type: TransactionType.INCOME },
  { code: 'PAGO_TALLER', name: 'Pago a taller (mano de obra)', type: TransactionType.EXPENSE, isSystem: true },
  { code: 'COMPRA_MATERIAL', name: 'Compra de material', type: TransactionType.EXPENSE, isSystem: true },
  { code: 'GASTO_OPERATIVO', name: 'Gasto operativo', type: TransactionType.EXPENSE, isOperatingExpense: true },
  { code: 'ARRIENDO', name: 'Arriendo', type: TransactionType.EXPENSE, isOperatingExpense: true },
  { code: 'NOMINA', name: 'Nómina oficina', type: TransactionType.EXPENSE, isOperatingExpense: true },
  { code: 'SERVICIOS', name: 'Servicios públicos', type: TransactionType.EXPENSE, isOperatingExpense: true },
  { code: 'OTROS_EGRESOS', name: 'Otros egresos', type: TransactionType.EXPENSE },
];

export const PARAMETERS = [
  { key: 'company.name', value: 'Prestige Gold', description: 'Nombre operativo de la empresa', groupName: 'general' },
  { key: 'company.currency', value: 'COP', description: 'Moneda de operación', groupName: 'general' },
  { key: 'production.defaultLossTolerancePct', value: 2, description: 'Tolerancia de merma de proceso por defecto (%)', groupName: 'producción' },
  { key: 'production.custodyToleranceGrams', value: 0.01, description: 'Diferencia de custodia aceptada sin aprobación (g)', groupName: 'producción' },
  { key: 'production.receptionTolerancePct', value: 0.5, description: 'Diferencia declarado vs pesado aceptada en recepción (%)', groupName: 'producción' },
  { key: 'alerts.pendingAcceptanceHours', value: 24, description: 'Horas para alertar entregas sin confirmar', groupName: 'alertas' },
  { key: 'alerts.delayWarningDays', value: 2, description: 'Días antes del compromiso para alertar', groupName: 'alertas' },
  { key: 'quality.checklist', value: ['Acabado y brillo', 'Medidas según ficha', 'Soldaduras', 'Cierre / broche', 'Piedras fijas', 'Sin porosidad'], description: 'Lista de chequeo de calidad', groupName: 'calidad' },
  { key: 'purity.goldFineReference', value: 999, description: 'Referencia de oro fino equivalente a 24K (milésimas)', groupName: 'calidad' },
  { key: 'scale.config', value: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', model: 'Por definir' }, description: 'Configuración de la Balanza Madre (Web Serial)', groupName: 'balanza' },
];

// ---------------- Demo (Fase 0 sugerida) ----------------
export const DEMO_MATERIALS = [
  { code: 'AU24', name: 'Oro 24K', category: 'METAL', purity: 999, karat: 24, purityTolerance: 1, referenceCost: 420000, minStock: 300, tracksLots: false },
  { code: 'AU18', name: 'Oro 18K', category: 'METAL', purity: 750, karat: 18, purityTolerance: 5, referenceCost: 315000, minStock: 100 },
  { code: 'AG1000', name: 'Plata 1000', category: 'METAL', purity: 999, purityTolerance: 2, referenceCost: 4500, minStock: 200 },
  { code: 'CU', name: 'Cobre', category: 'METAL_BASE', referenceCost: 60, minStock: 50 },
  { code: 'BRONCE', name: 'Bronce', category: 'METAL_BASE', referenceCost: 80, minStock: 50 },
  { code: 'LIGA10K', name: 'Liga para 10K', category: 'LIGA', referenceCost: 900, minStock: 50 },
  { code: 'SOLD', name: 'Soldadura de oro', category: 'SOLDADURA', purity: 585, referenceCost: 180000, minStock: 20 },
  { code: 'PIEDRA', name: 'Piedras (circonia)', category: 'PIEDRA', referenceCost: 2000, minStock: 10 },
  { code: 'HILO24', name: 'Hilo de oro 24K', category: 'INTERMEDIO', purity: 999, karat: 24, purityTolerance: 1, referenceCost: 430000, minStock: 100, isIntermediate: true },
  { code: 'CADIT', name: 'Cadena tipo italiana 18K', category: 'COMPONENTE', purity: 750, referenceCost: 320000, minStock: 50 },
];

export const DEMO_FAMILIES = [
  { code: 'GUCCI', name: 'Familia Gucci' },
  { code: 'ANILLOS', name: 'Anillería' },
  { code: 'PULSERAS', name: 'Pulseras y tobilleras' },
  { code: 'DIJES', name: 'Dijes y herrajes' },
  { code: 'HILO', name: 'Hilo y aleaciones' },
  { code: 'BALINERA', name: 'Balinera y balines' },
];

export const DEMO_WORKSHOPS = [
  { code: 'TC', name: 'Colmenares', responsible: 'Colmenares', mainProduction: 'Familia Gucci y anillería', phone: '3000000001' },
  { code: 'TJ', name: 'Jasmine', responsible: 'Jasmine', mainProduction: 'Pulseras, tobilleras, dijes, herrajes y piezas con piedra', phone: '3000000002' },
  { code: 'TJV', name: 'Javier', responsible: 'Javier', mainProduction: 'Fabricación/preparación de hilo y aleaciones', phone: '3000000003' },
  { code: 'TCA', name: 'Camilo', responsible: 'Camilo', mainProduction: 'Balinera, balines diamantados y productos Gucci', phone: '3000000004' },
];

export const DEMO_STAGES = [
  { code: 'FUNDICION', name: 'Fundición / preparación de material', sequence: 1, requiresPhoto: true, requiresVideo: false, minPhotos: 1 },
  { code: 'TREFILADO', name: 'Trefilado / laminado', sequence: 2, requiresPhoto: true, requiresVideo: false, minPhotos: 1, families: ['HILO'] },
  { code: 'ARMADO', name: 'Armado / ensamble', sequence: 3, requiresPhoto: true, requiresVideo: false, minPhotos: 1, families: ['GUCCI', 'ANILLOS', 'PULSERAS', 'DIJES', 'BALINERA'] },
  { code: 'SOLDADURA', name: 'Soldadura y engaste', sequence: 4, requiresPhoto: true, requiresVideo: false, minPhotos: 1, families: ['GUCCI', 'ANILLOS', 'PULSERAS', 'DIJES', 'BALINERA'] },
  { code: 'PULIDO', name: 'Pulido y acabado', sequence: 5, requiresPhoto: true, requiresVideo: true, minPhotos: 1 },
  { code: 'TERMINADO', name: 'Producto terminado', sequence: 6, requiresPhoto: true, requiresVideo: true, minPhotos: 2, isFinal: true },
];

export const DEMO_VARIABLES = [
  { code: 'CALIBRE', name: 'Calibre', dataType: VariableDataType.NUMBER, unit: 'mm', requiredOnFinish: true },
  { code: 'ACABADO', name: 'Acabado', dataType: VariableDataType.SELECT, options: ['Brillante', 'Mate', 'Diamantado', 'Satinado'], requiredOnFinish: true },
  { code: 'TIPO_CIERRE', name: 'Tipo de cierre', dataType: VariableDataType.SELECT, options: ['Mosquetón', 'Reasa', 'Caja', 'Sin cierre'], families: ['GUCCI', 'PULSERAS', 'BALINERA'] },
  { code: 'NUM_PIEDRAS', name: 'Número de piedras', dataType: VariableDataType.NUMBER, unit: 'u', families: ['PULSERAS', 'DIJES'] },
  { code: 'TALLA', name: 'Talla', dataType: VariableDataType.TEXT, families: ['ANILLOS'] },
];

export const DEMO_PRODUCTS = [
  {
    code: 'GUC-CAD', name: 'Cadena Gucci 24K', family: 'GUCCI', targetPurity: 999, purityTolerance: 1, workshops: ['TC', 'TCA'], lossTolerancePct: 2,
    standards: [
      { material: 'AU24', basis: StandardBasis.PER_GRAM, quantity: 0.72, tolerancePct: 3 },
      { material: 'HILO24', basis: StandardBasis.PER_GRAM, quantity: 0.28, tolerancePct: 3 },
    ],
    sheet: { standardWeight: 25, weightTolerance: 0.5, diameterMm: null, lengthMm: 500, measures: '50 cm · eslabón Gucci 6 mm', variables: { CALIBRE: 6, ACABADO: 'Brillante', TIPO_CIERRE: 'Mosquetón' } },
    variants: [{ code: '45', name: '45 cm' }, { code: '50', name: '50 cm' }, { code: '60', name: '60 cm' }],
  },
  {
    code: 'ANI-CL', name: 'Anillo clásico 18K', family: 'ANILLOS', targetPurity: 750, purityTolerance: 5, workshops: ['TC'], lossTolerancePct: 2.5,
    standards: [{ material: 'AU18', basis: StandardBasis.PER_GRAM, quantity: 1.02, tolerancePct: 3 }],
    sheet: { standardWeight: 4.5, weightTolerance: 0.2, diameterMm: 18, lengthMm: null, measures: 'Talla 7 · ancho 4 mm', variables: { CALIBRE: 1.8, ACABADO: 'Brillante', TALLA: '7' } },
  },
  {
    code: 'PUL-PIE', name: 'Pulsera con piedra 18K', family: 'PULSERAS', targetPurity: 750, purityTolerance: 5, workshops: ['TJ'], lossTolerancePct: 3,
    standards: [
      { material: 'CADIT', basis: StandardBasis.PER_GRAM, quantity: 0.92, tolerancePct: 3 },
      { material: 'PIEDRA', basis: StandardBasis.PER_GRAM, quantity: 0.05, tolerancePct: 10 },
      { material: 'SOLD', basis: StandardBasis.PER_GRAM, quantity: 0.03, tolerancePct: 10 },
    ],
    sheet: { standardWeight: 8, weightTolerance: 0.3, diameterMm: null, lengthMm: 190, measures: '19 cm', variables: { CALIBRE: 2.5, ACABADO: 'Brillante', NUM_PIEDRAS: 12, TIPO_CIERRE: 'Caja' } },
  },
  {
    code: 'HILO-24', name: 'Hilo de oro 24K', family: 'HILO', targetPurity: 999, purityTolerance: 1, workshops: ['TJV'], lossTolerancePct: 1, output: 'HILO24',
    requiresQualityCheck: true,
    standards: [{ material: 'AU24', basis: StandardBasis.PER_GRAM, quantity: 1.01, tolerancePct: 2 }],
    sheet: { standardWeight: null, weightTolerance: null, diameterMm: 0.8, lengthMm: null, measures: 'Calibre 0.8 mm', variables: { CALIBRE: 0.8, ACABADO: 'Brillante' } },
  },
  {
    code: 'BAL-DIA', name: 'Balines diamantados 24K', family: 'BALINERA', targetPurity: 999, purityTolerance: 1, workshops: ['TCA'], lossTolerancePct: 2,
    standards: [{ material: 'AU24', basis: StandardBasis.PER_GRAM, quantity: 1.0, tolerancePct: 3 }],
    sheet: { standardWeight: 0.35, weightTolerance: 0.05, diameterMm: 4, lengthMm: null, measures: 'Balín 4 mm diamantado', variables: { CALIBRE: 4, ACABADO: 'Diamantado', TIPO_CIERRE: 'Sin cierre' } },
  },
];

export const DEMO_LABOR_RATES = [
  { workshop: 'TC', basis: LaborBasis.GRAM, rate: 9000 },
  { workshop: 'TJ', basis: LaborBasis.GRAM, rate: 11000 },
  { workshop: 'TJV', basis: LaborBasis.GRAM, rate: 3500 },
  { workshop: 'TCA', basis: LaborBasis.GRAM, rate: 9500 },
];

export const DEMO_CUSTOMERS = [
  { documentType: 'CC', documentNumber: '1020304050', name: 'María Fernanda Ruiz', phone: '3101112233', email: 'maria.ruiz@example.com', city: 'Bogotá' },
  { documentType: 'NIT', documentNumber: '900123456-7', name: 'Joyería El Dorado SAS', phone: '6015550000', email: 'compras@eldorado.example.com', city: 'Medellín' },
  { documentType: 'CC', documentNumber: '79888777', name: 'Carlos Andrés Gómez', phone: '3204445566', email: 'carlos.gomez@example.com', city: 'Cali' },
];

export const DEMO_USERS = [
  { username: 'admin', fullName: 'Administrador Prestige Gold', email: 'admin@prestigegold.local', role: 'ADMIN' },
  { username: 'operaciones', fullName: 'Cristian Ayala', email: 'operaciones@prestigegold.local', role: 'OPERATIONS' },
  { username: 'finanzas', fullName: 'Laura Méndez', email: 'finanzas@prestigegold.local', role: 'FINANCE' },
  { username: 'gerencia', fullName: 'Gerencia Prestige Gold', email: 'gerencia@prestigegold.local', role: 'APPROVER' },
  { username: 'auditor', fullName: 'Auditoría Interna', email: 'auditor@prestigegold.local', role: 'AUDITOR' },
  { username: 'taller.tc', fullName: 'Usuario Taller Colmenares', email: 'tc@prestigegold.local', role: 'WORKSHOP', workshop: 'TC' },
  { username: 'taller.tj', fullName: 'Usuario Taller Jasmine', email: 'tj@prestigegold.local', role: 'WORKSHOP', workshop: 'TJ' },
  { username: 'taller.tjv', fullName: 'Usuario Taller Javier', email: 'tjv@prestigegold.local', role: 'WORKSHOP', workshop: 'TJV' },
  { username: 'taller.tca', fullName: 'Usuario Taller Camilo', email: 'tca@prestigegold.local', role: 'WORKSHOP', workshop: 'TCA' },
];
