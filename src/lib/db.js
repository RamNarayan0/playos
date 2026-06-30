const { Pool } = require('pg');

// Use DATABASE_URL from env or fallback to a local default
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_YgVU28WZPBkh@ep-rapid-rice-aq4tntft.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

// Helper to query the database
const query = (text, params) => pool.query(text, params);

module.exports = {
  query,
  pool,
};
