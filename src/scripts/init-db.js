const fs = require('fs');
const path = require('path');
const { pool } = require('../lib/db');

async function initializeDatabase() {
  try {
    console.log('Connecting to PostgreSQL...');
    const schemaPath = path.join(__dirname, '../lib/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema initialization...');
    await pool.query(schema);

    console.log('Inserting mock users...');
    await pool.query('DELETE FROM requests');
    await pool.query('DELETE FROM match_players');
    await pool.query('DELETE FROM matches');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM turfs');
    
    await pool.query(`
      INSERT INTO users (id, name, email, phone, geom) VALUES 
      (1, 'John Doe', 'john@example.com', '+1 555-0100', ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)),
      (2, 'Jane Smith', 'jane@example.com', '+1 555-0101', ST_SetSRID(ST_MakePoint(-122.4200, 37.7800), 4326)),
      (3, 'Alex Johnson', 'alex@example.com', '+1 555-0102', ST_SetSRID(ST_MakePoint(-122.4300, 37.7600), 4326))
    `);

    console.log('Inserting mock turfs with locations...');
    await pool.query(`
      INSERT INTO turfs (id, name, location, geom) VALUES 
      (1, 'Skyline Box Cricket', 'Downtown Core', ST_SetSRID(ST_MakePoint(-122.4190, 37.7750), 4326)),
      (2, 'Greenfield Arena', 'Westside', ST_SetSRID(ST_MakePoint(-122.4500, 37.7800), 4326)),
      (3, 'Urban Pitch', 'East End', ST_SetSRID(ST_MakePoint(-122.3900, 37.7700), 4326))
    `);
    
    await pool.query("SELECT setval('turfs_id_seq', (SELECT MAX(id) FROM turfs))");

    // Reset sequence so auto-increment works if they add new users later
    await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");

    console.log('Inserting mock matches...');
    await pool.query(`
      INSERT INTO matches (id, name, turf_id, host_id, start_time, total_players, players_needed, skill_level, status, urgency) 
      VALUES 
      (1, 'Downtown Strikers', 1, 1, CURRENT_TIMESTAMP + interval '2 hours', 14, 3, 'Intermediate', 'OPEN', 'High'),
      (2, 'Weekend Warriors', 2, 2, CURRENT_TIMESTAMP + interval '4 hours', 14, 1, 'Beginner Friendly', 'OPEN', 'Critical'),
      (3, 'Pro League Practice', 3, 3, CURRENT_TIMESTAMP + interval '1 day', 14, 4, 'Advanced/Pro', 'OPEN', 'Normal')
    `);
    
    await pool.query("SELECT setval('matches_id_seq', (SELECT MAX(id) FROM matches))");

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
