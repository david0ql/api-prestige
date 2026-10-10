import { AlertSeverity, AlertType } from '../../common/enums/domain.enums';

/** Evento para que AlertsService registre una alerta operativa (RF-039). */
export const ALERT_RAISE = 'alert.raise';
export const ALERT_RESOLVE = 'alert.resolve';

export interface AlertRaiseEvent {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  workshopId?: string | null;
  dedupKey?: string;
  data?: Record<string, unknown>;
}

export interface AlertResolveEvent {
  dedupKey: string;
  notes?: string;
}
