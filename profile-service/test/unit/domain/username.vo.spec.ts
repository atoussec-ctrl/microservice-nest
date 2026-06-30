import { Username } from '../../../src/domain/value-objects/username.vo';
import { InvalidUsernameError } from '../../../src/domain/errors/domain.errors';

describe('Username', () => {
  it('should_create_valid_username_when_alphanumeric', () => {
    const username = Username.create('John_Doe123');
    expect(username.toString()).toBe('john_doe123');
  });

  it('should_throw_when_username_too_short', () => {
    expect(() => Username.create('ab')).toThrow(InvalidUsernameError);
  });

  it('should_throw_when_username_has_invalid_chars', () => {
    expect(() => Username.create('user@name')).toThrow(InvalidUsernameError);
  });

  it('should_be_equal_when_same_value', () => {
    const a = Username.create('testuser');
    const b = Username.create('TESTUSER');
    expect(a.equals(b)).toBe(true);
  });
});
