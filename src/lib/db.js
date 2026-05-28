const { Pool } = require('pg');

// Use DATABASE_URL from env or fallback to a local default
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/playos',
});

// Helper to query the database
const query = (text, params) => pool.query(text, params);

module.exports = {
  query,
  pool,
};
