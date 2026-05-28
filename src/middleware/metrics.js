const { apiRequestCounter, apiRequestDuration } = require('../lib/metrics');

/**
 * Minimal metrics middleware for HTTP requests.
 * Captures start time, and on response finish records request count and latency.
 * Any error during metric collection is caught so it never impacts the API response.
 */
function metricsMiddleware(req, res, next) {
  const start = process.hrtime();
  const { method, url } = req;
  const route = url.split('?')[0];

  // Listen for response completion
  res.on('finish', () => {
    try {
      const diff = process.hrtime(start);
      const durationSec = diff[0] + diff[1] / 1e9;
      const statusCode = res.statusCode || 0;
      apiRequestCounter.inc({ method, route, status_code: statusCode });
      apiRequestDuration.observe({ method, route, status_code: statusCode }, durationSec);
    } catch (e) {
      // Swallow metric errors – they must not affect request handling
      console.error('Metrics middleware error:', e);
    }
  });

  if (typeof next === 'function') {
    next();
  }
}

module.exports = metricsMiddleware;
