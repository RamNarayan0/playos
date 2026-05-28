const { pool } = require('../../../../lib/db');


/**
 * POST /api/match/make
 * Body: { latitude, longitude, skill, availability, sport }
 * Returns a list of suitable player IDs with pagination metadata.
 */
async function POST(req) {
  try {
    // Support both node-mocks-http (req.body) and real fetch (req.json())
    const data = req.body || (await (req.json ? req.json() : Promise.resolve({})));
    const { latitude, longitude, skill, availability, sport } = data;
    const radiusMeters = 5000; // 5 km search radius

    // Build optional filter clauses
    const filterClauses = [];
    const filterValues = [];
    let paramIdx = 5; // $1..$4 are used below
    if (sport) {
      filterClauses.push(`u.sport = $${paramIdx}`);
      filterValues.push(sport);
      paramIdx++;
    }

    // Pagination (compatible with node-mocks-http and fetch Headers)
    const getHeader = (name) => {
      if (req.headers && typeof req.headers.get === 'function') {
        return req.headers.get(name);
      }
      if (req.headers && typeof req.headers === 'object') {
        return req.headers[name.toLowerCase()];
      }
      return undefined;
    };
    const limit = parseInt(getHeader('x-limit') || '20', 10);
    const offset = parseInt(getHeader('x-offset') || '0', 10);

    const query = `
      SELECT u.id, u.name, u.skill, u.availability,
        ST_Distance(u.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance,
        ABS(u.skill - $3) AS skill_diff,
        (u.availability && $4::tstzrange) AS availability_match
      FROM users u
      WHERE ST_DWithin(u.location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $5)
      ${filterClauses.length ? 'AND ' + filterClauses.join(' AND ') : ''}
      ORDER BY availability_match DESC, skill_diff ASC, distance ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
    `;

    const values = [longitude, latitude, skill, availability, radiusMeters, ...filterValues, limit, offset];
    const { rows } = await pool.query(query, values);

    // Total count (without pagination)
    const countQuery = `
      SELECT COUNT(*) FROM users u
      WHERE ST_DWithin(u.location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
      ${filterClauses.length ? 'AND ' + filterClauses.join(' AND ') : ''};
    `;
    const countValues = [longitude, latitude, radiusMeters, ...filterValues];
    const { rows: countRows } = await pool.query(countQuery, countValues);
    const total = parseInt(countRows[0].count, 10);

    return new Response(JSON.stringify({ matches: rows, total, limit, offset }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Match engine error:', e);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

module.exports = { POST, GET: POST }; // allow GET for quick testing
