import { ExecutionContext } from '@nestjs/common';
import { currentUserFactory } from '../../../src/presentation/graphql/current-user.decorator';

function contextWithUser(user: { sub: string } | undefined): ExecutionContext {
  return {
    getArgs: () => [{}, {}, { req: { user } }, {}],
    getClass: () => class {},
    getHandler: () => (): void => undefined,
    getType: () => 'graphql',
  } as unknown as ExecutionContext;
}

describe('currentUserFactory', () => {
  it('should_return_the_subject_of_the_authenticated_user', () => {
    const id = currentUserFactory(undefined, contextWithUser({ sub: 'profile-123' }));
    expect(id).toBe('profile-123');
  });

  it('should_throw_when_no_authenticated_user_is_present_on_the_request', () => {
    expect(() => currentUserFactory(undefined, contextWithUser(undefined))).toThrow(
      'CurrentUser decorator used without JwtAuthGuard',
    );
  });
});
