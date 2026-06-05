-- EXTENSIÓN DEL ESQUEMA: PRODE, USUARIOS Y LEADERBOARD

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    username TEXT NOT NULL,
    avatar_url TEXT,
    tokens BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
    predicted_winner TEXT, -- 'home', 'draw', 'away'
    predicted_home_score INTEGER,
    predicted_away_score INTEGER,
    predicted_first_goal_scorer_id TEXT REFERENCES players(id),
    predicted_mvp_id TEXT REFERENCES players(id),
    points INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- 'pending', 'locked', 'scored'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, match_id)
);

CREATE TABLE leaderboard (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    exact_scores INTEGER DEFAULT 0,
    correct_results INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de alto rendimiento
CREATE INDEX idx_predictions_user_status ON predictions(user_id, status);
CREATE INDEX idx_leaderboard_points_desc ON leaderboard(points DESC);