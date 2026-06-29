-- migrations/0001_initial.sql
-- Initial schema for Monopoly Server Persistence Layer

CREATE TABLE games (
    id UUID PRIMARY KEY,
    map_config_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE,
    winner_id VARCHAR(255)
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY,
    game_id UUID REFERENCES games(id),
    state VARCHAR(50) NOT NULL, -- WAITING, STARTING, RUNNING, FINISHED, DESTROYED
    host_player_id VARCHAR(255),
    join_code VARCHAR(255),
    is_private BOOLEAN NOT NULL DEFAULT false,
    max_players INTEGER NOT NULL DEFAULT 8,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE snapshots (
    id UUID PRIMARY KEY,
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    action_index INTEGER NOT NULL,
    version VARCHAR(255) NOT NULL,
    checksum VARCHAR(255) NOT NULL,
    snapshot_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimize fetching the latest snapshot for a game
CREATE INDEX idx_snapshots_game_id_action_index ON snapshots(game_id, action_index DESC);

CREATE TABLE actions (
    id UUID PRIMARY KEY,
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    action_index INTEGER NOT NULL,
    client_action_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimize fetching actions after a snapshot index for replay reconstruction
CREATE INDEX idx_actions_game_id_action_index ON actions(game_id, action_index ASC);

CREATE TABLE events (
    id UUID PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    action_id UUID REFERENCES actions(id) ON DELETE CASCADE, -- Nullable if not tied exclusively to client action
    sequence_number INTEGER NOT NULL,
    event_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimize fetching events sequentially for a game
CREATE INDEX idx_events_game_id_sequence ON events(game_id, sequence_number ASC);

CREATE TABLE replay_metadata (
    game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    total_actions INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    player_count INTEGER NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
