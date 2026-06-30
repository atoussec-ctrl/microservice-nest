import { DisplayName } from '../../../src/domain/value-objects/display-name.vo';
import { InvalidDisplayNameError } from '../../../src/domain/errors/domain.errors';

describe('DisplayName', () => {
  it('should_create_valid_display_name', () => {
    const name = DisplayName.create('  Jane Doe  ');
    expect(name.toString()).toBe('Jane Doe');
  });

  it('should_throw_when_empty', () => {
    expect(() => DisplayName.create('   ')).toThrow(InvalidDisplayNameError);
  });

  it('should_throw_when_too_long', () => {
    expect(() => DisplayName.create('a'.repeat(101))).toThrow(
      InvalidDisplayNameError,
    );
  });
});
