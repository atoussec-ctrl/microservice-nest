import { buildAwsClientConfig } from '../../../src/infrastructure/messaging/aws-client.config';

describe('buildAwsClientConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should_default_region_and_omit_endpoint_and_credentials_when_unset', () => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_ENDPOINT;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const config = buildAwsClientConfig();

    expect(config).toEqual({ region: 'us-east-1' });
  });

  it('should_use_explicit_endpoint_argument_over_env', () => {
    process.env.AWS_ENDPOINT = 'http://env-endpoint:4566';
    const config = buildAwsClientConfig('http://explicit-endpoint:4566');
    expect(config.endpoint).toBe('http://explicit-endpoint:4566');
  });

  it('should_include_credentials_when_both_env_vars_set', () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

    const config = buildAwsClientConfig();

    expect(config.credentials).toEqual({
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
  });

  it('should_omit_credentials_when_only_access_key_id_set', () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const config = buildAwsClientConfig();

    expect(config.credentials).toBeUndefined();
  });
});
