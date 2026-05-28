import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM turfs ORDER BY name ASC');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching turfs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, location, price, features } = body;
    
    // Note: price and features are mock fields on the DB for now, adding them to the return object
    const query = `
      INSERT INTO turfs (name, location)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await pool.query(query, [name, location]);
    const turf = result.rows[0];
    
    return NextResponse.json({ ...turf, price, features });
  } catch (error) {
    console.error('Error creating turf:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
