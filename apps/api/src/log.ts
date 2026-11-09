import pino from 'pino';

export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: process.env.OTEL_SERVICE_NAME ?? 'api' },
});
