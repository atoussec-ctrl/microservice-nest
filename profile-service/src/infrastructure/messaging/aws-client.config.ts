export function buildAwsClientConfig(endpoint?: string): {
  region: string;
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
} {
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const resolvedEndpoint = endpoint ?? process.env.AWS_ENDPOINT;
  const credentials =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined;

  return {
    region,
    ...(resolvedEndpoint ? { endpoint: resolvedEndpoint } : {}),
    ...(credentials ? { credentials } : {}),
  };
}
