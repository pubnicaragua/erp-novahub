import * as Sentry from '@sentry/react';
import type { ChunkLoadIncident } from './chunk-recovery';

export function reportChunkLoadIncident(incident: ChunkLoadIncident): void {
  Sentry.withScope((scope) => {
    scope.setLevel('warning');
    scope.setTag('incident.type', 'asset-load-recovery');
    scope.setTag('module', incident.moduleName);
    scope.setTag('app.build', incident.buildId);
    scope.setContext('assetLoad', {
      errorName: incident.errorName,
      online: incident.online,
      route: incident.route,
      occurredAt: incident.occurredAt,
    });
    scope.setFingerprint(['asset-load-recovery', incident.buildId, incident.moduleName, incident.errorName]);
    Sentry.captureException(new Error(incident.errorMessage));
  });
}
