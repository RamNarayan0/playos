import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { match_id, user_id } = body;
    
    const query = `
      INSERT INTO requests (match_id, user_id, status)
      VALUES ($1, $2, 'PENDING')
      RETURNING *
    `;
    const result = await pool.query(query, [match_id, user_id]);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return NextResponse.json({ error: 'Request already sent' }, { status: 400 });
    }
    console.error('Error creating request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { request_id, status } = body; // 'ACCEPTED' or 'REJECTED'
    
    // Start transaction to update request and decrement match players_needed
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const reqRes = await client.query('UPDATE requests SET status = $1 WHERE id = $2 RETURNING *', [status, request_id]);
      
      if (status === 'ACCEPTED' && reqRes.rows.length > 0) {
        const matchId = reqRes.rows[0].match_id;
        
        // Decrement players needed
        await client.query('UPDATE matches SET players_needed = GREATEST(players_needed - 1, 0) WHERE id = $1', [matchId]);
      }
      
      await client.query('COMMIT');
      return NextResponse.json(reqRes.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
