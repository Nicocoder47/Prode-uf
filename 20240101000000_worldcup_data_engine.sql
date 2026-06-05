-- DATA ENGINE SCHEMA - PRODEMUNDIAL 2026

CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    country_code TEXT NOT NULL,
    flag TEXT,
    "group" VARCHAR(1),
    fifa_ranking INTEGER,
    coach TEXT,
    confederation TEXT,
    market_value BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    photo TEXT,
    team_id TEXT REFERENCES teams(id),
    position TEXT,
    age INTEGER,
    height INTEGER,
    weight INTEGER,
    club TEXT,
    market_value BIGINT,
    rating DECIMAL(3,2),
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    appearances INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stadiums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    capacity INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    stage TEXT NOT NULL,
    "group" VARCHAR(1),
    stadium_id TEXT REFERENCES stadiums(id),
    city TEXT,
    country TEXT,
    home_team_id TEXT REFERENCES teams(id),
    away_team_id TEXT REFERENCES teams(id),
    kickoff TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL, -- 'scheduled', 'live', 'halftime', 'finished'
    home_score INTEGER,
    away_score INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE match_events (
    id TEXT PRIMARY KEY,
    match_id TEXT REFERENCES matches(id),
    player_id TEXT REFERENCES players(id),
    event_type TEXT NOT NULL, -- 'goal', 'card', 'sub_in', 'sub_out', 'var'
    minute INTEGER NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_ratings (
    id TEXT PRIMARY KEY,
    match_id TEXT REFERENCES matches(id),
    player_id TEXT REFERENCES players(id),
    rating DECIMAL(3,2) NOT NULL,
    is_mvp BOOLEAN DEFAULT FALSE,
    provider TEXT NOT NULL, -- 'sofascore', 'api-football'
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lineups (
    id TEXT PRIMARY KEY,
    match_id TEXT REFERENCES matches(id),
    team_id TEXT REFERENCES teams(id),
    player_id TEXT REFERENCES players(id),
    is_starting BOOLEAN DEFAULT TRUE,
    formation_position TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para optimizar el frontend
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_events_match ON match_events(match_id);
CREATE INDEX idx_ratings_match_player ON player_ratings(match_id, player_id);