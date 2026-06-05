export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = "DOMAIN_ERROR",
  ) {
    super(message);
    this.name = "DomainError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, "ENTITY_NOT_FOUND");
    this.name = "EntityNotFoundError";
  }
}

export class InvalidValueError extends DomainError {
  constructor(field: string, reason: string) {
    super(`Invalid value for '${field}': ${reason}`, "INVALID_VALUE");
    this.name = "InvalidValueError";
  }
}

export class ExternalServiceError extends DomainError {
  constructor(service: string, reason: string) {
    super(
      `External service error [${service}]: ${reason}`,
      "EXTERNAL_SERVICE_ERROR",
    );
    this.name = "ExternalServiceError";
  }
}
