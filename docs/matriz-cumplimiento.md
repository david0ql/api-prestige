# Matriz de cumplimiento — Especificación Funcional v1.1

Leyenda de pruebas: **API-E2E** = `api/test/flow.e2e-spec.ts` / `api/test/security.e2e-spec.ts` · **UNIT** = pruebas unitarias ·
**CLIC** = pruebas Playwright en `web/e2e/`.

## Requerimientos funcionales

| ID | Implementación (API) | Pantalla (web) | Prueba |
|---|---|---|---|
| RF-001 Entrada de materiales | `POST /inventory/entries` (tipo, ley, origen, fecha, responsable, peso del pesaje) | P03 `/balanza` | API-E2E CA-001 · CLIC |
| RF-002 Integrar Balanza Madre | `POST /weighings` source SCALE con trama cruda revalidada; Web Serial + simulador | Panel `WeighingCapture` | UNIT parser · API-E2E RN-019 · CLIC |
| RF-003 Captura manual controlada | source MANUAL exige permiso `scale.manual` y motivo; auditoría OVERRIDE | Panel `WeighingCapture` (modo manual) | API-E2E RN-019 |
| RF-004 Asignar material a destino | Entrada asociable a orden/cliente; despacho a taller/orden; aporte de cliente a operación | P03, P05, P13 | API-E2E |
| RF-005 Inventario global por gramos | `GET /inventory/summary`, `/balances` (saldo materializado desde movimientos confirmados) | P04 | API-E2E CA-002 |
| RF-006 Custodia por taller | `GET /inventory/workshops/:id/custody` (por orden, desde cuándo) | P04, P07 | API-E2E Escenario A |
| RF-007 Crear orden | `POST /orders` (producto, variante, taller, cantidad/peso, fecha, observaciones) | P06 `/ordenes/nueva` | API-E2E · CLIC |
| RF-008 Calcular insumos | `computeRequirements` (por gramo/unidad/lote, variante) | P06 | UNIT · API-E2E (70 g de hilo) |
| RF-009 Alerta de insuficiencia | `GET /orders/:id/sufficiency`, `POST /dispatches/preview`, 422 `INSUFFICIENT_FOR_ORDER` con acciones | P05 diálogo de insuficiencia | API-E2E CA-003 · CLIC |
| RF-010 Despachar materiales | `POST /dispatches` (peso de balanza, responsable, orden, destino, motivo) Oficina→Tránsito | P05 | API-E2E · CLIC |
| RF-011 Confirmación digital | `POST /dispatches/:id/respond` (peso recibido, compromiso, firma) Tránsito→Custodia | P08 | API-E2E · CLIC |
| RF-012 Consumo de insumos | `POST /orders/:id/consumptions` (no supera custodia; alerta de consumo anormal) | P09 | API-E2E |
| RF-013 Registrar avance | `POST /orders/:id/progress` (g/u/%/observaciones) | P09 | API-E2E |
| RF-014 Evidencia foto/video | `POST /media` (orden, producto, taller, fecha, etapa; firma binaria; versión web/miniatura) | P09 | API-E2E CA-004 · CLIC |
| RF-015 Solicitar material | `POST /material-requests` | P09, solicitudes | API-E2E |
| RF-016 Validar contra estándar | desviación % y `exceedsStandard` + alerta `REQUEST_DEVIATION` | P09, Aprobaciones | API-E2E |
| RF-017 Producto terminado | `POST /orders/:id/finished` (g/u, variables técnicas requeridas, evidencia final) | P10 | API-E2E CA-005 |
| RF-018 Mano de obra | `LaborCost` (tarifa, base, cantidad, valor) + tarifas parametrizables | P10, P18 | API-E2E |
| RF-019 Recepcionar y verificar | `POST /orders/:id/receipts` pesado + calidad + ley | P11 | API-E2E CA-013 · CLIC |
| RF-020 Sobrantes y devoluciones | Líneas LEFTOVER / UNUSED / RETURN con retorno a Oficina Madre | P11 | API-E2E |
| RF-021 Conciliar materiales | `GET /orders/:id/reconciliation` | P12 | API-E2E CA-006 |
| RF-022 Mermas/diferencias | `Discrepancy` (tipo, cantidad, motivo, responsable, aprobación) | P12, `/diferencias` | API-E2E CA-008 |
| RF-023 Aprobar producción | `POST /orders/:id/approve` (solo Prestige Gold) | P12 | API-E2E · CLIC |
| RF-024 Costo aprobado a contabilidad | `CostEntry` solo al aprobar | P14 costos | API-E2E |
| RF-025 Ventas con control de calidad | `POST /sales` bloquea piezas sin calidad/ley | Operación de cliente | API-E2E CA-014 |
| RF-026 Abonos monetarios | `POST /customer-payments` → ingreso en caja | P13 | API-E2E CA-009 |
| RF-027 Aportes de material | `POST /customer-contributions` (pesado, ley, origen, operación, momento) | P13 | API-E2E CA-009 |
| RF-028 Ingresos y egresos | `/finance/transactions` (concepto, tercero, medio, soporte) | P14 | API-E2E |
| RF-029 Costos y utilidad | Reporte de rentabilidad consolidado | P16 | API-E2E CA-011 |
| RF-030 Rentabilidad por producto/taller | `groupBy=product|workshop|customer|month` | P16 | API-E2E |
| RF-031 Productividad por taller | `/reports/productivity` + cumplimiento | P15 | API-E2E CA-010 |
| RF-032 Control de compromisos | `/reports/compliance`, fecha real = recepción final | P15, P06 | API-E2E |
| RF-033 Panel Oficina Madre | `GET /dashboard/office` | P02 | API-E2E · CLIC |
| RF-034 Panel de taller | `GET /workshop-portal/dashboard` | P07 | API-E2E |
| RF-035 Firma/aceptación digital | `DigitalAcceptance` (usuario, fecha, IP, firma, hash SHA-256) | P08 | API-E2E |
| RF-036 Auditoría | Subscriber TypeORM + `AuditService` + `@AuditAccess` | `/auditoria` | API-E2E RN-015 |
| RF-037 Nuevos talleres | `POST /workshops` crea taller + custodia + productos | P18 | API-E2E CA-012 · CLIC |
| RF-038 Nuevos materiales/productos | CRUD maestros, variantes, estándares, etapas, variables | P18 | API-E2E |
| RF-039 Alertas operativas | Eventos + cron (faltantes, mínimos, retrasos, consumos, diferencias, pendientes) | P17 | API-E2E |
| RF-040 Exportar reportes | `/reports/:key/export?format=xlsx|csv` | Reportes, P15, P16 | UNIT · API-E2E |
| RF-041 Mosaico visual | `GET /orders/:id/story` + enlace público `/public/stories/:token` | P20, `/historia/:token` | API-E2E CA-016 |
| RF-042 Catálogo técnico | `TechnicalSheet` versionada + fotos | P19 | API-E2E CA-015 |
| RF-043 Ley objetivo | ley/tolerancia en material, producto y ficha | P18, P19 | API-E2E |
| RF-044 Verificar ley | `POST /orders/:id/receipts/:rid/purity` | P11 | API-E2E CA-013 |
| RF-045 Abonos mixtos | saldos separados dinero/material por operación y cliente | P13 | API-E2E CA-009 |

