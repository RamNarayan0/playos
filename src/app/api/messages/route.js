import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get('match_id');

    if (!matchId) {
      return NextResponse.json({ error: 'match_id is required' }, { status: 400 });
    }

    const query = `
      SELECT m.*, u.name as sender_name
      FROM messages m
      JOIN users u ON m.sender_user_id = u.id
      WHERE m.match_id = $1
      ORDER BY m.created_at ASC
    `;
    const result = await pool.query(query, [matchId]);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
