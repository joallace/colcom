import { randomUUID } from 'node:crypto'


// One problem of a request, for forms to show next to the field (see src/validation.ts)
export interface FieldError {
  key: string,
  label: string,
  message: string
}


export interface ErrorParams {
  message?: string,
  stack?: string,
  action?: string,
  statusCode?: number,
  errorId?: string,
  requestId?: string,
  context?: string,
  errorLocationCode?: string,
  key?: string,
  type?: string,
  databaseErrorCode?: string,
  errors?: FieldError[]
}

interface ErrorDefaults {
  message: string,
  action: string,
  statusCode: number
}


export class BaseError extends Error {
  // errorHandler sends these as the response body, in this order, and `name` after them. `stack`
  // isn't declared: a field would replace the one Error captures with undefined.
  message: string
  action: string
  statusCode: number
  errorId: string
  requestId?: string
  context?: string
  errorLocationCode?: string
  key?: string
  type?: string
  databaseErrorCode?: string
  errors?: FieldError[]

  constructor(
    { message, stack, action, statusCode, errorId, ...fields }: ErrorParams = {},
    defaults: ErrorDefaults = {
      message: 'Um erro interno não esperado aconteceu.',
      action: "Informe ao suporte o valor encontrado no campo 'error_id'.",
      statusCode: 500
    }
  ) {
    super()
    this.name = this.constructor.name
    this.message = message || defaults.message
    this.action = action || defaults.action
    this.statusCode = statusCode || defaults.statusCode
    this.errorId = errorId || randomUUID()
    this.requestId = fields.requestId
    this.context = fields.context
    this.errorLocationCode = fields.errorLocationCode
    this.key = fields.key
    this.type = fields.type
    this.databaseErrorCode = fields.databaseErrorCode
    this.errors = fields.errors

    // The stack points to where the error was created, without the constructors; one given (e.g.
    // from the error this one replaces) is kept instead
    if (stack)
      this.stack = stack
    else
      Error.captureStackTrace(this, new.target)
  }
}

// Each class only sets its defaults; a status given explicitly wins, as for a ValidationError
// built from an error express marked as exposable
export class InternalServerError extends BaseError {
  constructor(params: ErrorParams = {}) {
    super(params, {
      message: 'Um erro interno não esperado aconteceu.',
      action: "Informe ao suporte o valor encontrado no campo 'error_id'.",
      statusCode: 500
    })
  }
}

export class NotFoundError extends BaseError {
  constructor(params: ErrorParams = {}) {
    super(params, {
      message: 'Não foi possível encontrar este recurso no sistema.',
      action: 'Verifique se o caminho (PATH) e o método (GET, POST, PUT, DELETE) estão corretos.',
      statusCode: 404
    })
  }
}

export class ServiceError extends BaseError {
  constructor(params: ErrorParams = {}) {
    super(params, {
      message: 'Serviço indisponível no momento.',
      action: 'Verifique se o serviço está disponível.',
      statusCode: 503
    })
  }
}

export class ValidationError extends BaseError {
  constructor(params: ErrorParams = {}) {
    super(params, {
      message: 'Um erro de validação ocorreu.',
      action: 'Ajuste os dados enviados e tente novamente.',
      statusCode: 400
    })
  }
}

export class UnauthorizedError extends BaseError {
  constructor(params: ErrorParams = {}) {
    super(params, {
      message: 'Usuário não autenticado.',
      action: 'Verifique se você está autenticado com uma sessão ativa e tente novamente.',
      statusCode: 401
    })
  }
}

export class ForbiddenError extends BaseError {
  constructor(params: ErrorParams = {}) {
    super(params, {
      message: 'Você não possui permissão para executar esta ação.',
      action: 'Verifique se você possui permissão para executar esta ação.',
      statusCode: 403
    })
  }
}

// The request was valid, but the state it was made against changed or already has what it adds
// (a duplicate interaction, a branch that exists, a merge that conflicts)
export class ConflictError extends BaseError {
  constructor(params: ErrorParams = {}) {
    super(params, {
      message: 'A operação conflita com o estado atual do recurso.',
      action: 'Atualize a página e tente novamente.',
      statusCode: 409
    })
  }
}

export class TooManyRequestsError extends BaseError {
  constructor(params: ErrorParams = {}) {
    super(params, {
      message: 'Você realizou muitas requisições recentemente.',
      action: 'Tente novamente mais tarde ou contate o suporte caso acredite que isso seja um erro.',
      statusCode: 429
    })
  }
}

export class UnprocessableEntityError extends BaseError {
  constructor(params: ErrorParams = {}) {
    super(params, {
      message: 'Não foi possível realizar esta operação.',
      action: 'Os dados enviados estão corretos, porém não foi possível realizar esta operação.',
      statusCode: 422
    })
  }
}