## Reglas de negocio

| ID | Cómo se garantiza |
|---|---|
| RN-001 | Todo movimiento físico (entrada, despacho, aceptación, retorno, consumo, merma, aporte, venta pesada) genera movimiento en el kardex |
| RN-002 | Gramo como unidad base; unidades auxiliares con factor a gramo; la balanza convierte kg/ct/ozt |
| RN-003 | `INSUFFICIENT_STOCK` salvo `overrideReason` + permiso `inventory.override` (auditado) |
| RN-004 | Despacho = cambio de ubicación (Oficina → Tránsito → Custodia); el total global se conserva |
| RN-005 | Despacho exige taller, responsable y motivo; orden opcional |
| RN-006 | Orden sin materiales requeridos → `ORDER_WITHOUT_MATERIALS` |
| RN-007 | `ConsumptionStandard` por producto/variante |
| RN-008 | Estado Pendiente de materiales + alerta `SHORTAGE` antes del despacho |
| RN-009 | Roles de taller no pueden tener permisos de aprobación/finanzas; endpoints rechazan usuarios de taller |
| RN-010 | Conciliación registra toda diferencia (en tolerancia: aprobada automática; fuera: pendiente) |
| RN-011 | Aprobación bloqueada si entregado ≠ consumido + retornado + diferencias autorizadas |
| RN-012 | Mano de obra PROPUESTA → aprobación explícita |
| RN-013 | Etapas obligatorias con evidencia mínima de foto/video (`STAGE_EVIDENCE_REQUIRED`) |
| RN-014 | Filtro por taller en todas las consultas y 404 ante acceso cruzado |
| RN-015 | Sin borrado: reversos en inventario, finanzas, abonos, aportes y ventas |
| RN-016 | Entidades separadas `CustomerPayment` y `CustomerMaterialContribution` |
| RN-017 | Aporte conserva origen, tipo, ley, peso, operación y lote del cliente |
| RN-018 | Talleres creados por administración sin cambios de estructura |
| RN-019 | Pesaje inmutable; ajustes con `WeighingAdjustment`; trama cruda revalidada |
| RN-020 | Transacción con fecha, concepto, valor, responsable y soporte; períodos cerrados |
| RN-021 | Aprobación exige verificación de ley conforme |
| RN-022 | Venta exige calidad aprobada y ley conforme |
| RN-023 | Ficha técnica versionada; la orden guarda su versión |
| RN-024 | Evidencias solo se ocultan (con motivo); el taller no puede en órdenes en revisión/cerradas |

