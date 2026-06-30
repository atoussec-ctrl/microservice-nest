import { InvalidUsernameError } from '../errors/domain.errors';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

export class Username {
  private constructor(private readonly value: string) {}

  static create(raw: string): Username {
    const trimmed = raw.trim();
    if (!USERNAME_PATTERN.test(trimmed)) {
      throw new InvalidUsernameError(
        'Username must be 3-30 alphanumeric characters or underscores',
      );
    }
    return new Username(trimmed.toLowerCase());
  }

  toString(): string {
    return this.value;
  }

  equals(other: Username): boolean {
    return this.value === other.value;
  }
}
