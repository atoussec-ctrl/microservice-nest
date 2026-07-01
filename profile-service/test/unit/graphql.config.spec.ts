import { isIntrospectionEnabled } from '../../src/graphql.config';

describe('isIntrospectionEnabled', () => {
  it('should_disable_introspection_in_production', () => {
    expect(isIntrospectionEnabled('production')).toBe(false);
  });

  it('should_enable_introspection_when_not_production', () => {
    expect(isIntrospectionEnabled('development')).toBe(true);
    expect(isIntrospectionEnabled('test')).toBe(true);
  });

  it('should_enable_introspection_when_node_env_is_undefined', () => {
    expect(isIntrospectionEnabled(undefined)).toBe(true);
  });
});
