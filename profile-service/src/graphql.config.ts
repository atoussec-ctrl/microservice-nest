export function isIntrospectionEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}
