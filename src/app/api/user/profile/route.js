import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const parsedId = parseInt(userId, 10);
    if (isNaN(parsedId) || parsedId > 2147483647 || parsedId < 1) {
      return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 });
    }

    const query = `
      SELECT id, name, email, phone, role, preferred_sports, skill_level, 
             reputation_score, attendance_score, profile_completion_status
      FROM users
      WHERE id = $1
    `;
    const result = await pool.query(query, [parsedId]);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { user_id, preferred_sports, skill_level } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const parsedId = parseInt(user_id, 10);
    if (isNaN(parsedId) || parsedId > 2147483647 || parsedId < 1) {
      return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 });
    }

    const query = `
      UPDATE users 
      SET preferred_sports = $1, skill_level = $2, profile_completion_status = true
      WHERE id = $3
      RETURNING id, name, preferred_sports, skill_level, reputation_score, attendance_score
    `;
    const result = await pool.query(query, [preferred_sports, skill_level, parsedId]);

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
