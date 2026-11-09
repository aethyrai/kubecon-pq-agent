'use client';
import { useEffect } from 'react';

/** Dash0 browser RUM: one page view per route. Loaded only when the endpoint is configured. */
export function Dash0Rum() {
  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_DASH0_ENDPOINT;
    const token = process.env.NEXT_PUBLIC_DASH0_TOKEN;
    if (!endpoint || !token) return;
    import('@dash0/sdk-web')
      .then((m) => m.init({ serviceName: 'web', endpoint: { url: endpoint, authToken: token } }))
      .catch(() => undefined);
  }, []);
  return null;
}
