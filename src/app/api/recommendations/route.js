import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(req) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const userLat = parseFloat(searchParams.get('lat') || 37.7749);
    const userLng = parseFloat(searchParams.get('lng') || -122.4194);
    const maxDistance = 25000; // 25km search radius

    // 1. Fetch user profile context for compatibility matching
    let userSports = ['Cricket', 'Football'];
    let userSkill = 'Beginner';
    
    if (userId) {
      const parsedId = parseInt(userId, 10);
      if (isNaN(parsedId) || parsedId > 2147483647 || parsedId < 1) {
        return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 });
      }
      
      const userRes = await pool.query('SELECT preferred_sports, skill_level FROM users WHERE id = $1', [parsedId]);
      if (userRes.rows.length > 0) {
        if (userRes.rows[0].preferred_sports) {
          userSports = userRes.rows[0].preferred_sports.split(',').map(s => s.trim().toLowerCase());
        }
        userSkill = userRes.rows[0].skill_level || 'Beginner';
      }
    }

    // 2. Query available open matches within geospatial radius
    const query = `
      SELECT m.*, t.name as turf_name, t.location as turf_location, u.name as host_name,
             ST_Distance(t.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) as distance_meters
      FROM matches m
      JOIN turfs t ON m.turf_id = t.id
      JOIN users u ON m.host_id = u.id
      WHERE m.status = 'OPEN' 
        AND m.players_needed > 0
        AND ST_DWithin(t.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
    `;
    const result = await pool.query(query, [userLng, userLat, maxDistance]);
    const matches = result.rows;

    // 3. Execute Multi-Variable Algorithmic Scoring Engine with Dynamic Weight Decay
    const isLowLiquidityZone = matches.length <= 3; // Trigger marketplace decay rules if options are scarce

    const scoredMatches = matches.map(match => {
      let score = 0;

      // --- Vector A: Spatial Proximity (Max 35 points) ---
      const distance = match.distance_meters || 0;
      const proximityScore = Math.max(0, 35 - (distance / 428));
      score += proximityScore;

      // --- Vector B: Sport Preference Compatibility (Max 30 points) ---
      const matchNameLower = match.name.toLowerCase();
      const isPreferredSport = userSports.some(sport => matchNameLower.includes(sport));
      if (isPreferredSport) {
        score += 30;
      } else {
        score += 10; 
      }

      // --- Vector C: Skill Tier Alignment (Max 20 points) ---
      if (match.skill_level === 'Any' || match.skill_level === 'Any Skill Level') {
        score += 15;
      } else if (match.skill_level?.toLowerCase().includes(userSkill.toLowerCase())) {
        score += 20;
      } else {
        score += 5; // Divergent tier but still playable
      }

      // --- Vector D: Liquidity Urgency Booster (Max 15 points) ---
      if (match.players_needed === 1) {
        score += 15;
      } else if (match.players_needed === 2) {
        score += 10;
      } else if (match.players_needed === 3) {
        score += 5;
      }

      // --- Algorithmic Weight Decay Application ---
      // If the PostGIS scan reveals a local dead zone, relax filtering strictness to maximize fulfillment opportunity
      if (isLowLiquidityZone && score < 75) {
        score += 18; // Decay strict alignment penalties to preserve actionable marketplace discovery
      }

      // Normalize total compatibility percentage cap
      const finalScorePercentage = Math.min(99, Math.round(score));
      
      // Determine premium UI progression tag
      let matchLabel = "Active Match";
      if (finalScorePercentage > 85) matchLabel = "🔥 Optimal Fit";
      else if (finalScorePercentage > 70) matchLabel = "✨ Strong Match";
      else if (isLowLiquidityZone) matchLabel = "🛡️ Preserved Inventory";
      else matchLabel = "⚡ Playable Feed";

      return {
        ...match,
        compatibility_score: finalScorePercentage,
        compatibility_label: matchLabel
      };
    });

    // 4. Sort descending by highest intelligence score
    scoredMatches.sort((a, b) => b.compatibility_score - a.compatibility_score);

    const duration = Date.now() - startTime;
    logger.metric('intelligence.scoring_engine_latency', duration, { 
      user_id: userId, 
      evaluated_matches: matches.length,
      decay_applied: isLowLiquidityZone
    });

    return NextResponse.json(scoredMatches);
  } catch (error) {
    logger.error('Algorithmic recommendation orchestration engine error', error, { route: '/api/recommendations' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