## Criterios de aceptación

| CA | Prueba automatizada |
|---|---|
| CA-001 … CA-016 | `api/test/flow.e2e-spec.ts` (un caso por criterio) y `api/test/security.e2e-spec.ts` (CA-007, CA-012, CA-015); flujos de clic equivalentes en `web/e2e/` |

## Requerimientos no funcionales

| ID | Cumplimiento |
|---|---|
| RNF-001 Usabilidad | Medido en `web/e2e/10-usability.spec.ts`: axe-core WCAG 2.1 AA sin violaciones graves/críticas en 18 pantallas a 1024×768 (tablet) y sin desbordes; metas táctiles ≥ 44 px en el portal del taller (tablet y celular); el taller confirma una entrega desde su panel en 6 interacciones (tope 7) |
| RNF-002 Responsive | Layout adaptable, menú móvil, cámara del celular en cargas |
| RNF-003 Trazabilidad | Usuario, fecha/hora, origen, destino y referencia en cada movimiento + bitácora |
| RNF-004 Seguridad | Ver README · sección Seguridad |
| RNF-005 Integridad | Reversos en lugar de borrados |
| RNF-006 Disponibilidad | `infra/availability/verify-availability.sh` sobre el stack de producción aislado: caída abrupta de Node (kill -9) → reinicio automático (~1 s); reinicio de PostgreSQL → salud 503 sin colgarse y reconexión automática; SIGTERM → la petición en curso responde 200 y el apagado es ordenado (`enableShutdownHooks`, `init: true`). Resultado en `docs/verificacion/disponibilidad.json` |
| RNF-007 Rendimiento | `api/test/performance.e2e-spec.ts`: 1.500 capturas (pesaje + entrada) con 10 usuarios concurrentes y 300 órdenes por la API real; integridad del saldo exacta; p95 de capturas ≤ 1,5 s y de 11 consultas operativas ≤ 1 s (medido: capturas ~0,5 s, consultas 5–850 ms). Detectó y se corrigieron el kardex (2 s → 0,7 s) y el panel de taller (1,2 s → 0,07 s). Resultado en `docs/verificacion/rendimiento.json` |
| RNF-008 Escalabilidad | Todo parametrizable; talleres/productos/materiales sin código |
| RNF-009 Evidencia multimedia | Fotos, videos (streaming por rangos) y documentos con trazabilidad |
| RNF-010 Respaldo | `infra/backup/backup.sh` / `restore.sh` |
| RNF-011 Gestión multimedia | Optimización en el dispositivo + versión web/miniatura en servidor |

