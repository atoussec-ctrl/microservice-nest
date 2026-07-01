import { JwtModuleOptions } from '@nestjs/jwt';

type ExpiresIn = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

export function buildJwtModuleOptions(): JwtModuleOptions {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return {
    secret,
    signOptions: {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as ExpiresIn,
    },
  };
}
