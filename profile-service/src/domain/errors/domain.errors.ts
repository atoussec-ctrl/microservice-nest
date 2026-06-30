export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidUsernameError extends DomainError {
  constructor(message = 'Invalid username') {
    super(message);
  }
}

export class InvalidEmailError extends DomainError {
  constructor(message = 'Invalid email') {
    super(message);
  }
}

export class InvalidDisplayNameError extends DomainError {
  constructor(message = 'Invalid display name') {
    super(message);
  }
}

export class UsernameAlreadyTakenError extends DomainError {
  constructor(username: string) {
    super(`Username already taken: ${username}`);
  }
}

export class EmailAlreadyTakenError extends DomainError {
  constructor(email: string) {
    super(`Email already taken: ${email}`);
  }
}

export class ProfileNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Profile not found: ${id}`);
  }
}

export class VersionConflictError extends DomainError {
  constructor(expected: number, actual: number) {
    super(`Version conflict: expected ${expected}, got ${actual}`);
  }
}

export class ProfileAlreadyDeletedError extends DomainError {
  constructor(id: string) {
    super(`Profile already deleted: ${id}`);
  }
}
