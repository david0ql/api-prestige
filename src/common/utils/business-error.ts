import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Violación de regla de negocio (RN-xxx / validaciones críticas). 422 con código
 * estable para que la web muestre el mensaje y ofrezca acciones.
 */
export class BusinessRuleException extends UnprocessableEntityException {
  constructor(code: string, message: string, details?: unknown) {
    super({ error: code, message, details });
  }
}

/** Estado inválido para la transición pedida (máquina de estados). */
export class InvalidStateException extends ConflictException {
  constructor(message: string, details?: unknown) {
    super({ error: 'INVALID_STATE', message, details });
  }
}
