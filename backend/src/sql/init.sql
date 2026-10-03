CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    pid uuid DEFAULT gen_random_uuid() UNIQUE,
    name VARCHAR(32) UNIQUE NOT NULL,
    pass TEXT NOT NULL,
    avatar BYTEA NOT NULL,
    email VARCHAR(254) UNIQUE NOT NULL,
    colcoins INT DEFAULT 0,
    prestige INT DEFAULT 0,
    permissions TEXT[] DEFAULT '{"read:activation_token"}',
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author_id INT NOT NULL,
    parent_id INT,
    body TEXT,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES contents(id)
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    config JSONB
);

CREATE TABLE IF NOT EXISTS contents_tags (
    content_id INT,
    tag_id INT,
    FOREIGN KEY (content_id) REFERENCES contents(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id),
    PRIMARY KEY (content_id, tag_id)
);

CREATE TABLE IF NOT EXISTS interactions (
    id SERIAL PRIMARY KEY,
    author_id INT NOT NULL,
    content_id INT NOT NULL,
    type TEXT NOT NULL,
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (content_id) REFERENCES contents(id)
);

CREATE TABLE IF NOT EXISTS synonyms (
    id SERIAL PRIMARY KEY,
    title TEXT UNIQUE NOT NULL,
    content_id INT NOT NULL,
    FOREIGN KEY (content_id) REFERENCES contents(id)
);

CREATE INDEX IF NOT EXISTS contents_parent_id_idx ON contents (parent_id);
CREATE INDEX IF NOT EXISTS interactions_content_type_idx ON interactions (content_id, type);
CREATE INDEX IF NOT EXISTS interactions_author_content_idx ON interactions (author_id, content_id);

-- A user can react (up or down), bookmark and vote at most once per content
CREATE UNIQUE INDEX IF NOT EXISTS interactions_unique_reaction_idx ON interactions (author_id, content_id) WHERE type IN ('up', 'down');
CREATE UNIQUE INDEX IF NOT EXISTS interactions_unique_bookmark_idx ON interactions (author_id, content_id) WHERE type = 'bookmark';
CREATE UNIQUE INDEX IF NOT EXISTS interactions_unique_vote_idx ON interactions (author_id, content_id) WHERE type = 'vote';
