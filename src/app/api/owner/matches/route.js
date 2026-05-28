import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req) {
  try {
    // In a real app, extract owner_id from session
    // For MVP, just return all matches to show functionality
    const query = `
      SELECT m.*, t.name as turf_name, t.location as turf_location, u.name as host_name, u.phone as host_contact
      FROM matches m
      JOIN turfs t ON m.turf_id = t.id
      JOIN users u ON m.host_id = u.id
      ORDER BY m.start_time ASC
    `;
    const result = await pool.query(query);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching owner matches:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
