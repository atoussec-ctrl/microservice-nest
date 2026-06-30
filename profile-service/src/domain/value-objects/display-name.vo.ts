import { InvalidDisplayNameError } from '../errors/domain.errors';

export class DisplayName {
  private constructor(private readonly value: string) {}

  static create(raw: string): DisplayName {
    const trimmed = raw.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      throw new InvalidDisplayNameError(
        'Display name must be between 1 and 100 characters',
      );
    }
    return new DisplayName(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: DisplayName): boolean {
    return this.value === other.value;
  }
}
