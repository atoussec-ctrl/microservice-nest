import { Email } from '../../../src/domain/value-objects/email.vo';
import { InvalidEmailError } from '../../../src/domain/errors/domain.errors';

describe('Email', () => {
  it('should_create_valid_email', () => {
    const email = Email.create('User@Example.COM');
    expect(email.toString()).toBe('user@example.com');
  });

  it('should_throw_when_invalid_format', () => {
    expect(() => Email.create('not-an-email')).toThrow(InvalidEmailError);
  });
});
