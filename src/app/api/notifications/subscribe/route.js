import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { user_id, subscription } = body;

    if (!user_id || !subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 });
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    // Save or update subscription
    const query = `
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, browser)
      VALUES ($1, $2, $3, $4, 'web')
      ON CONFLICT (endpoint) 
      DO UPDATE SET last_active_at = CURRENT_TIMESTAMP, user_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [user_id, endpoint, p256dh, auth]);

    return NextResponse.json({ success: true, subscription_id: result.rows[0].id });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
