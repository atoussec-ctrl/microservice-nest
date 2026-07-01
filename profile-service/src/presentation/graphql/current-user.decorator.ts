import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthenticatedUser } from './jwt-auth.guard';

export function currentUserFactory(
  _data: unknown,
  context: ExecutionContext,
): string {
  const request = GqlExecutionContext.create(context).getContext<{
    req: { user?: AuthenticatedUser };
  }>().req;

  if (!request.user) {
    throw new Error('CurrentUser decorator used without JwtAuthGuard');
  }

  return request.user.sub;
}

export const CurrentUser = createParamDecorator(currentUserFactory);
