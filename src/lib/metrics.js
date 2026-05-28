const client = require('prom-client');

// Registry for all metrics
const register = new client.Registry();
// Collect default Node.js metrics (CPU, memory, GC, etc.)
client.collectDefaultMetrics({ register });

// API request metrics
const apiRequestCounter = new client.Counter({
  name: 'playos_api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const apiRequestDuration = new client.Histogram({
  name: 'playos_api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// Socket metrics
const socketConnectionsTotal = new client.Counter({
  name: 'playos_socket_connections_total',
  help: 'Total number of socket connections',
  labelNames: ['event'],
  registers: [register],
});

const socketDisconnectsTotal = new client.Counter({
  name: 'playos_socket_disconnects_total',
  help: 'Total number of socket disconnects',
  labelNames: ['event'],
  registers: [register],
});

const socketReconnectAttemptsTotal = new client.Counter({
  name: 'playos_socket_reconnect_attempts_total',
  help: 'Total number of socket reconnection attempts',
  labelNames: ['event'],
  registers: [register],
});

const socketEventDuration = new client.Histogram({
  name: 'playos_socket_event_duration_seconds',
  help: 'Duration of socket connection lifecycle events',
  labelNames: ['event'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Gauge for active connections (alias for compatibility)
const socketActiveConnectionsGauge = new client.Gauge({
  name: 'playos_socket_active_connections',
  help: 'Current number of active socket connections',
  registers: [register],
});
const socketConnectionGauge = socketActiveConnectionsGauge; // alias

module.exports = {
  register,
  apiRequestCounter,
  apiRequestDuration,
  socketConnectionsTotal,
  socketDisconnectsTotal,
  socketReconnectAttemptsTotal,
  socketEventDuration,
  socketActiveConnectionsGauge,
  socketConnectionGauge,
};

