/**
 * PLAYOS Centralized Telemetry & Observability Utility
 * Standardizes outbound performance traces, PostGIS execution latency metrics,
 * and error payload capture for local console and multi-cloud streaming pipelines.
 */

const isProd = process.env.NODE_ENV === 'production';

export const logger = {
  info: (message, context = {}) => {
    const timestamp = new Date().toISOString();
    if (isProd) {
      console.log(JSON.stringify({ level: 'INFO', timestamp, message, ...context }));
    } else {
      console.log(`[INFO] ${timestamp} - ${message}`, Object.keys(context).length ? context : '');
    }
  },

  error: (message, error = null, context = {}) => {
    const timestamp = new Date().toISOString();
    const errorPayload = error ? { message: error.message, stack: error.stack } : null;
    
    if (isProd) {
      console.error(JSON.stringify({ level: 'ERROR', timestamp, message, error: errorPayload, ...context }));
      // Forward directly to external SaaS crash trackers if setup (Sentry/Datadog)
    } else {
      console.error(`❌ [ERROR] ${timestamp} - ${message}`, errorPayload || '', context);
    }
  },

  metric: (metricName, valueMs, tags = {}) => {
    const timestamp = new Date().toISOString();
    const payload = {
      metric: metricName,
      value_ms: Number(valueMs).toFixed(2),
      timestamp,
      ...tags
    };

    if (isProd) {
      // Stream runtime metrics directly to cloud monitoring endpoints or log collectors
      console.log(JSON.stringify({ level: 'METRIC', ...payload }));
    } else {
      // Custom visual read-out for sub-millisecond dev database optimizations
      const durationStr = `${payload.value_ms}ms`;
      console.log(`📊 [METRIC] ${metricName} | Latency: ${durationStr}`, tags);
    }
  }
};
