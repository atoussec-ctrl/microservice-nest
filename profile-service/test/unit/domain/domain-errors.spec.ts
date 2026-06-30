import {
  DomainErrorCode,
  EmailAlreadyTakenError,
  InvalidDisplayNameError,
  InvalidEmailError,
  InvalidUsernameError,
  ProfileAlreadyDeletedError,
  ProfileNotFoundError,
  UsernameAlreadyTakenError,
  VersionConflictError,
} from '../../../src/domain/errors/domain.errors';

describe('Domain errors', () => {
  it('should_expose_validation_code_with_default_messages', () => {
    expect(new InvalidUsernameError().code).toBe(DomainErrorCode.VALIDATION);
    expect(new InvalidEmailError().code).toBe(DomainErrorCode.VALIDATION);
    expect(new InvalidDisplayNameError().code).toBe(DomainErrorCode.VALIDATION);
    expect(new InvalidUsernameError().message).toBe('Invalid username');
    expect(new InvalidEmailError().message).toBe('Invalid email');
    expect(new InvalidDisplayNameError().message).toBe('Invalid display name');
  });

  it('should_expose_conflict_code', () => {
    expect(new UsernameAlreadyTakenError('a').code).toBe(
      DomainErrorCode.CONFLICT,
    );
    expect(new EmailAlreadyTakenError('a@b.c').code).toBe(
      DomainErrorCode.CONFLICT,
    );
    expect(new ProfileAlreadyDeletedError('p1').code).toBe(
      DomainErrorCode.CONFLICT,
    );
  });

  it('should_expose_not_found_and_version_conflict_codes', () => {
    expect(new ProfileNotFoundError('p1').code).toBe(DomainErrorCode.NOT_FOUND);
    expect(new VersionConflictError(1, 2).code).toBe(
      DomainErrorCode.VERSION_CONFLICT,
    );
  });

  it('should_set_error_name_to_class_name', () => {
    expect(new ProfileNotFoundError('p1').name).toBe('ProfileNotFoundError');
  });
});
