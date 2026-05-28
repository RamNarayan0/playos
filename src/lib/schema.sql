-- PostgreSQL Schema for PLAYOS MVP
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users Table (Identity & Reputation Layer)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password VARCHAR(255), -- For credential login
    auth_provider VARCHAR(50) DEFAULT 'credentials', -- google, credentials
    profile_completion_status BOOLEAN DEFAULT false,
    username_slug VARCHAR(255) UNIQUE,
    onboarding_stage VARCHAR(50) DEFAULT 'new',
    preferred_sports VARCHAR(255), -- e.g., 'Cricket,Football'
    skill_level VARCHAR(50) DEFAULT 'Beginner',
    location_coordinates VARCHAR(255),
    geom GEOGRAPHY(Point, 4326),
    reputation_score DECIMAL(5,2) DEFAULT 100.00,
    attendance_score DECIMAL(5,2) DEFAULT 100.00,
    role VARCHAR(50) DEFAULT 'player', -- player, owner, admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Turfs / Venues
CREATE TABLE IF NOT EXISTS turfs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    geom GEOGRAPHY(Point, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    turf_id INTEGER REFERENCES turfs(id),
    host_id INTEGER REFERENCES users(id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_players INTEGER NOT NULL DEFAULT 14,
    players_needed INTEGER NOT NULL,
    skill_level VARCHAR(50) DEFAULT 'Any',
    status VARCHAR(50) DEFAULT 'OPEN', -- OPEN, FILLED, IN_PROGRESS, COMPLETED, CANCELLED
    urgency VARCHAR(50) DEFAULT 'Normal', -- Normal, High, Critical
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Match Players (Join Table)
CREATE TABLE IF NOT EXISTS match_players (
    match_id INTEGER REFERENCES matches(id),
    user_id INTEGER REFERENCES users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (match_id, user_id)
);

-- Requests (Players asking to join a match)
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id),
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(match_id, user_id)
);

-- Messages (Realtime Match Chat)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    sender_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text', -- text, system_event, image
    media_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Push Subscriptions (Realtime Reactivation Layer)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh_key VARCHAR(255) NOT NULL,
    auth_key VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) DEFAULT 'web',
    browser VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);

-- System Hardening Indexes (Latency & Map Latency protections)
CREATE INDEX IF NOT EXISTS idx_matches_status_start ON matches(status, start_time);
CREATE INDEX IF NOT EXISTS idx_turfs_geom ON turfs USING GIST(geom);

-- Initial Mock Data
INSERT INTO turfs (name, location) VALUES 
('Skyline Box Cricket', 'Downtown Core'),
('Greenfield Arena', 'Westside'),
('Urban Pitch', 'East End')
ON CONFLICT DO NOTHING;
