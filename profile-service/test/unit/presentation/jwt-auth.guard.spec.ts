import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../../src/presentation/graphql/jwt-auth.guard';

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  const request = { headers, user: undefined as { sub: string } | undefined };
  return {
    getArgs: () => [{}, {}, { req: request }, {}],
    getClass: () => class {},
    getHandler: () => (): void => undefined,
    getType: () => 'graphql',
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('should_throw_unauthorized_when_authorization_header_is_missing', async () => {
    const jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService);

    await expect(guard.canActivate(contextWithHeaders({}))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should_throw_unauthorized_when_scheme_is_not_bearer', async () => {
    const jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService);

    await expect(
      guard.canActivate(contextWithHeaders({ authorization: 'Basic xyz' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should_throw_unauthorized_when_token_verification_fails', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('bad signature')),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService);

    await expect(
      guard.canActivate(contextWithHeaders({ authorization: 'Bearer bad.token' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should_attach_the_authenticated_user_and_allow_access_on_a_valid_token', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'profile-123' }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService);
    const context = contextWithHeaders({ authorization: 'Bearer good.token' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('good.token');
    const request = context.getArgs()[2].req;
    expect(request.user).toEqual({ sub: 'profile-123' });
  });
});
