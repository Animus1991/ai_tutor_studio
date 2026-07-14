import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';
import { auditLogger } from './auditLogger';

let vitalsStarted = false;

export function reportWebVitals() {
  if (vitalsStarted) return;
  vitalsStarted = true;

  const reported = new Set<string>();

  const reportHandler = (metric: { name: string; value: number; rating: string; id: string }) => {
    const key = `${metric.name}:${metric.id}`;
    if (reported.has(key)) return;
    reported.add(key);

    if (import.meta.env.DEV) {
      console.log(`[Web Vitals] ${metric.name}:`, Math.round(metric.value * 100) / 100);
    }

    if (!import.meta.env.DEV) {
      auditLogger.log('PERFORMANCE_METRIC', 'system', undefined, {
        metricName: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
      });
    }
  };

  onCLS(reportHandler);
  onINP(reportHandler);
  onLCP(reportHandler);
  onFCP(reportHandler);
  onTTFB(reportHandler);
}
