import { traceMixin } from '@kubecon-pq-agent/otel';
import pino from 'pino';

export const log = pino({
  mixin: traceMixin(),
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: process.env.OTEL_SERVICE_NAME ?? 'api' },
});
