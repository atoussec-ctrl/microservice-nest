import { ArgumentsHost } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { DomainExceptionFilter } from '../../../src/presentation/graphql/domain-exception.filter';
import {
  EmailAlreadyTakenError,
  InvalidUsernameError,
  ProfileAlreadyDeletedError,
  ProfileNotFoundError,
  UsernameAlreadyTakenError,
  VersionConflictError,
} from '../../../src/domain/errors/domain.errors';

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();
  const host = {} as ArgumentsHost;

  it('should_map_validation_error_to_BAD_USER_INPUT_400', () => {
    const result = filter.catch(new InvalidUsernameError(), host);
    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.extensions.code).toBe('BAD_USER_INPUT');
    expect(result.extensions.httpStatus).toBe(400);
    expect(result.extensions.domainCode).toBe('VALIDATION');
  });

  it('should_map_username_conflict_to_CONFLICT_409', () => {
    const result = filter.catch(new UsernameAlreadyTakenError('alice'), host);
    expect(result.extensions.code).toBe('CONFLICT');
    expect(result.extensions.httpStatus).toBe(409);
  });

  it('should_map_email_conflict_to_CONFLICT_409', () => {
    const result = filter.catch(
      new EmailAlreadyTakenError('a@example.com'),
      host,
    );
    expect(result.extensions.code).toBe('CONFLICT');
  });

  it('should_map_already_deleted_to_CONFLICT_409', () => {
    const result = filter.catch(new ProfileAlreadyDeletedError('p1'), host);
    expect(result.extensions.code).toBe('CONFLICT');
  });

  it('should_map_not_found_to_NOT_FOUND_404', () => {
    const result = filter.catch(new ProfileNotFoundError('p1'), host);
    expect(result.extensions.code).toBe('NOT_FOUND');
    expect(result.extensions.httpStatus).toBe(404);
  });

  it('should_map_version_conflict_to_PRECONDITION_FAILED_412', () => {
    const result = filter.catch(new VersionConflictError(1, 2), host);
    expect(result.extensions.code).toBe('PRECONDITION_FAILED');
    expect(result.extensions.httpStatus).toBe(412);
  });

  it('should_preserve_original_message', () => {
    const result = filter.catch(new ProfileNotFoundError('p1'), host);
    expect(result.message).toContain('Profile not found: p1');
  });

  it('should_fallback_to_INTERNAL_SERVER_ERROR_for_unknown_code', () => {
    const unknown = new ProfileNotFoundError('p1');
    Object.defineProperty(unknown, 'code', { value: 'SOMETHING_NEW' });
    const result = filter.catch(unknown, host);
    expect(result.extensions.code).toBe('INTERNAL_SERVER_ERROR');
    expect(result.extensions.httpStatus).toBe(500);
  });
});
