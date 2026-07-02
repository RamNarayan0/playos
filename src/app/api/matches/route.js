import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(req) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const userLat = searchParams.get('lat');
    const userLng = searchParams.get('lng');
    const maxDistance = searchParams.get('max_distance') || 15000; // default 15km

    let query;
    let values = [];
    const isGeospatial = !!(userLat && userLng);

    if (isGeospatial) {
      query = `
        SELECT m.*, t.name as turf_name, t.location as turf_location, u.name as host_name,
        ST_Distance(t.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) as distance_meters
        FROM matches m
        JOIN turfs t ON m.turf_id = t.id
        JOIN users u ON m.host_id = u.id
        WHERE ST_DWithin(t.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
        ORDER BY distance_meters ASC
      `;
      values = [userLng, userLat, maxDistance];
    } else {
      query = `
        SELECT m.*, t.name as turf_name, t.location as turf_location, u.name as host_name,
        NULL as distance_meters
        FROM matches m
        JOIN turfs t ON m.turf_id = t.id
        JOIN users u ON m.host_id = u.id
        ORDER BY m.start_time ASC
      `;
    }

    const result = await pool.query(query, values);
    const duration = Date.now() - startTime;
    
    // --- PostGIS Spatial Telemetry Pipeline Tracing ---
    const metricLabel = isGeospatial ? 'postgis.stdwithin_scan' : 'postgis.feed_scan';
    logger.metric(metricLabel, duration, { records: result.rows.length, geospatial: isGeospatial });

    return NextResponse.json(result.rows);
  } catch (error) {
    logger.error('Error executing matches retrieval pool', error, { route: '/api/matches' });
    const db = require('@/lib/db');
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message,
      db_source: db.connectionSource,
      db_url: db.connectionStringObfuscated
    }, { status: 500 });
  }
}

export async function POST(req) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { name, turf_id, host_id, start_time, total_players, skill_level } = body;
    
    const players_needed = total_players - 1;

    const query = `
      INSERT INTO matches (name, turf_id, host_id, start_time, total_players, players_needed, skill_level)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [name, turf_id, host_id, start_time, total_players, players_needed, skill_level];
    
    const result = await pool.query(query, values);
    const duration = Date.now() - startTime;
    
    logger.metric('postgis.match_creation', duration, { host_id, total_players });
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating match row payload', error, { route: '/api/matches:POST' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { match_id, turf_id } = body;

    const query = `
      UPDATE matches
      SET turf_id = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [turf_id ? parseInt(turf_id) : null, parseInt(match_id)]);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    
    const duration = Date.now() - startTime;
    logger.metric('postgis.match_turf_assignment', duration, { match_id, turf_id });
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating match turf assignment', error, { route: '/api/matches:PUT' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
