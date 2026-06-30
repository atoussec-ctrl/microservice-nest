import { DisplayName } from '../../../src/domain/value-objects/display-name.vo';
import { Email } from '../../../src/domain/value-objects/email.vo';
import { Username } from '../../../src/domain/value-objects/username.vo';

describe('Value Object equality', () => {
  it('should_consider_equal_display_names_equal', () => {
    expect(DisplayName.create('Alice').equals(DisplayName.create('Alice'))).toBe(
      true,
    );
  });

  it('should_consider_different_display_names_not_equal', () => {
    expect(DisplayName.create('Alice').equals(DisplayName.create('Bob'))).toBe(
      false,
    );
  });

  it('should_consider_normalized_emails_equal', () => {
    expect(
      Email.create('User@Example.com').equals(Email.create('user@example.com')),
    ).toBe(true);
  });

  it('should_consider_different_emails_not_equal', () => {
    expect(
      Email.create('a@example.com').equals(Email.create('b@example.com')),
    ).toBe(false);
  });

  it('should_consider_normalized_usernames_equal', () => {
    expect(Username.create('Alice').equals(Username.create('alice'))).toBe(true);
  });
});
