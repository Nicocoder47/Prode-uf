-- FASE 2: PRODE, PROFILES, LEADERBOARD Y TRANSACTIONS

-- 1. Perfiles extendidos vinculados a Supabase Auth
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    avatar_url TEXT,
    tokens BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Predicciones de usuarios
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
    predicted_winner TEXT, -- 'home', 'draw', 'away'
    predicted_home_score INTEGER,
    predicted_away_score INTEGER,
    predicted_scorer TEXT REFERENCES players(id),
    predicted_mvp TEXT REFERENCES players(id),
    predicted_first_goal TEXT REFERENCES players(id),
    points INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- 'pending', 'locked', 'scored'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, match_id)
);

-- 3. Leaderboard Global
CREATE TABLE leaderboard (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    exact_scores INTEGER DEFAULT 0,
    correct_results INTEGER DEFAULT 0,
    position INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    type TEXT NOT NULL, -- 'purchase', 'reward', 'bet'
    reference_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);