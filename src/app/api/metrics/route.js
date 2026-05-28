import { register } from 'prom-client';

/**
 * Exposes Prometheus metrics.
 * GET /api/metrics
 */
export async function GET(req) {
  try {
    // Protect metrics endpoint: require METRICS_TOKEN env var or localhost only
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const expected = process.env.METRICS_TOKEN;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('host');
    if (expected && token !== expected && ip !== 'localhost') {
      return new Response('Unauthorized', { status: 401 });
    }
    const metrics = await register.metrics();
    return new Response(metrics, {
      status: 200,
      headers: { 'Content-Type': register.contentType },
    });
  } catch (err) {
    console.error('Metrics endpoint error:', err);
    return new Response('Error collecting metrics', { status: 500 });
  }
}

export const POST = GET; // Allow POST for compatibility
