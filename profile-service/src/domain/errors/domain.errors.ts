export enum DomainErrorCode {
  VALIDATION = 'VALIDATION',
  CONFLICT = 'CONFLICT',
  NOT_FOUND = 'NOT_FOUND',
  VERSION_CONFLICT = 'VERSION_CONFLICT',
}

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidUsernameError extends DomainError {
  readonly code = DomainErrorCode.VALIDATION;
  constructor(message = 'Invalid username') {
    super(message);
  }
}

export class InvalidEmailError extends DomainError {
  readonly code = DomainErrorCode.VALIDATION;
  constructor(message = 'Invalid email') {
    super(message);
  }
}

export class InvalidDisplayNameError extends DomainError {
  readonly code = DomainErrorCode.VALIDATION;
  constructor(message = 'Invalid display name') {
    super(message);
  }
}

export class UsernameAlreadyTakenError extends DomainError {
  readonly code = DomainErrorCode.CONFLICT;
  constructor(username: string) {
    super(`Username already taken: ${username}`);
  }
}

export class EmailAlreadyTakenError extends DomainError {
  readonly code = DomainErrorCode.CONFLICT;
  constructor(email: string) {
    super(`Email already taken: ${email}`);
  }
}

export class ProfileNotFoundError extends DomainError {
  readonly code = DomainErrorCode.NOT_FOUND;
  constructor(id: string) {
    super(`Profile not found: ${id}`);
  }
}

export class VersionConflictError extends DomainError {
  readonly code = DomainErrorCode.VERSION_CONFLICT;
  constructor(expected: number, actual: number) {
    super(`Version conflict: expected ${expected}, got ${actual}`);
  }
}

export class ProfileAlreadyDeletedError extends DomainError {
  readonly code = DomainErrorCode.CONFLICT;
  constructor(id: string) {
    super(`Profile already deleted: ${id}`);
  }
}
