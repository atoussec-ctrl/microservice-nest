import { buildJwtModuleOptions } from '../../../src/infrastructure/auth/jwt.config';

describe('buildJwtModuleOptions', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalExpiresIn = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.JWT_EXPIRES_IN = originalExpiresIn;
  });

  it('should_throw_when_jwt_secret_is_not_set', () => {
    delete process.env.JWT_SECRET;
    expect(() => buildJwtModuleOptions()).toThrow(
      'JWT_SECRET environment variable is required',
    );
  });

  it('should_use_the_configured_secret_and_default_1h_expiry', () => {
    process.env.JWT_SECRET = 'super-secret';
    delete process.env.JWT_EXPIRES_IN;

    const options = buildJwtModuleOptions();

    expect(options.secret).toBe('super-secret');
    expect(options.signOptions?.expiresIn).toBe('1h');
  });

  it('should_use_a_custom_expiry_when_configured', () => {
    process.env.JWT_SECRET = 'super-secret';
    process.env.JWT_EXPIRES_IN = '15m';

    const options = buildJwtModuleOptions();

    expect(options.signOptions?.expiresIn).toBe('15m');
  });
});