## Pantallas

P01 `/login` `/recuperar` `/restablecer` · P02 `/dashboard` · P03 `/balanza` · P04 `/inventario` · P05 `/asignaciones` ·
P06 `/ordenes`, `/ordenes/:id` · P07 `/taller` · P08 `/taller/entregas/:id` · P09/P10 `/taller/ordenes/:id` ·
P11 `/recepciones` + pestaña Recepción de la orden · P12 pestaña Conciliación · P13 `/clientes` · P14 `/finanzas` ·
P15 `/productividad` · P16 `/rentabilidad` · P17 `/alertas` · P18 `/administracion` · P19 `/catalogo` · P20 `/ordenes/:id/historia`.

## Secciones sin código (verificadas línea por línea contra el Word)

`scripts/verify-spec.mjs` extrae cada línea de estas secciones del `.docx` y falla si alguna no aparece aquí.
Abreviaturas de pruebas: **F** = `api/test/flow.e2e-spec.ts`, **S** = `api/test/security.e2e-spec.ts`,
**C1…C7** = `web/e2e/0N-*.spec.ts`, **U** = unitarias.

### 3 · Alcance Fase 1
| Ítem | Evidencia |
|---|---|
| Maestros y parametrización | Módulo `masters` + P18 · S "RF-038", C5 CA-012 |
| Balanza Madre | Módulo `scale` + `WeighingCapture` · F RN-019, C2, C7 RN-019 |
| Inventarios | Módulo `inventory` · F CA-001/CA-002, C2 P04 |
| Órdenes de producción | `production/orders` · F CA-003, C3 P06 |
| Portal de talleres | `workshop-portal` + P07–P10 · F CA-004, C3 P08–P10 |
| Recepción de producción | `reception.service` + P11 · F CA-005/CA-013, C3 P11 |
| Clientes y despachos | Módulo `sales` + P13 · F CA-009/CA-014, C4 |
| Contabilidad operativa | Módulo `finance` + P14 · F RF-028, C4 P14, C7 RN-020 |
| Indicadores | Módulo `reports` + P02/P15/P16 · F CA-010/CA-011, C4 |
| Auditoría y seguridad | `audit`, `auth`, RBAC · S (22 casos), C1, C5 RF-036 |
| Catálogo técnico y trazabilidad visual | `catalog`, `media` + P19/P20 · F CA-015/CA-016, C3 P20, C5 CA-015 |

### 5 · Catálogos y datos maestros
| Maestro | Evidencia |
|---|---|
| Materiales | Entidad `Material` (código, nombre, categoría, ley, unidad base, estado, costo) · S RF-038 |
| Productos | `Product` + `ProductVariant` + `TechnicalSheet` (fotos, peso, diámetro, medidas, ley, talleres, insumos, variables) · S RF-038 |
| Talleres | `Workshop` (código, responsable, contacto, estado, productos, condiciones) · S/C5 CA-012 |
| Clientes | `Customer` + saldos dinero/material separados · F CA-009, C4 |
| Fórmulas/estándares | `ConsumptionStandard` (por gramo/unidad/lote, tolerancia) · U requirements, F CA-003 |
| Ubicaciones | `Location` (Oficina Madre, taller, tránsito, cliente, otra) · F Escenario A |
| Usuarios/Roles | `User`, `Role` con permisos, taller asociado, estado · S "Roles, permisos" |

### 6 · Proceso punta a punta
| Paso | Evidencia |
|---|---|
| Ingreso de materiales | `POST /inventory/entries` · F CA-001, C2 CA-001 |
| Pesaje en Balanza Madre | `POST /weighings` · F RN-019, C2 |
| Disponibilidad de inventario | Saldo Oficina Madre (`/inventory/summary`) · F CA-001 |
| Planeación / orden de producción | `POST /orders` + `/plan` · C3 P06 |
| Validación de suficiencia | `/sufficiency`, `/dispatches/preview` · F CA-003, C2 Escenario C |
| Entrega al taller | Despacho + aceptación firmada · F Escenario A, C3 P08 |
| Ejecución de taller | Consumos, avances, evidencias por etapa · F CA-004, C3 P09/P10 |
| Retorno, control de calidad y ley | Recepción + calidad + ley · F CA-013, C3 P11 |
| Conciliación | `/reconciliation` · F CA-006, C3 P12 |
| Aprobación | `/approve` · F CA-005, C3 P12 |
| Inventario terminado / venta | Producto liberado → `/sales` · F RF-025, C4 CA-014 |
| Contabilidad y análisis | `CostEntry`, reportes · F CA-011, C4 P15/P16 |

