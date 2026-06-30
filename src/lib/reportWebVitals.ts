import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';
import { auditLogger } from './auditLogger';

export function reportWebVitals() {
  const reportHandler = (metric: any) => {
    // Report to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Web Vitals] ${metric.name}:`, Math.round(metric.value * 100) / 100);
    }
    
    // Log to our audit logger
    auditLogger.log('PERFORMANCE_METRIC', 'system', undefined, {
      metricName: metric.name,
      value: metric.value,
      rating: metric.rating, // 'good', 'needs-improvement', 'poor'
      id: metric.id
    });
  };

  onCLS(reportHandler);
  onINP(reportHandler);
  onLCP(reportHandler);
  onFCP(reportHandler);
  onTTFB(reportHandler);
}
