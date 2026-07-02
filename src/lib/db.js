const { Pool } = require('pg');

let connectionString = process.env.DATABASE_URL;
let connectionSource = "process.env.DATABASE_URL";

if (!connectionString) {
  connectionString = 'postgresql://neondb_owner:npg_YgVU28WZPBkh@ep-rapid-rice-aq4tntft.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';
  connectionSource = "hardcoded fallback";
}

const pool = new Pool({
  connectionString,
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  query,
  pool,
  connectionSource,
  connectionStringObfuscated: connectionString.replace(/:[^:@\/\s]+@/, ':****@'),
};