### 7.1 · Estados de la orden
Los 12 estados (Borrador, Pendiente de materiales, Lista para despacho, Despachada, Aceptada por taller, En producción,
Parcial, Terminada por taller, En revisión Prestige Gold, Aprobada/Cerrada, Rechazada/Ajuste, Cancelada) están en
`OrderStatus` con transiciones en `ORDER_TRANSITIONS` · U "Máquina de estados", F (recorrido completo), C3.

### 10 · Validaciones críticas
| Validación | Evidencia |
|---|---|
| Peso mayor que cero en entradas, salidas y recepciones físicas. | DTO `IsPositive` + `WEIGHT_NOT_POSITIVE` · S "valores inválidos" |
| Material activo y válido para la operación seleccionada. | `MastersService.activeMaterial` en entradas, despachos, consumos, aportes |
| Taller habilitado para el producto asignado. | `assertWorkshopEnabled` · F "Cancelación… Taller no habilitado" |
| Inventario suficiente en Oficina Madre antes del despacho. | `INSUFFICIENT_STOCK` (RN-003) |
| Comparación material requerido vs. material entregado. | `INSUFFICIENT_FOR_ORDER` · F CA-003, C2 Escenario C |
| Bloqueo o advertencia cuando la cantidad terminada supera valores plausibles según entradas y fórmula. | `IMPLAUSIBLE_FINISHED` (bloqueo) y `PLAUSIBILITY_WARNING` (advertencia) · F CA-014 |
| Diferencias de peso por fuera de tolerancia deben requerir justificación/aprobación. | Discrepancias PENDING · F CA-008, C5 CA-008 |
| No cerrar orden con movimientos pendientes, recepción incompleta o conciliación sin resolver. | `APPROVAL_BLOCKED` · F CA-005/CA-013 |
| No contabilizar mano de obra o costos de taller sin aprobación de la Oficina Madre. | `CostEntry` solo en aprobación · F Escenario B |
| No permitir que usuarios de taller consulten información financiera global o de otros talleres. | Permisos + aislamiento · F CA-007, C5 CA-007 |
| No permitir completar una etapa de producción marcada como obligatoria sin la evidencia visual requerida (foto y/o video). | `STAGE_EVIDENCE_REQUIRED` · F CA-004, C3 P09 |
| No aprobar recepción de producto terminado sin verificación de ley/pureza cuando el producto la requiera. | F CA-013, C3 P11 |
| No despachar al cliente un producto sin estado de calidad aprobado y ley/pureza validada cuando aplique. | `PRODUCT_NOT_RELEASED` · F CA-014, C4 |
| Validar que los abonos en material del cliente tengan peso, tipo de material, ley/pureza, origen y operación asociada. | DTO obligatorio + pesaje · F CA-009 |

### 11 · Roles
| Rol | Evidencia |
|---|---|
| Administrador Prestige Gold | `SYSTEM_ROLES.ADMIN` · S, C5 |
| Operaciones Oficina Madre | `SYSTEM_ROLES.OPERATIONS` · F, C2/C3 |
| Finanzas/Contabilidad | `SYSTEM_ROLES.FINANCE` · F RF-028, C4 |
| Aprobador/Gerencia | `SYSTEM_ROLES.APPROVER` · F aprobaciones, C3/C5 |
| Taller | `SYSTEM_ROLES.WORKSHOP` (aislado, sin aprobaciones) · F CA-007, C3 |
| Consulta/Auditor | `SYSTEM_ROLES.AUDITOR` (solo lectura) · S "cada rol", C5 RF-036 |

### 14 · Escenarios
Escenario A (1.000 g distribuidos 200/200/200/400) · F "Escenario A / CA-002", C2.
Escenario B (hilo fabricado por Javier entra como material) · F "Escenario B".
Escenario C (250 g requieren 70 g de hilo; se asignan 50 g; faltan 20 g) · F "CA-003 / Escenario C", C2.

### 15 · Reportes e indicadores
| Reporte | Clave API (`/reports/:key`) |
|---|---|
| Inventario global | `inventory-global` |
| Kardex de material | `kardex` |
| Material por taller | `workshop-material` |
| Órdenes de producción | `orders` |
| Productividad mensual | `productivity` |
| Cumplimiento | `compliance` |
| Consumo vs estándar | `consumption-vs-standard` |
| Mermas y diferencias | `losses` |
| Costos por producción | `production-costs` |
| Rentabilidad | `profitability` |
| Clientes y abonos | `customers` |
| Auditoría | `audit` |
| Catálogo técnico de modelos | `catalog` |
| Trazabilidad visual | `visual-traceability` |
| Control de ley/pureza | `purity-control` |
Todos se ejecutan y exportan en F "CA-010 / CA-011 / RF-040" y C4.

### 19 · Riesgos mitigados
| Riesgo | Control implementado |
|---|---|
| Pérdida de trazabilidad del metal | Kardex inmutable por ubicación/orden/taller/responsable |
| Diferencias entre peso entregado y recibido | Pesaje de salida y retorno + conciliación obligatoria |
| Producción detenida por falta de insumos | Estándares + alertas de suficiencia y mínimos |
| Información verbal/no verificable | Firma digital con hash, evidencias, bitácora |
| Costos no controlados de talleres | Mano de obra propuesta + aprobación previa |
| Inventario “fantasma” en talleres | Custodia por taller y reporte "Material por taller" |
| Acceso cruzado a información | Aislamiento por taller (404) |
| Cambios históricos sin evidencia | Reversos + fichas versionadas + auditoría |
| Desconocimiento de rentabilidad real | Reporte de rentabilidad consolidado |
| Producto terminado con ley/pureza fuera de estándar | Verificación obligatoria y bloqueo de aprobación/venta |
| Falta de evidencia del proceso de fabricación | Etapas con foto/video obligatorios + mosaico |

### 18 · Supuestos atendidos por configuración
Nombre de la empresa, códigos de taller, talleres nuevos (p. ej. "Alex"), familias comerciales, fórmulas, tolerancias,
tarifas de mano de obra y protocolo de balanza son parámetros o maestros editables (P18): ninguno está fijo en el código.

### 3.1 / 18 · Elementos diferidos por el propio documento (preparados, no bloqueantes)
| Elemento | Estado en el sistema |
|---|---|
| Tarifas definitivas de mano de obra | Estructura completa (`LaborRate`, propuesta/aprobación); valores editables en P18 |
| Fórmulas metalúrgicas definitivas | Estándares de consumo y ley/tolerancias parametrizables por producto/variante |
| Marca/modelo/protocolo de la balanza | **Definido por el cliente: Mettler Toledo (MT-SICS).** Configuración por defecto 9600 8N1; la web pide peso continuo (`SIR`), envía cero (`Z`), tara (`T`) y detiene (`@`); estados `S S`/`S D` y errores `S +`, `S -`, `S I`, `ES`, `ET`, `EL` informados al operador y rechazados por la API (RN-019). Probado con un puerto serie simulado; pendiente la prueba con el equipo físico en sitio |
| Integración contable/fiscal externa, logística avanzada, IA | Fuera de Fase 1 según 3.1; exportaciones Excel/CSV disponibles para integración |
| Método de verificación de ley y tolerancias | Métodos XRF/toque/fuego/densidad/ácido y tolerancias por material/producto/ficha |
| SMTP y secretos de producción | Secretos de producción generados (`api/.env.production`, no versionado). SMTP de producción con STARTTLS obligatorio y TLS 1.2+, verificado contra un servidor con autenticación (`dist/scripts/verify-mail.js`). **Pendiente del cliente: proveedor de correo y credenciales** |
